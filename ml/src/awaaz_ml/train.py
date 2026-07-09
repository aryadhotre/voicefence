"""Train the RawNet2-style detector on ASVspoof LA (+ optional extra sources).

Usage (from ml/ with the venv active):
    python -m awaaz_ml.train --config configs/rawnet2_asvspoof_la.yaml
    python -m awaaz_ml.train --config ... --resume runs/rawnet2_baseline/last.pt
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from .data.asvspoof import (
    AudioListDataset,
    BONAFIDE,
    asvspoof_la_paths,
    build_items,
)
from .metrics import compute_eer
from .models.rawnet2 import RawNet2, build_model
from .utils import (
    CSVLogger,
    count_parameters,
    ensure_dir,
    get_device,
    load_config,
    set_seed,
    worker_count,
)


def _sources_from_cfg(cfg: dict, split: str) -> list[tuple[Path, Path]]:
    la = asvspoof_la_paths(cfg["data"]["asvspoof_root"])[split]
    sources = [(la["protocol"], la["audio_root"])]
    for extra in cfg["data"].get(f"extra_{split}_sources", []) or []:
        sources.append((Path(extra["protocol"]), Path(extra["audio_root"])))
    return sources


@torch.no_grad()
def score_dataset(
    model: RawNet2,
    loader: DataLoader,
    device: torch.device,
    amp: bool,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Return (scores, labels, utts) over a loader. Higher score = bonafide."""
    model.eval()
    all_scores, all_labels, all_utts = [], [], []
    autocast = torch.autocast(device_type=device.type, enabled=amp and device.type == "cuda")
    for wav, label, utt in tqdm(loader, desc="scoring", leave=False):
        wav = wav.to(device, non_blocking=True)
        with autocast:
            logits = model(wav)
        scores = RawNet2.scores_from_logits(logits.float())
        all_scores.append(scores.cpu().numpy())
        all_labels.append(np.asarray(label))
        all_utts.extend(utt)
    return np.concatenate(all_scores), np.concatenate(all_labels), all_utts


def evaluate_eer(scores: np.ndarray, labels: np.ndarray) -> tuple[float, float]:
    bona = scores[labels == BONAFIDE]
    spoof = scores[labels != BONAFIDE]
    return compute_eer(bona, spoof)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", required=True)
    ap.add_argument("--resume", default=None, help="Path to last.pt to resume")
    ap.add_argument("--device", default=None, choices=[None, "cuda", "cpu"])
    args = ap.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 1234))
    device = get_device(args.device)

    out_dir = ensure_dir(cfg["out_dir"])
    tcfg, dcfg, mcfg = cfg["train"], cfg["data"], cfg["model"]
    samples = int(dcfg["samples"])

    train_items = build_items(
        _sources_from_cfg(cfg, "train"), max_items=tcfg.get("max_train_items")
    )
    dev_items = build_items(
        _sources_from_cfg(cfg, "dev"), max_items=tcfg.get("max_dev_items")
    )
    train_ds = AudioListDataset(train_items, samples, mode="train")
    dev_ds = AudioListDataset(dev_items, samples, mode="eval")
    n_spoof, n_bona = train_ds.class_counts()
    print(f"train: {len(train_ds)} utts (spoof={n_spoof}, bonafide={n_bona}) | "
          f"dev: {len(dev_ds)} utts | device: {device}")

    nw = worker_count(tcfg.get("num_workers", 4))
    loader_kw = dict(
        num_workers=nw,
        pin_memory=(device.type == "cuda"),
        persistent_workers=nw > 0,
    )
    train_loader = DataLoader(
        train_ds, batch_size=tcfg["batch_size"], shuffle=True,
        drop_last=True, **loader_kw,
    )
    dev_loader = DataLoader(
        dev_ds, batch_size=tcfg.get("eval_batch_size", tcfg["batch_size"] * 2),
        shuffle=False, **loader_kw,
    )

    model = build_model(mcfg).to(device)
    print(f"model: RawNet2-style, {count_parameters(model)/1e6:.2f}M trainable params")

    # class order [spoof, bonafide]; LA train is ~1:9 bonafide:spoof,
    # so down-weight spoof.
    weights = torch.tensor(tcfg.get("class_weights", [0.1, 0.9]),
                           dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.Adam(
        model.parameters(), lr=float(tcfg["lr"]),
        weight_decay=float(tcfg.get("weight_decay", 1e-4)),
    )
    use_amp = bool(tcfg.get("amp", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler(enabled=use_amp)

    start_epoch, best_eer = 1, float("inf")
    if args.resume:
        ck = torch.load(args.resume, map_location=device, weights_only=False)
        model.load_state_dict(ck["model"])
        optimizer.load_state_dict(ck["optimizer"])
        scaler.load_state_dict(ck["scaler"])
        start_epoch = ck["epoch"] + 1
        best_eer = ck.get("best_eer", best_eer)
        print(f"resumed from {args.resume} @ epoch {ck['epoch']} "
              f"(best dev EER {best_eer:.4f})")

    logger = CSVLogger(out_dir / "training_log.csv",
                       ["epoch", "train_loss", "dev_eer", "lr", "seconds"])

    def save(name: str, epoch: int, dev_eer: float, eer_threshold: float) -> None:
        torch.save(
            {
                "model": model.state_dict(),
                "optimizer": optimizer.state_dict(),
                "scaler": scaler.state_dict(),
                "epoch": epoch,
                "best_eer": best_eer,
                "dev_eer": dev_eer,
                "eer_threshold": eer_threshold,
                "config": {k: v for k, v in cfg.items() if not k.startswith("_")},
            },
            out_dir / name,
        )

    for epoch in range(start_epoch, tcfg["epochs"] + 1):
        t0 = time.time()
        model.train()
        running, seen = 0.0, 0
        pbar = tqdm(train_loader, desc=f"epoch {epoch}/{tcfg['epochs']}")
        for wav, label, _ in pbar:
            wav = wav.to(device, non_blocking=True)
            label = label.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, enabled=use_amp):
                logits = model(wav)
                loss = criterion(logits, label)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running += loss.item() * wav.size(0)
            seen += wav.size(0)
            pbar.set_postfix(loss=f"{running / seen:.4f}")

        scores, labels, _ = score_dataset(model, dev_loader, device, use_amp)
        dev_eer, thr = evaluate_eer(scores, labels)
        elapsed = time.time() - t0
        print(f"epoch {epoch}: train_loss={running/seen:.4f}  "
              f"dev_EER={dev_eer*100:.2f}%  ({elapsed:.0f}s)")
        logger.log({"epoch": epoch, "train_loss": f"{running/seen:.6f}",
                    "dev_eer": f"{dev_eer:.6f}",
                    "lr": optimizer.param_groups[0]["lr"],
                    "seconds": f"{elapsed:.1f}"})

        if dev_eer < best_eer:
            best_eer = dev_eer
            save("best.pt", epoch, dev_eer, thr)
            print(f"  ↳ new best (dev EER {dev_eer*100:.2f}%), saved best.pt")
        save("last.pt", epoch, dev_eer, thr)

    print(f"done. best dev EER: {best_eer*100:.2f}%  → {out_dir/'best.pt'}")


if __name__ == "__main__":
    main()
