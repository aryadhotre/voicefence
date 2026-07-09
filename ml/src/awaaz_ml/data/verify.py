"""Verify a dataset: parse protocol, report label/attack counts, spot-check audio.

Usage:
    python -m awaaz_ml.data.verify --asvspoof-root D:/datasets/ASVspoof2019/LA
    python -m awaaz_ml.data.verify --protocol p.txt --audio-root ./data/synth_hi_en
"""

from __future__ import annotations

import argparse
import random
from collections import Counter
from pathlib import Path

from .asvspoof import asvspoof_la_paths, parse_protocol, resolve_audio
from .audio import load_audio


def check_one(name: str, protocol: Path, audio_root: Path, sample_n: int) -> None:
    print(f"\n=== {name} ===")
    print(f"protocol : {protocol}")
    print(f"audio    : {audio_root}")
    if not protocol.is_file():
        print("  !! protocol file MISSING")
        return
    entries = parse_protocol(protocol)
    keys = Counter(e.key for e in entries)
    attacks = Counter(e.attack for e in entries if e.key == "spoof")
    print(f"  utterances: {len(entries)}  "
          f"(bonafide={keys.get('bonafide', 0)}, spoof={keys.get('spoof', 0)})")
    if attacks:
        print(f"  attacks   : {dict(sorted(attacks.items()))}")

    sample = random.sample(entries, min(sample_n, len(entries)))
    missing, unreadable = 0, 0
    for e in sample:
        p = resolve_audio(audio_root, e.utt)
        if p is None:
            missing += 1
            continue
        try:
            load_audio(p)
        except Exception:
            unreadable += 1
    print(f"  spot-check {len(sample)} files: "
          f"{missing} missing, {unreadable} unreadable")
    if missing or unreadable:
        print("  !! fix paths / re-download before training")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--asvspoof-root", type=Path,
                    help="ASVspoof2019 LA directory (contains "
                         "ASVspoof2019_LA_train etc.)")
    ap.add_argument("--protocol", type=Path, help="Standalone protocol file")
    ap.add_argument("--audio-root", type=Path, help="Audio root for --protocol")
    ap.add_argument("--sample", type=int, default=50,
                    help="Files to spot-check per split")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    random.seed(args.seed)

    if args.asvspoof_root:
        for split, paths in asvspoof_la_paths(args.asvspoof_root).items():
            check_one(f"ASVspoof LA {split}", paths["protocol"],
                      paths["audio_root"], args.sample)
    if args.protocol:
        if not args.audio_root:
            raise SystemExit("--audio-root is required with --protocol")
        check_one("custom", args.protocol, args.audio_root, args.sample)
    if not args.asvspoof_root and not args.protocol:
        raise SystemExit("Provide --asvspoof-root and/or --protocol.")


if __name__ == "__main__":
    main()
