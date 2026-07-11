"""Evaluate a checkpoint on the synthetic hi-en set with a per-LANGUAGE EER
breakdown (evaluate.py gives per-attack; here every spoof is one engine
'parler', so the useful cut is by language instead).

EER convention matches the rest of the project: a shared bonafide pool vs each
subset's spoof scores (same as evaluate.py's per-attack computation). Language
of a spoof comes from its utt id (AWZ_<lang>_NNNN, lang in hien/hi/en);
bonafide are the shared pool (CVHI Hindi + LS English).

Usage (from ml/):
    python -m awaaz_ml.eval_synth_lang --checkpoint runs/rawnet2_v3_hien/best.pt \
        --protocol data/synth_hi_en/synth_hi_en_test.protocol.txt \
        --audio-root data/synth_hi_en
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from .data.asvspoof import AudioListDataset, BONAFIDE, build_items, parse_protocol
from .evaluate import load_checkpoint
from .metrics import compute_eer
from .train import score_dataset
from .utils import get_device, worker_count

# utt-id language token (AWZ_<tok>_NNNN) -> reported language label
_SPOOF_LANG = {"hien": "hi-en", "hi": "hi", "en": "en"}
_LANG_ORDER = ["hi-en", "hi", "en"]


def spoof_language(utt: str) -> str | None:
    """hi-en / hi / en from an AWZ spoof utt id, else None (not an AWZ spoof)."""
    parts = utt.split("_")
    if len(parts) >= 3 and parts[0] == "AWZ":
        return _SPOOF_LANG.get(parts[1])
    return None


def evaluate_by_language(
    checkpoint: str | Path,
    protocol: Path,
    audio_root: Path,
    device=None,
    batch_size: int = 64,
    num_workers: int = 4,
) -> dict:
    """Return {'overall': eer, 'by_lang': {lang: eer}, 'n_bona': .., 'n_spoof': ..}."""
    device = get_device(device)
    model, ck = load_checkpoint(checkpoint, device)
    samples = int(ck["config"]["data"]["samples"])
    items = build_items([(protocol, audio_root)])
    ds = AudioListDataset(items, samples, mode="eval")
    nw = worker_count(num_workers)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=False,
                        num_workers=nw, pin_memory=(device.type == "cuda"))
    scores, labels, utts = score_dataset(model, loader, device, device.type == "cuda")

    bona = scores[labels == BONAFIDE]
    spoof_all = scores[labels != BONAFIDE]
    overall, _ = compute_eer(bona, spoof_all)

    # per-language: shared bonafide pool vs that language's spoofs
    lang_scores: dict[str, list[float]] = {l: [] for l in _LANG_ORDER}
    for u, s, l in zip(utts, scores, labels):
        if l != BONAFIDE:
            lang = spoof_language(u)
            if lang is not None:
                lang_scores[lang].append(float(s))
    by_lang = {
        l: compute_eer(bona, np.asarray(v))[0]
        for l, v in lang_scores.items() if v
    }
    return {
        "overall": overall,
        "by_lang": by_lang,
        "n_bona": int(bona.size),
        "n_spoof": int(spoof_all.size),
        "n_by_lang": {l: len(v) for l, v in lang_scores.items() if v},
        "checkpoint_epoch": ck.get("epoch"),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--protocol", required=True, type=Path)
    ap.add_argument("--audio-root", required=True, type=Path)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--device", default=None, choices=[None, "cuda", "cpu"])
    args = ap.parse_args()

    r = evaluate_by_language(args.checkpoint, args.protocol, args.audio_root,
                             args.device, args.batch_size, args.num_workers)
    print(f"checkpoint: {args.checkpoint} (epoch {r['checkpoint_epoch']})")
    print(f"  overall EER: {r['overall']*100:.2f}%  "
          f"(bona={r['n_bona']}, spoof={r['n_spoof']})")
    for lang in _LANG_ORDER:
        if lang in r["by_lang"]:
            print(f"    {lang:>6s}: {r['by_lang'][lang]*100:6.2f}%  "
                  f"(n={r['n_by_lang'][lang]})")


if __name__ == "__main__":
    main()
