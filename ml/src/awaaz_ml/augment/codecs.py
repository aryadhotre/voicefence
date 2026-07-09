"""Telephony/VoIP codec augmentation via ffmpeg.

Simulates the real transmission chain of scam-call audio:
    16 kHz source → narrowband resample → lossy speech codec → decode → 16 kHz

Codecs (auto-probed; unavailable ones are skipped with a warning):
    amr475 / amr122  AMR-NB @ 4.75 / 12.2 kbps  (2G/3G voice; needs
                     libopencore_amrnb — included in full ffmpeg builds,
                     e.g. gyan.dev on Windows)
    gsm              GSM full-rate 13 kbps      (needs libgsm)
    opus6k / opus12k Opus VoIP @ 6 / 12 kbps    (WhatsApp-class VoIP; libopus)
    mulaw            G.711 µ-law @ 8 kHz        (landline/PSTN; always available)

Batch CLI:
    python -m awaaz_ml.augment.codecs --protocol <p> --audio-root <r> ^
        --out-root data/codec_train --codecs opus6k amr475 mulaw --workers 8

Output layout: out-root/<codec>/flac/<utt>.flac — same utt ids as the source,
so the SAME protocol file drives training/eval on augmented copies.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from tqdm import tqdm

from ..data.asvspoof import parse_protocol, resolve_audio


@dataclass(frozen=True)
class CodecSpec:
    name: str
    encoder: str            # ffmpeg encoder name to probe
    encode_args: tuple[str, ...]
    ext: str                # container extension for the encoded temp file
    mux_args: tuple[str, ...] = ()   # extra output-format args (e.g. -f gsm)


CODECS: dict[str, CodecSpec] = {
    "amr475": CodecSpec(
        "amr475", "libopencore_amrnb",
        ("-ar", "8000", "-ac", "1", "-c:a", "libopencore_amrnb", "-b:a", "4.75k"),
        ".amr",
    ),
    "amr122": CodecSpec(
        "amr122", "libopencore_amrnb",
        ("-ar", "8000", "-ac", "1", "-c:a", "libopencore_amrnb", "-b:a", "12.2k"),
        ".amr",
    ),
    "gsm": CodecSpec(
        "gsm", "libgsm",
        ("-ar", "8000", "-ac", "1", "-c:a", "libgsm"),
        ".gsm", ("-f", "gsm"),
    ),
    "opus6k": CodecSpec(
        "opus6k", "libopus",
        ("-ar", "16000", "-ac", "1", "-c:a", "libopus",
         "-b:a", "6k", "-application", "voip"),
        ".ogg",
    ),
    "opus12k": CodecSpec(
        "opus12k", "libopus",
        ("-ar", "16000", "-ac", "1", "-c:a", "libopus",
         "-b:a", "12k", "-application", "voip"),
        ".ogg",
    ),
    "mulaw": CodecSpec(
        "mulaw", "pcm_mulaw",
        ("-ar", "8000", "-ac", "1", "-c:a", "pcm_mulaw"),
        ".wav",
    ),
}


def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe is None:
        raise RuntimeError(
            "ffmpeg not found on PATH. Windows: `winget install Gyan.FFmpeg` "
            "(full build; includes AMR + GSM encoders), then reopen the "
            "terminal."
        )
    return exe


@lru_cache(maxsize=1)
def probe_encoders() -> frozenset[str]:
    out = subprocess.run(
        [_ffmpeg(), "-hide_banner", "-encoders"],
        capture_output=True, text=True, check=True,
    ).stdout
    names = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0] and parts[0][0] in "AVS.":
            names.add(parts[1])
    return frozenset(names)


def available_codecs(requested: list[str] | None = None) -> list[CodecSpec]:
    encs = probe_encoders()
    names = requested or list(CODECS)
    specs: list[CodecSpec] = []
    for n in names:
        if n not in CODECS:
            raise ValueError(f"Unknown codec {n!r}. Known: {sorted(CODECS)}")
        spec = CODECS[n]
        if spec.encoder in encs:
            specs.append(spec)
        else:
            warnings.warn(
                f"Skipping codec {n!r}: ffmpeg encoder {spec.encoder!r} not in "
                f"this build. On Windows install the full build "
                f"(winget install Gyan.FFmpeg)."
            )
    if not specs:
        raise RuntimeError("None of the requested codecs are available.")
    return specs


def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed ({' '.join(cmd[:6])} …):\n{r.stderr[-800:]}"
        )


def apply_codec(in_path: str | Path, spec: CodecSpec, out_path: str | Path) -> None:
    """in_path (any decodable audio) → codec round-trip → out_path (.flac 16k)."""
    in_path, out_path = Path(in_path), Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ff = _ffmpeg()
    with tempfile.TemporaryDirectory() as td:
        enc = Path(td) / f"enc{spec.ext}"
        _run([ff, "-hide_banner", "-loglevel", "error", "-y",
              "-i", str(in_path), *spec.encode_args, *spec.mux_args, str(enc)])
        _run([ff, "-hide_banner", "-loglevel", "error", "-y",
              *spec.mux_args, "-i", str(enc), "-ar", "16000", "-ac", "1", str(out_path)])


def build_codec_set(
    protocol: Path,
    audio_root: Path,
    out_root: Path,
    codec_names: list[str],
    workers: int = 8,
    limit: int | None = None,
    overwrite: bool = False,
) -> None:
    specs = available_codecs(codec_names)
    entries = parse_protocol(protocol)
    if limit:
        entries = entries[:limit]

    jobs: list[tuple[Path, CodecSpec, Path]] = []
    missing = 0
    for e in entries:
        src = resolve_audio(audio_root, e.utt)
        if src is None:
            missing += 1
            continue
        for spec in specs:
            dst = out_root / spec.name / "flac" / f"{e.utt}.flac"
            if overwrite or not dst.exists():
                jobs.append((src, spec, dst))
    if missing:
        warnings.warn(f"{missing} utterances missing under {audio_root}; skipped.")
    print(f"codecs: {[s.name for s in specs]} | {len(jobs)} encode jobs "
          f"({len(entries)-missing} utts) → {out_root}")

    failures = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(apply_codec, s, spec, d): (s, spec.name)
                for s, spec, d in jobs}
        for fut in tqdm(as_completed(futs), total=len(futs), desc="encoding"):
            try:
                fut.result()
            except Exception as err:  # keep going; report at end
                failures += 1
                src, cname = futs[fut]
                tqdm.write(f"FAIL [{cname}] {src.name}: {err}")
    if failures:
        raise SystemExit(f"{failures} encode jobs failed — see messages above.")
    print("done. Point extra_train_sources / --sweep-dir at "
          f"{out_root}/<codec> with the same protocol file.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--protocol", required=True, type=Path)
    ap.add_argument("--audio-root", required=True, type=Path)
    ap.add_argument("--out-root", required=True, type=Path)
    ap.add_argument("--codecs", nargs="+", default=list(CODECS),
                    help=f"Subset of {sorted(CODECS)}")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=None,
                    help="Only first N protocol entries (quick tests)")
    ap.add_argument("--overwrite", action="store_true")
    args = ap.parse_args()
    build_codec_set(args.protocol, args.audio_root, args.out_root,
                    args.codecs, args.workers, args.limit, args.overwrite)


if __name__ == "__main__":
    main()
