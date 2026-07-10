"""Deterministic, stratified train/test split of the synthetic hi-en set.

The synthetic set (`data/synth_hi_en/protocol.txt`) is one pool of 6,000
utterances — 2,000 `parler` spoofs (1,000 hi-en / 500 hi / 500 en) and 4,000
bonafide (2,000 Common Voice Hindi + 2,000 LibriSpeech English). It was
*evaluated* whole by `rawnet2_codecaug`, so to fold it into training without
inflating a later eval number we carve out a held-out test split that never
enters training.

Split discipline:
  * 80% train / 20% test (configurable).
  * STRATIFIED by (label, language) so the held-out test set has proportional
    representation of every cell, not a random skew. Strata:
        spoof/hi-en, spoof/hi, spoof/en, bonafide/hi (CVHI), bonafide/en (LS)
  * Deterministic: within each stratum, entries are sorted by utt id then
    shuffled with a seeded RNG, so the same seed always yields the same split
    on any machine.

Language source:
  * spoofs: the `lang` column of `manifest.tsv` (hi-en / hi / en).
  * bonafide: derived from the utt-id prefix — CVHI -> hi, LS -> en (bonafide
    utterances are not in the manifest).

Output: two protocol files referencing the SAME audio files (utt ids only are
partitioned; no flac is moved or duplicated).

Usage (from ml/):
    python -m awaaz_ml.data.split_synth --root data/synth_hi_en
"""

from __future__ import annotations

import argparse
import random
from collections import defaultdict
from pathlib import Path

from .asvspoof import parse_protocol

# bonafide utt-id prefix -> language (bonafide isn't in manifest.tsv)
_BONAFIDE_LANG = {"CVHI": "hi", "LS": "en"}


def load_manifest_lang(manifest: Path) -> dict[str, str]:
    """utt_id -> language, from manifest.tsv (columns: utt, lang, system, text)."""
    lang: dict[str, str] = {}
    with Path(manifest).open("r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                raise ValueError(f"{manifest}:{lineno}: expected >=2 tab cols: {line!r}")
            lang[parts[0]] = parts[1]
    return lang


def language_of(utt: str, key: str, manifest_lang: dict[str, str]) -> str:
    """Language label used for stratification / per-language eval."""
    if key == "spoof":
        try:
            return manifest_lang[utt]
        except KeyError:
            raise KeyError(f"spoof utt {utt!r} missing from manifest.tsv") from None
    prefix = utt.split("_", 1)[0]
    try:
        return _BONAFIDE_LANG[prefix]
    except KeyError:
        raise KeyError(f"bonafide utt {utt!r}: unknown prefix {prefix!r}") from None


def stratified_split(
    protocol: Path,
    manifest: Path,
    test_frac: float,
    seed: int,
) -> tuple[list[str], list[str], dict]:
    """Return (train_utts, test_utts, report) partitioned by (label, language).

    Deterministic given `seed`: entries are sorted by utt within each stratum,
    then shuffled with a seeded RNG before the fractional cut.
    """
    entries = parse_protocol(protocol)
    manifest_lang = load_manifest_lang(manifest)

    strata: dict[tuple[str, str], list[str]] = defaultdict(list)
    for e in entries:
        lang = language_of(e.utt, e.key, manifest_lang)
        strata[(e.key, lang)].append(e.utt)

    rng = random.Random(seed)
    train: list[str] = []
    test: list[str] = []
    report: dict[tuple[str, str], tuple[int, int, int]] = {}
    for stratum in sorted(strata):
        utts = sorted(strata[stratum])  # stable base order, platform-independent
        rng.shuffle(utts)
        n = len(utts)
        n_test = round(n * test_frac)
        test_part = utts[:n_test]
        train_part = utts[n_test:]
        test.extend(test_part)
        train.extend(train_part)
        report[stratum] = (n, len(train_part), len(test_part))

    return sorted(train), sorted(test), report


def write_split_protocol(src_protocol: Path, utts: set[str], out: Path) -> int:
    """Write the subset of `src_protocol`'s lines whose utt id is in `utts`."""
    written = 0
    with Path(src_protocol).open("r", encoding="utf-8") as f, \
            Path(out).open("w", encoding="utf-8") as g:
        for line in f:
            s = line.strip()
            if not s:
                continue
            utt = s.split()[1]
            if utt in utts:
                g.write(line if line.endswith("\n") else line + "\n")
                written += 1
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", type=Path, default=Path("data/synth_hi_en"),
                    help="Dir holding protocol.txt + manifest.tsv")
    ap.add_argument("--protocol", type=Path, default=None,
                    help="Override protocol path (default <root>/protocol.txt)")
    ap.add_argument("--manifest", type=Path, default=None,
                    help="Override manifest path (default <root>/manifest.tsv)")
    ap.add_argument("--test-frac", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=1234)
    args = ap.parse_args()

    protocol = args.protocol or (args.root / "protocol.txt")
    manifest = args.manifest or (args.root / "manifest.tsv")
    train_out = args.root / "synth_hi_en_train.protocol.txt"
    test_out = args.root / "synth_hi_en_test.protocol.txt"

    train_utts, test_utts, report = stratified_split(
        protocol, manifest, args.test_frac, args.seed
    )

    # sanity: partition is disjoint and total
    assert set(train_utts).isdisjoint(test_utts), "train/test overlap!"
    total = len(train_utts) + len(test_utts)

    n_train = write_split_protocol(protocol, set(train_utts), train_out)
    n_test = write_split_protocol(protocol, set(test_utts), test_out)

    print(f"stratified split (seed={args.seed}, test_frac={args.test_frac})")
    print(f"{'stratum':>22}  {'total':>6} {'train':>6} {'test':>6}")
    for stratum in sorted(report):
        n, ntr, nte = report[stratum]
        label = f"{stratum[0]}/{stratum[1]}"
        print(f"{label:>22}  {n:6d} {ntr:6d} {nte:6d}")
    print(f"{'TOTAL':>22}  {total:6d} {len(train_utts):6d} {len(test_utts):6d}")
    print()
    print(f"wrote {n_train} lines -> {train_out}")
    print(f"wrote {n_test} lines -> {test_out}")

    assert n_train == len(train_utts) and n_test == len(test_utts), \
        "line count != utt count (duplicate utt ids in protocol?)"


if __name__ == "__main__":
    main()
