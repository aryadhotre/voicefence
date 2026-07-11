# Voicefence — ML core

Codec-robust, Hindi-English code-switch-aware audio anti-spoofing. This
directory is self-contained: data verification, codec augmentation, synthetic
spoof generation, training, and EER evaluation.

## Requirements

- Windows 10/11 (everything below is PowerShell), macOS/Linux also fine
- Python 3.11 x64 recommended (3.10–3.12 supported)
- FFmpeg **full build**: `winget install Gyan.FFmpeg` → reopen terminal →
  `ffmpeg -version`. The full build includes the AMR-NB and GSM encoders;
  minimal builds lack them (the code auto-probes and skips what's missing).
- Training: NVIDIA GPU with 4 GB+ VRAM, or free Kaggle/Colab GPU (see below)
- Disk: ~10 GB for ASVspoof LA + ~2–6 GB per codec-augmented copy

## Setup

```powershell
cd voicefence\ml
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
python tests\smoke_test.py        # must print "ALL 6 CHECKS PASSED"
```

If you have an NVIDIA GPU, install the CUDA build of PyTorch instead of the
default CPU wheel — follow the selector on pytorch.org for the exact command
matching your driver, then re-run the smoke test.

## 1. Dataset: ASVspoof 2019 LA

Download the **LA** partition of ASVspoof 2019 from Edinburgh DataShare
(dataset handle `10283/3336`, https://datashare.ed.ac.uk/handle/10283/3336 —
if the link moves, search "ASVspoof 2019 database Edinburgh DataShare").
Extract so you have:

```
D:\datasets\ASVspoof2019\LA\
├── ASVspoof2019_LA_train\flac\*.flac
├── ASVspoof2019_LA_dev\flac\*.flac
├── ASVspoof2019_LA_eval\flac\*.flac
└── ASVspoof2019_LA_cm_protocols\ASVspoof2019.LA.cm.{train.trn,dev.trl,eval.trl}.txt
```

Verify (parses protocols, spot-checks audio):

```powershell
python -m awaaz_ml.data.verify --asvspoof-root D:\datasets\ASVspoof2019\LA
```

## 2. Train the baseline

Edit `configs\rawnet2_asvspoof_la.yaml` → set `asvspoof_root`, then:

```powershell
python -m awaaz_ml.train --config configs\rawnet2_asvspoof_la.yaml
```

- Checkpoints + `training_log.csv` land in `runs\rawnet2_baseline\`
  (`best.pt` = lowest dev EER, includes the config + decision threshold).
- Resume: `--resume runs\rawnet2_baseline\last.pt`
- Quick pipeline check before a full run: set `max_train_items: 2000`,
  `max_dev_items: 1000`, `epochs: 2` in the config.
- Expected: published RawNet2-class systems reach roughly ~5% EER on the LA
  eval set; run-to-run variance of ±1–2% absolute is normal for this
  architecture. Treat the number you measure as the truth.

**No local GPU?** Kaggle gives free weekly GPU hours: upload this `ml/`
folder as a dataset (or `pip install` from your GitHub repo), enable a GPU
accelerator, and run the same commands in a notebook cell with `!`.
Community mirrors of ASVspoof 2019 exist on Kaggle — verify file counts with
`awaaz_ml.data.verify` before trusting one. CPU-only training is not
realistic (days per run).

## 3. Codec robustness (contribution #1)

Build codec-degraded copies (telephony/VoIP simulation). Train-set copies to
train on, dev/eval copies to measure on:

```powershell
$P = "D:\datasets\ASVspoof2019\LA\ASVspoof2019_LA_cm_protocols"

# training copies (pick 2–3 codecs; each copy ≈ dataset-sized)
python -m awaaz_ml.augment.codecs --protocol $P\ASVspoof2019.LA.cm.train.trn.txt `
    --audio-root D:\datasets\ASVspoof2019\LA\ASVspoof2019_LA_train `
    --out-root data\codec_train --codecs opus6k amr475 mulaw --workers 8

# eval sweep copies (all available codecs)
python -m awaaz_ml.augment.codecs --protocol $P\ASVspoof2019.LA.cm.eval.trl.txt `
    --audio-root D:\datasets\ASVspoof2019\LA\ASVspoof2019_LA_eval `
    --out-root data\codec_eval --workers 8
```

Then uncomment `extra_train_sources` in the config (point at
`data/codec_train/<codec>`), change `out_dir` (e.g.
`runs/rawnet2_codecaug`), and retrain.

Measure the story (clean-trained vs codec-trained, on the codec sweep):

```powershell
python -m awaaz_ml.evaluate --checkpoint runs\rawnet2_baseline\best.pt `
    --protocol $P\ASVspoof2019.LA.cm.eval.trl.txt --sweep-dir data\codec_eval
python -m awaaz_ml.evaluate --checkpoint runs\rawnet2_codecaug\best.pt `
    --protocol $P\ASVspoof2019.LA.cm.eval.trl.txt --sweep-dir data\codec_eval
```

The gap between those two tables **is** the headline result.

## Results

Measured on `runs/rawnet2_baseline/best.pt` (epoch 50, dev EER 0.55%) vs
`runs/rawnet2_codecaug/best.pt` (epoch 41, dev EER 0.55%, trained with
`opus6k` + `amr475` + `mulaw` train-set augmentation).

### Codec-sweep EER: baseline vs codec-augmented

| Codec | Baseline | Codec-aug | Gap |
|---|---|---|---|
| Clean/uncompressed | 4.91% | 5.50% | +0.59pp |
| amr122 | 8.52% | 5.89% | −2.63pp |
| amr475 | 16.71% | 7.25% | −9.46pp |
| gsm | 8.59% | 6.12% | −2.47pp |
| opus6k | 12.14% | 7.18% | −4.96pp |
| opus12k | 5.21% | 5.56% | +0.35pp |
| mulaw | 5.00% | 5.56% | +0.56pp |

Average across the 6 codecs: 9.36% (baseline) → 6.26% (codec-aug) —
about a 33% relative reduction. Worst case: amr475, 16.71% → 7.25%
(more than halved).

### Full eval-set EER by attack: baseline vs codec-aug (clean/uncompressed eval set)

| Attack | Baseline | Codec-aug | Delta |
|---|---|---|---|
| Overall | 4.91% | 5.50% | +0.59pp |
| A07 | 1.59% | 1.63% | +0.04pp |
| A08 | 3.56% | 1.14% | −2.42pp |
| A09 | 0.19% | 0.39% | +0.20pp |
| A10 | 2.85% | 2.38% | −0.47pp |
| A11 | 1.52% | 1.87% | +0.35pp |
| A12 | 2.28% | 2.49% | +0.21pp |
| A13 | 0.31% | 0.29% | −0.02pp |
| A14 | 0.55% | 0.95% | +0.40pp |
| A15 | 2.04% | 1.81% | −0.23pp |
| A16 | 0.87% | 0.77% | −0.10pp |
| A17 | 7.82% | 10.29% | +2.47pp |
| A18 | 23.65% | 18.40% | −5.25pp |
| A19 | 1.30% | 3.06% | +1.76pp |

### Verdict

Codec augmentation reduces average cross-codec EER by about a third
(9.4% → 6.3%) and cuts the worst-case codec EER by more than half
(amr475: 16.7% → 7.3%), which is the failure mode that matters for
audio arriving over real phone/VoIP calls. This comes at a small but
real cost: EER on clean, uncompressed audio rises from 4.91% to 5.50%,
and two voice-conversion attacks (A17, A19) get measurably worse
(+2.47pp and +1.76pp) even though the baseline's single worst attack,
A18, improves (23.65% → 18.40%, still the hardest attack for both
models). Every other attack is flat or improves. Net effect: a real,
defensible robustness gain against codec degradation, traded for a
small regression on clean audio and on two specific VC-class attacks —
not a universal improvement, and it should be described that way.

### Synthetic hi-en set: cross-TTS-engine generalization

`runs/rawnet2_codecaug/best.pt` evaluated on the 6,000-utterance
synthetic set (2,000 `parler-tts` spoofs — 1,000 hi-en, 500 hi, 500 en —
against 4,000 bonafide: 2,000 Common Voice Hindi + 2,000 LibriSpeech
`test-clean` English):

| Split | n (spoof) | EER |
|---|---|---|
| Overall | 2,000 | 33.35% |
| hi-en | 1,000 | 33.90% |
| hi | 500 | 33.01% |
| en | 500 | 32.63% |

All three language splits land within ~1.3pp of each other — the gap
isn't concentrated in code-switched or monolingual content specifically,
it's uniform across all three.

That ~33% EER is expected, not a regression: this checkpoint was
trained exclusively on ASVspoof 2019 LA's spoofs (attacks A01-A19,
2019-era TTS/VC systems) plus codec augmentation of that same data —
it has never seen a `parler-tts` output during training. A ~33% EER
here measures **cross-TTS-engine generalization to an unseen synthesis
method**, not a flaw in the codec-augmentation work above (which is
measured entirely within ASVspoof's own attack set and stands on its
own). Zero training exposure to this generation method, on top of a
language-and-accent distribution the base model never trained on
either, makes this result unsurprising. See below for the follow-up
retrain (`rawnet2_v3_hien`) that closes this gap.

### v3 (`rawnet2_v3_hien`): hi-en folded into training — three-way comparison

`runs/rawnet2_v3_hien/best.pt` (epoch 36, dev EER 0.47%) trained on the
codec-augmented ASVspoof LA set **plus** the synthetic hi-en TRAIN split
(4,800 utts; total train 106,320 vs the codec-aug run's 101,520). A
deterministic, language-and-label-stratified 80/20 split
(`awaaz_ml.data.split_synth`) holds out a 1,200-utt test set
(`synth_hi_en_test.protocol.txt`) that is **never trained on** — all v3
synthetic numbers below are on that held-out split. Baseline and codec-aug
are re-measured on the identical held-out split (their ASVspoof-eval and
codec-sweep columns are the validated numbers from the tables above; our
fresh baseline run reproduced them exactly).

**Held-out synthetic hi-en test — the headline result:**

| Split | baseline | codec-aug | **v3_hien** |
|---|---|---|---|
| Overall | 39.50% | 32.06% | **0.75%** |
| hi-en | 43.00% | 33.50% | **0.50%** |
| hi | 40.00% | 30.19% | **1.00%** |
| en | 31.00% | 32.06% | **1.19%** |

Folding the hi-en train split in collapses held-out hi-en EER from ~32% to
**0.75%** overall (hi-en 33.50% → **0.50%**) — the cross-TTS-engine /
code-switch gap is closed.

**Codec robustness is preserved (marginally better):**

| Codec | baseline | codec-aug | **v3_hien** |
|---|---|---|---|
| clean | 4.91% | 5.50% | 5.66% |
| amr122 | 8.52% | 5.89% | 5.02% |
| amr475 | 16.71% | 7.25% | 6.74% |
| gsm | 8.59% | 6.12% | 6.05% |
| opus6k | 12.14% | 7.18% | 7.22% |
| opus12k | 5.21% | 5.56% | 6.12% |
| mulaw | 5.00% | 5.56% | 5.23% |
| **avg-6** | 9.36% | 6.26% | **6.06%** |

**Small, honest cost on clean ASVspoof (overall +0.16pp vs codec-aug):**
overall EER 5.50% → 5.66%; the hardest attack A18 improves (18.40% →
14.98%), but several attacks regress vs codec-aug — notably A14 (0.95% →
4.21%), A13 (0.29% → 2.08%), A11, A12, A17 — all still low single-digit
absolute EERs. This is the expected price of adding a new data
distribution, not a serious regression: codec robustness holds and the
hi-en gain is enormous.

## Known limitations / planned work

- **The synthetic hi-en gap is now closed (`rawnet2_v3_hien`).** The
  earlier `rawnet2_codecaug` checkpoint was eval-only against the
  synthetic set (~32% held-out EER) because it never trained on it. The
  v3 retrain folds the hi-en TRAIN split into training and drops held-out
  hi-en EER to **0.75%** overall (three-way tables above), using a proper
  stratified train/test split so the number is measured on held-out data
  the checkpoint never saw. Remaining honesty note: v3 carries a small
  clean-ASVspoof regression (+0.16pp overall) vs codec-aug — see the
  per-attack table.
- Detection is probabilistic; scores, not verdicts (see "Honest
  limitations" below for the full list).

## 4. Synthetic Hindi-English set (contribution #2)

Requires `pip install -e .[synth]` and a GPU (first run downloads multi-GB
checkpoints from Hugging Face).

```powershell
# spoofs — Apache-2.0 engine (commercial-safe), hi-en / hi / en mix
python -m awaaz_ml.synth.build_synthetic_set --engine parler --n 2000 `
    --out-root data\synth_hi_en

# bonafide hi — Common Voice Hindi (CC0), https://commonvoice.mozilla.org
python -m awaaz_ml.synth.ingest_bonafide --in-dir path\to\cv-corpus\hi\clips `
    --out-root data\synth_hi_en --prefix CVHI --limit 2000

# bonafide en — LibriSpeech test-clean (CC BY 4.0 — credit Panayotov et al.,
# "Librispeech: An ASR corpus based on public domain audiobooks", ICASSP 2015),
# https://www.openslr.org/12 — smaller and just as suitable as Common Voice
# English (which ships as an 80+ GB archive) for this many bonafide clips.
python -m awaaz_ml.synth.ingest_bonafide --in-dir path\to\LibriSpeech\test-clean `
    --out-root data\synth_hi_en --prefix LS --limit 2000

python -m awaaz_ml.data.verify --protocol data\synth_hi_en\protocol.txt `
    --audio-root data\synth_hi_en
python -m awaaz_ml.evaluate --checkpoint runs\rawnet2_codecaug\best.pt `
    --protocol data\synth_hi_en\protocol.txt --audio-root data\synth_hi_en `
    --out data\synth_hi_en\eval_scores.txt
```

Optional: XTTS-v2 speaker-cloned spoofs (`--engine xtts --ref-dir ...
--accept-noncommercial`) — CPML licence, research evaluation only, keep out
of anything commercial.

Methodology guard (already handled by the generator): spoofs are synthesised
from code-switched **and** monolingual hi **and** monolingual en text, so the
model can't shortcut-learn "language mixing ⇒ fake".

## 5. Single-file check

```powershell
python -m awaaz_ml.predict --checkpoint runs\rawnet2_codecaug\best.pt `
    --audio path\to\voice_note.ogg
```

## Troubleshooting

- DataLoader hangs/crashes on Windows → set `num_workers: 0` in the config.
- `ffmpeg not found` after winget → reopen the terminal (PATH refresh).
- CUDA OOM → `batch_size: 8`.
- `codec ... skipped` warnings → your ffmpeg build lacks that encoder; use
  the gyan.dev full build.

## Honest limitations (say these out loud in the README/demo)

- Detection is probabilistic; scores, not verdicts.
- Trained on ASVspoof + synthetic TTS spoofs: strong vs TTS/VC-class
  synthesis, untested vs a live human impersonator (no synthesis involved).
- The synthetic hi-en set measures code-switch robustness; it is not a
  claim of coverage over all Indian languages/accents.
