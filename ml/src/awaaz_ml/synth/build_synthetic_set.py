"""Build the synthetic Hindi-English spoof set (the project's novel dataset).

Requires the synth extras and (realistically) a GPU:
    pip install -e .[synth]

Examples:
  # Apache-licensed default engine (commercial-safe):
  python -m awaaz_ml.synth.build_synthetic_set --engine parler ^
      --n 2000 --out-root data/synth_hi_en

  # Speaker-cloned spoofs from reference voices (RESEARCH-ONLY license):
  python -m awaaz_ml.synth.build_synthetic_set --engine xtts ^
      --n 1000 --out-root data/synth_hi_en_xtts ^
      --ref-dir data/bonafide_refs --accept-noncommercial

Output:
  out-root/flac/<utt>.flac
  out-root/protocol.txt      (ASVspoof 5-column format, key=spoof)
  out-root/manifest.tsv      (utt <TAB> lang <TAB> engine <TAB> text)

Add bonafide audio to the same root with ingest_bonafide.py, then verify with
awaaz_ml.data.verify. Skips already-synthesised utts, so it's resumable.
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

from tqdm import tqdm

from ..data.audio import save_flac_16k
from .engines import DEFAULT_DESCRIPTIONS, DESCRIPTIONS_HI, build_engine
from .templates import expand_templates

# hi and hi-en (code-switched) both get the model's native Hindi speakers;
# only pure-English sentences use the generic/English description pool.
_DESCRIPTIONS_BY_LANG = {
    "hi": DESCRIPTIONS_HI,
    "hi-en": DESCRIPTIONS_HI,
    "en": DEFAULT_DESCRIPTIONS,
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", choices=["parler", "xtts"], default="parler")
    ap.add_argument("--n", type=int, default=2000,
                    help="Number of sentences to synthesise")
    ap.add_argument("--out-root", type=Path, required=True)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--device", default="cuda", choices=["cuda", "cpu"])
    ap.add_argument("--ref-dir", type=Path, default=None,
                    help="[xtts] dir of reference speaker wav/flac files")
    ap.add_argument("--description", default=None,
                    help="[parler] fixed voice description "
                         "(default: rotate presets)")
    ap.add_argument("--accept-noncommercial", action="store_true",
                    help="[xtts] acknowledge CPML non-commercial license")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    sentences = expand_templates(args.n, seed=args.seed)
    engine = build_engine(args.engine, args.device, args.accept_noncommercial)

    refs: list[Path] = []
    if args.engine == "xtts":
        if not args.ref_dir:
            raise SystemExit("--ref-dir is required for --engine xtts")
        refs = sorted(
            list(args.ref_dir.glob("*.wav")) + list(args.ref_dir.glob("*.flac"))
        )
        if not refs:
            raise SystemExit(f"No wav/flac reference files in {args.ref_dir}")

    flac_dir = args.out_root / "flac"
    flac_dir.mkdir(parents=True, exist_ok=True)
    protocol_path = args.out_root / "protocol.txt"
    manifest_path = args.out_root / "manifest.tsv"

    done = {p.stem for p in flac_dir.glob("*.flac")}
    todo = [s for s in sentences if s.sid not in done]
    print(f"engine={engine.name}  total={len(sentences)}  "
          f"already-done={len(done)}  to-synthesise={len(todo)}")

    failures = 0
    with protocol_path.open("a", encoding="utf-8") as proto, \
         manifest_path.open("a", encoding="utf-8") as mani:
        for s in tqdm(todo, desc="synthesising"):
            try:
                if args.engine == "parler":
                    pool = _DESCRIPTIONS_BY_LANG.get(s.lang, DEFAULT_DESCRIPTIONS)
                    desc = args.description or rng.choice(pool)
                    wav = engine.synthesize(s.text, desc)
                else:
                    lang = "en" if s.lang == "en" else "hi"
                    wav = engine.synthesize(
                        s.text, reference_wav=rng.choice(refs), language=lang
                    )
                if wav.shape[0] < 8000:  # <0.5 s → synthesis glitch
                    raise ValueError("output too short")
                save_flac_16k(flac_dir / f"{s.sid}.flac", wav)
                proto.write(f"AWZSYN {s.sid} - {engine.name} spoof\n")
                mani.write(f"{s.sid}\t{s.lang}\t{engine.name}\t{s.text}\n")
                proto.flush(); mani.flush()
            except Exception as err:
                failures += 1
                tqdm.write(f"FAIL {s.sid}: {err}")

    print(f"done → {args.out_root}  (failures: {failures})")
    print("next: add bonafide with awaaz_ml.synth.ingest_bonafide, then "
          "verify with awaaz_ml.data.verify.")


if __name__ == "__main__":
    main()
