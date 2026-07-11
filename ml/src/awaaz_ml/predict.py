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
    max_batch: int = 1,
) -> np.ndarray:
    """Score a clip in ~`samples`-length windows; returns one score per window.

    Windows are run in mini-batches of at most `max_batch` so peak memory stays
    bounded regardless of clip length — a long clip is many windows, and
    stacking them all into a single forward pass OOM-kills a memory-capped
    serving process (Render's 512 MB tier 502s on anything past ~one window).
    The default of 1 matches the footprint of a single-window clip, which is
    known-safe there; raise it where memory allows for throughput. The model is
    in eval mode (BatchNorm uses running stats), so batching does not change any
    score — results are identical to a single stacked batch.
    """
    if wav.shape[0] <= samples:
        chunks = [pad_or_crop(wav, samples, random_crop=False)]
    else:
        hop = max(1, int(samples * hop_ratio))
        starts = list(range(0, wav.shape[0] - samples + 1, hop))
        if starts[-1] != wav.shape[0] - samples:
            starts.append(wav.shape[0] - samples)
        chunks = [wav[s : s + samples] for s in starts]
    out: list[np.ndarray] = []
    with torch.no_grad():
        for i in range(0, len(chunks), max(1, max_batch)):
            batch = torch.from_numpy(np.stack(chunks[i : i + max_batch])).to(device)
            logits = model(batch)
            out.append(RawNet2.scores_from_logits(logits.float()).cpu().numpy())
    return np.concatenate(out)


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
