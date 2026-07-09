"""Score a single audio file against a trained checkpoint.

Usage:
    python -m awaaz_ml.predict --checkpoint runs/rawnet2_baseline/best.pt ^
        --audio path/to/voice_note.ogg

Long files are scored in overlapping windows; the reported score is the
minimum window score (a clip is suspicious if ANY window looks synthetic)
alongside the mean.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch

from .data.audio import load_audio, pad_or_crop
from .evaluate import load_checkpoint
from .models.rawnet2 import RawNet2
from .utils import get_device


def window_scores(
    model: RawNet2,
    wav: np.ndarray,
    samples: int,
    device: torch.device,
    hop_ratio: float = 0.5,
) -> np.ndarray:
    if wav.shape[0] <= samples:
        chunks = [pad_or_crop(wav, samples, random_crop=False)]
    else:
        hop = max(1, int(samples * hop_ratio))
        starts = list(range(0, wav.shape[0] - samples + 1, hop))
        if starts[-1] != wav.shape[0] - samples:
            starts.append(wav.shape[0] - samples)
        chunks = [wav[s : s + samples] for s in starts]
    batch = torch.from_numpy(np.stack(chunks)).to(device)
    with torch.no_grad():
        logits = model(batch)
    return RawNet2.scores_from_logits(logits.float()).cpu().numpy()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--audio", required=True, type=Path)
    ap.add_argument("--device", default=None, choices=[None, "cuda", "cpu"])
    args = ap.parse_args()

    device = get_device(args.device)
    model, ck = load_checkpoint(args.checkpoint, device)
    samples = int(ck["config"]["data"]["samples"])
    threshold = float(ck.get("eer_threshold", 0.0))

    wav = load_audio(args.audio)
    scores = window_scores(model, wav, samples, device)
    s_min, s_mean = float(scores.min()), float(scores.mean())
    verdict = "bonafide-like" if s_min >= threshold else "SPOOF-LIKE"

    print(f"file        : {args.audio}")
    print(f"duration    : {wav.shape[0]/16000:.2f}s  windows: {len(scores)}")
    print(f"score (min) : {s_min:+.3f}   score (mean): {s_mean:+.3f}")
    print(f"threshold   : {threshold:+.3f}  (dev-set EER operating point)")
    print(f"verdict     : {verdict}")
    print("note: probabilistic signal, not a guarantee — use alongside "
          "verification steps (call back on a known number, ask an "
          "unscripted question).")


if __name__ == "__main__":
    main()
