"""Audio IO: decode → mono float32 @ 16 kHz, and fixed-length pad/crop.

Uses soundfile (libsndfile: flac/wav/ogg) + soxr for high-quality resampling.
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr

TARGET_SR = 16_000


def load_audio(path: str | Path, target_sr: int = TARGET_SR) -> np.ndarray:
    """Load any libsndfile-readable audio as mono float32 at target_sr."""
    path = Path(path)
    x, sr = sf.read(str(path), dtype="float32", always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if x.size == 0:
        raise ValueError(f"Empty audio file: {path}")
    if sr != target_sr:
        x = soxr.resample(x, sr, target_sr).astype(np.float32, copy=False)
    return np.ascontiguousarray(x, dtype=np.float32)


def pad_or_crop(x: np.ndarray, num_samples: int, random_crop: bool) -> np.ndarray:
    """Return exactly num_samples: random/left crop if long, tile-pad if short.

    Tile-padding (repeat the clip) is the standard anti-spoofing convention —
    it preserves the spectral character of short utterances better than
    zero-padding.
    """
    n = x.shape[0]
    if n >= num_samples:
        start = random.randint(0, n - num_samples) if random_crop else 0
        return x[start : start + num_samples]
    reps = int(np.ceil(num_samples / n))
    return np.tile(x, reps)[:num_samples]


def save_flac_16k(path: str | Path, x: np.ndarray, sr: int = TARGET_SR) -> None:
    """Write mono float32 audio as 16-bit FLAC (the project's storage format)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(x, -1.0, 1.0)
    sf.write(str(path), x, sr, subtype="PCM_16", format="FLAC")
