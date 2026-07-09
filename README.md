# Voicefence

Voice-authenticity analysis for the AI voice-cloning scam wave: detects synthetic (TTS / voice-conversion) speech in WhatsApp voice notes and phone-call audio, with a focus on the conditions Indian scam calls actually happen in — **telephony/VoIP codec compression** and **Hindi–English code-switched speech** — the two documented blind spots of existing detectors and of the OS-level features Google/Samsung ship.

> Detection is probabilistic. Voicefence outputs a calibrated risk score with explanations — it is a decision aid, never a guarantee. Product copy must never claim certainty.

## Monorepo layout

```
voicefence/
├── ml/          Phase 1–2: dataset pipeline, codec augmentation, synthetic
│                Hindi-English spoof generation, RawNet2-style detector,
│                training + EER evaluation.
├── backend/     Phase 3: FastAPI serving — file analyze (POST /analyze)
│                + WebSocket live streaming (WS /ws/live-analyze).
├── frontend/    Phase 4: React/Vite client — Landing, Analyze, Live
│                Listen, How It Works.               ← THIS RELEASE
└── android/     Phase 5: native share-target + speakerphone live-listen.
```

`android/` is intentionally absent until its phase ships — no stubs.

## Phase status

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Data pipeline: ASVspoof ingest, codec augmentation, synthetic hi-en set | ✅ shipped |
| 2 | Detector: RawNet2-style model, training, EER eval (overall / per-attack / per-codec) | ✅ shipped |
| 3 | FastAPI serving: file analyze + WebSocket live streaming | ✅ shipped |
| 4 | React client: Landing, Analyze, Live Listen, How It Works | ✅ this release |
| 5 | Android wrapper | — |

## Start here

- ML core / training runbook: [`ml/README.md`](ml/README.md)
- Backend API + deployment: [`backend/README.md`](backend/README.md)
- Frontend setup: [`frontend/README.md`](frontend/README.md)

## The wedge (why this isn't "already done by Google")

- Google's fake-call detection = RCS device handshake; requires both parties on Phone by Google + RCS. No WhatsApp, no voice notes, no unknown numbers, no iPhone callers.
- Samsung Scam Protect = Galaxy S26+, US-first, native dialer only.
- Published benchmarks (2026) show detectors trained on standard corpora degrade badly on codec-compressed, real-world fraud audio, and the field's multilingual robustness challenge covers zero Indian languages.

Voicefence's ML core is trained and **evaluated specifically under those conditions**, and both claims are measurable (EER under codec sweep; EER on the code-switched set).
