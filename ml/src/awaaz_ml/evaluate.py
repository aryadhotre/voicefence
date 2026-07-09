"""Evaluate a checkpoint: overall EER, per-attack EER, optional codec sweep.

Examples (from ml/):
  # standard ASVspoof LA eval set
  python -m awaaz_ml.evaluate --checkpoint runs/rawnet2_baseline/best.pt ^
      --protocol <LA>/ASVspoof2019_LA_cm_protocols/ASVspoof2019.LA.cm.eval.trl.txt ^
      --audio-root <LA>/ASVspoof2019_LA_eval --out runs/rawnet2_baseline/eval_scores.txt

  # codec sweep: evaluate the same protocol against every codec variant dir
  python -m awaaz_ml.evaluate --checkpoint ... --protocol ... ^
      --sweep-dir data/codec_eval
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from .data.asvspoof import AudioListDataset, BONAFIDE, build_items, parse_protocol
from .metrics import compute_eer, write_scores
from .models.rawnet2 import build_model
from .train import score_dataset
from .utils import get_device, worker_count


def load_checkpoint(path: str | Path, device: torch.device):
    ck = torch.load(path, map_location=device, weights_only=False)
    model = build_model(ck["config"]["model"]).to(device)
    model.load_state_dict(ck["model"])
    model.eval()
    return model, ck


def eval_root(
    model, ck, protocol: Path, audio_root: Path, device, batch_size: int,
    num_workers: int, out: Path | None,
) -> tuple[float, dict[str, float]]:
    samples = int(ck["config"]["data"]["samples"])
    items = build_items([(protocol, audio_root)])
    ds = AudioListDataset(items, samples, mode="eval")
    nw = worker_count(num_workers)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=False,
                        num_workers=nw, pin_memory=(device.type == "cuda"))
    use_amp = device.type == "cuda"
    scores, labels, utts = score_dataset(model, loader, device, use_amp)

    bona = scores[labels == BONAFIDE]
    spoof = scores[labels != BONAFIDE]
    eer, _ = compute_eer(bona, spoof)

    # per-attack: bonafide pool vs each attack's spoof scores
    attack_of = {e.utt: e.attack for e in parse_protocol(protocol)}
    by_attack: dict[str, list[float]] = defaultdict(list)
    for u, s, l in zip(utts, scores, labels):
        if l != BONAFIDE:
            by_attack[attack_of[u]].append(float(s))
    per_attack = {
        a: compute_eer(bona, np.asarray(v))[0]
        for a, v in sorted(by_attack.items())
        if len(v) > 0
    }

    if out is not None:
        key = ["spoof", "bonafide"]
        write_scores(out, utts, scores, [key[int(l)] for l in labels])
    return eer, per_attack


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--protocol", required=True, type=Path)
    ap.add_argument("--audio-root", type=Path,
                    help="Audio root to evaluate (omit if using --sweep-dir only)")
    ap.add_argument("--sweep-dir", type=Path,
                    help="Parent dir; each child dir is a codec variant to evaluate")
    ap.add_argument("--out", type=Path, help="Score TSV path (for --audio-root run)")
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--device", default=None, choices=[None, "cuda", "cpu"])
    args = ap.parse_args()

    device = get_device(args.device)
    model, ck = load_checkpoint(args.checkpoint, device)
    print(f"checkpoint: {args.checkpoint} (epoch {ck['epoch']}, "
          f"dev EER {ck.get('dev_eer', float('nan'))*100:.2f}%)")

    if args.audio_root:
        eer, per_attack = eval_root(model, ck, args.protocol, args.audio_root,
                                    device, args.batch_size, args.num_workers,
                                    args.out)
        print(f"\n[{args.audio_root.name}] EER = {eer*100:.2f}%")
        for a, e in per_attack.items():
            print(f"    {a:>8s}: {e*100:6.2f}%")

    if args.sweep_dir:
        variants = sorted(p for p in args.sweep_dir.iterdir() if p.is_dir())
        if not variants:
            raise SystemExit(f"No variant dirs under {args.sweep_dir}")
        print(f"\ncodec sweep over {len(variants)} variants:")
        rows = []
        for v in variants:
            eer, _ = eval_root(model, ck, args.protocol, v, device,
                               args.batch_size, args.num_workers, None)
            rows.append((v.name, eer))
            print(f"    {v.name:>12s}: EER = {eer*100:6.2f}%")
        worst = max(rows, key=lambda r: r[1])
        print(f"\nworst codec: {worst[0]} ({worst[1]*100:.2f}%)")


if __name__ == "__main__":
    main()
