"""Ingest real (bonafide) audio into a dataset root: convert → 16 kHz mono
FLAC, append bonafide lines to the protocol.

Works on any folder of audio — e.g. Mozilla Common Voice Hindi/English clips
(CC0; download the hi and en clip archives from the Common Voice site), or
your own consented recordings. mp3/m4a/anything-ffmpeg-reads is fine.

Usage:
    python -m awaaz_ml.synth.ingest_bonafide --in-dir path/to/cv_hi/clips ^
        --out-root data/synth_hi_en --prefix CVHI --limit 3000
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

from tqdm import tqdm

from ..data.audio import load_audio, save_flac_16k

_EXTS = {".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aac", ".opus", ".wma"}


def _load_any(path: Path):
    """soundfile first; fall back to ffmpeg for mp3/m4a/etc."""
    try:
        return load_audio(path)
    except Exception:
        import shutil
        ff = shutil.which("ffmpeg")
        if ff is None:
            raise RuntimeError(f"Cannot decode {path.name} (no ffmpeg on PATH).")
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td) / "x.flac"
            r = subprocess.run(
                [ff, "-hide_banner", "-loglevel", "error", "-y",
                 "-i", str(path), "-ar", "16000", "-ac", "1", str(tmp)],
                capture_output=True, text=True,
            )
            if r.returncode != 0:
                raise RuntimeError(f"ffmpeg failed on {path.name}: "
                                   f"{r.stderr[-300:]}")
            return load_audio(tmp)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in-dir", type=Path, required=True)
    ap.add_argument("--out-root", type=Path, required=True,
                    help="Dataset root (protocol.txt appended, flac/ filled)")
    ap.add_argument("--prefix", default="BONA",
                    help="Utt-id prefix, e.g. CVHI / CVEN / OWN")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--min-seconds", type=float, default=1.0)
    args = ap.parse_args()

    files = sorted(p for p in args.in_dir.rglob("*")
                   if p.suffix.lower() in _EXTS)
    if args.limit:
        files = files[: args.limit]
    if not files:
        raise SystemExit(f"No audio files found under {args.in_dir}")

    flac_dir = args.out_root / "flac"
    flac_dir.mkdir(parents=True, exist_ok=True)
    protocol = args.out_root / "protocol.txt"

    kept, skipped = 0, 0
    with protocol.open("a", encoding="utf-8") as proto:
        for i, f in enumerate(tqdm(files, desc="ingesting bonafide")):
            utt = f"{args.prefix}_{i:06d}"
            dst = flac_dir / f"{utt}.flac"
            if dst.exists():
                kept += 1
                continue
            try:
                wav = _load_any(f)
            except Exception as err:
                skipped += 1
                tqdm.write(f"skip {f.name}: {err}")
                continue
            if wav.shape[0] < args.min_seconds * 16000:
                skipped += 1
                continue
            save_flac_16k(dst, wav)
            proto.write(f"{args.prefix} {utt} - - bonafide\n")
            kept += 1

    print(f"done: {kept} bonafide files in {args.out_root} "
          f"({skipped} skipped). Protocol: {protocol}")


if __name__ == "__main__":
    main()
