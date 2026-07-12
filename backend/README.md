# Voicefence — Backend (Phase 3)

FastAPI service wrapping the trained `awaaz_ml` RawNet2-style detector
behind two endpoints:
- `POST /analyze` — upload a whole audio file, get back a spoof-likelihood
  verdict, scores, and per-window detail for the explainability panel.
- `WS /ws/live-analyze` — stream audio in near-real-time during a live call,
  get back a running trust-meter score as it progresses.

No audio-decoding or scoring logic is reimplemented here. `app/inference.py`
imports directly from the `ml/` package (`awaaz_ml.evaluate.load_checkpoint`,
`awaaz_ml.predict.window_scores`, `awaaz_ml.synth.ingest_bonafide` for the
soundfile/ffmpeg decode fallback) — this service is a thin serving layer
around the exact same code already validated in `ml/README.md`.

## Local setup

```powershell
# From the repo root. Reuses ml/'s own venv so you don't re-download torch —
# if you'd rather have a fully separate backend venv, create one and
# `pip install -r backend/requirements.txt` into it instead.
cd ml
.\.venv\Scripts\Activate.ps1
pip install fastapi==0.115.6 "uvicorn[standard]==0.34.0" python-multipart==0.0.20
cd ..\backend

# MODEL_CHECKPOINT_PATH defaults to ..\ml\runs\rawnet2_codecaug\best.pt —
# only set it if you're pointing at a different checkpoint.
python -m uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:awaaz_backend:Loading model checkpoint=...\ml\runs\rawnet2_codecaug\best.pt device=auto ...
INFO:awaaz_backend.inference:Model ready: device=cuda samples=64600 threshold=-3.915
INFO:awaaz_backend:Model loaded — ready to serve.
INFO:     Application startup complete.
```

The model loads **once** at startup (via FastAPI's `lifespan`), not per
request — confirmed in testing at ~35-40ms/request after the first (which
pays a one-time ~300ms CUDA/cuDNN warmup).

### Test it

```powershell
curl http://127.0.0.1:8000/health
# {"status":"ok"}

curl -X POST http://127.0.0.1:8000/analyze `
  -F "file=@..\ml\data\synth_hi_en\flac\AWZ_en_00000.flac"
```

```json
{
  "verdict": "spoof-like",
  "score_min": -5.393821716308594,
  "score_mean": -3.247039794921875,
  "threshold": -3.9150390625,
  "duration_sec": 5.09675,
  "window_scores": [-5.393821716308594, -1.1002579927444458],
  "disclaimer": "This is a probabilistic risk signal, not a guarantee. Verify independently: call back on a known number, ask an unscripted question."
}
```

This was verified against `python -m awaaz_ml.predict --checkpoint
runs\rawnet2_codecaug\best.pt --audio data\synth_hi_en\flac\AWZ_en_00000.flac`
run directly — same scores (small ~0.002-0.003 differences between separate
process runs are expected `cudnn.benchmark=True` algorithm-selection
variance on GPU, not a bug; identical requests within the *same* running
server process return bit-identical results every time).

Interactive API docs: http://127.0.0.1:8000/docs

### Error handling (all tested)

| Input | Response |
|---|---|
| Empty file | `400 {"detail": "Uploaded file is empty."}` |
| Corrupt/undecodable content | `400 {"detail": "Could not decode '<name>' as audio: ..."}` |
| File over `MAX_UPLOAD_MB` | `413 {"detail": "File too large: X.X MB exceeds the N MB limit."}` |
| Audio under 0.25s | `400 {"detail": "Audio is too short to analyze ..."}` |
| Anything else unexpected | `500` with a generic message (full traceback goes to server logs, not the client) |

## Streaming endpoint (`WS /ws/live-analyze`)

RawNet2 needs a full ~4.04s (64,600-sample) window per inference, unlike ASR
which can score much shorter frames — so this isn't a per-syllable score,
it's a sliding 4.04s window updated roughly once per second as audio arrives.

**Wire protocol:**
- Client → server: **binary** frames, raw little-endian PCM16 mono 16 kHz
  audio. ~1 second per chunk (32,000 bytes) is the recommended cadence, but
  the server buffers independently of how the client chunks its sends.
- Server → client: **JSON text** frames — `{"type": "score", ...}` once per
  completed window (`window_index`, `raw_score`, `smoothed_score`,
  `threshold`, `verdict`, `duration_sec` — see `schemas.StreamScoreMessage`),
  `{"type": "error", ...}` for a problem with one chunk (connection stays
  open), or `{"type": "call_ended", ...}` immediately before the server
  closes the connection (max duration reached).
- `raw_score` is that window alone — feeds a moment-by-moment timeline.
  `smoothed_score` is an EMA (α=0.3) over recent windows — feeds a stable,
  non-jittery live trust-meter. `verdict` is `smoothed_score` vs threshold.

**Per-connection state, not shared:** each WebSocket gets its own
`StreamingScorer` (rolling buffer + EMA), instantiated fresh in the route
handler and garbage-collected when the connection ends — no cross-call
state, no leak. Memory is bounded regardless of call length: the buffer only
ever retains the most recent window (~258 KB), never the whole call.

**Abuse protection (not auth — see below):** `MAX_WS_CHUNK_BYTES` (default
1MB; a real 1s/16kHz/16-bit chunk is ~32KB, so this only catches abuse, not
normal use) closes the connection on an oversized frame.
`MAX_CALL_SECONDS` (default 600 = 10 min) ends the call gracefully once hit.

**⚠️ TODO(auth):** there is **no authentication** on this endpoint yet.
Anyone who can reach the server can open a WebSocket and consume GPU/CPU
inference time. That's acceptable for internal testing or a gated demo, not
for a public deployment fielding real traffic — before that, add an API key
or JWT check before `websocket.accept()` (e.g. a query param or
`Sec-WebSocket-Protocol` header checked in the route). Tracked as follow-up
work, deliberately not built now (see the `TODO(auth)` comment in
`app/routes/stream.py`).

**Tested end-to-end** with a real WebSocket client streaming ~34s of real
(concatenated) audio in 1s chunks at real-time pace: first score arrived at
t=5.0s (first window doesn't complete until ~4.04s), then exactly one new
score per second after that (30 windows for 34s of audio — confirmed no
duplicate/burst scoring). A mid-stream abrupt disconnect (client closes
after 4s, well before any window completes) was caught cleanly as
`WebSocketDisconnect`, logged, and cleaned up with no traceback; a brand
new connection immediately afterward was accepted and scored correctly,
confirming no leaked or corrupted state from the aborted call.

One caveat surfaced during testing, worth knowing: scoring a window that
straddles a hard splice between two unrelated recordings (only possible in
a synthetic test built by concatenating separate files — a real phone call
has no such splice) can produce an unusual, hard-to-interpret score, since
the model is looking at an artificial discontinuity that wouldn't occur in
real audio. Not a bug in the scorer; just don't over-read a single window's
score right at a synthetic test clip's splice point.

## Configuration

All settings are environment variables — see `.env.example` for the full
list with descriptions. Key ones:

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_CHECKPOINT_PATH` | `../ml/runs/rawnet2_v3_hien/best_inference.pt` | Where to load the checkpoint from |
| `MODEL_CHECKPOINT_URL` | unset | If the path above doesn't exist at startup, download it from here first (see below) |
| `MODEL_CHECKPOINT_SHA256` | unset | If set, verify the downloaded file's hash before loading; fail loudly on mismatch |
| `MODEL_DEVICE` | auto | `cuda` / `cpu` / unset (auto-detect, falls back to cpu) |
| `MODEL_MAX_WINDOW_BATCH` | `1` | Windows scored per forward pass. `1` is the memory-safe default for a 512MB tier; raise it for throughput on a bigger box |
| `TORCH_NUM_THREADS` | `1` | torch intra-op threads (CPU only). Defaults to 1 because Render's shared-CPU tiers give a fraction of a core, so extra threads add arenas and contention, not throughput |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins; tighten before real traffic |
| `MAX_UPLOAD_MB` | `25` | Reject uploads larger than this (`/analyze`) |
| `MAX_CALL_SECONDS` | `600` | End a live-analyze call after this long (`/ws/live-analyze`) |
| `MAX_WS_CHUNK_BYTES` | `1000000` | Close the connection if a single binary frame exceeds this (`/ws/live-analyze`) |
| `PORT` | `10000` | uvicorn bind port. Render *should* inject this itself — but its `PORT` injection for Docker-type services isn't as consistently reliable as it is for native/buildpack runtimes, so the Dockerfile's own fallback default is set to Render's documented default (10000, not the more common 8000) rather than risk a mismatch between what Render's port scanner expects and what the container actually binds. Don't override it manually unless you have a specific reason to. |

## Deploying the checkpoint file (read this before deploying)

**This is a real deployment blocker if ignored.** The checkpoint is
gitignored (see repo-root `.gitignore` — `*.pt` and `runs/` are both
excluded), and will **not** be present in a fresh clone or a fresh Render
build. If you deploy without addressing this, the container will fail to
start with `FileNotFoundError` on the checkpoint path.

**Serve `best_inference.pt`, never `best.pt`.** Training writes optimizer +
AMP-scaler state into the checkpoint so a run can be `--resume`d, which for
RawNet2 is 141MB of Adam moments against 70MB of actual weights. `torch.load`
materialises the entire file before the serving code can discard anything, so
pointing production at the training checkpoint costs ~138MB of **peak** RSS at
startup for state the forward pass never reads — and that spike is what
OOM-killed the 512MB Render tier. `python -m awaaz_ml.strip_checkpoint` writes
the inference-only artifact (211.6MB → 70.6MB); the weights are bit-identical,
so scores are unchanged (verified across 75 held-out files / 184 windows, max
abs diff 0.0).

Three ways to get it onto the server, in order of recommendation:

1. **`MODEL_CHECKPOINT_URL` (implemented and already in use — this is not
   hypothetical, `rawnet2_v3_hien/best_inference.pt` is live at the URL below
   right now).** Chose a **public Hugging Face Hub model repo** over a GitHub
   Release: this project wasn't even a git repository at the time of this
   build (no repo to attach a release to), whereas HF Hub needed nothing
   new — same account already used for `indic-parler-tts` — and a public
   repo means the download needs **zero auth**, so plain `urllib` works
   with no token plumbing. Weights for an anti-spoofing detector aren't
   sensitive, so public was the easy, correct choice here (a private
   Common Voice/user-data bucket would warrant different handling).

   ```
   MODEL_CHECKPOINT_URL=https://huggingface.co/Arya12367/voicefence-rawnet2-v3-hien/resolve/main/best_inference.pt
   MODEL_CHECKPOINT_SHA256=b5e1e4fe94b17b003fdb4d6fefab34318a9c8df2123b77e87501a0fff4075201
   ```

   (The same repo still hosts the full 211.6MB training `best.pt` — keep it
   for `--resume`, but do not serve it. See the note above.)

   On startup, if `MODEL_CHECKPOINT_PATH` doesn't exist locally,
   `app/inference.py` downloads it from this URL, **verifies the SHA-256
   against `MODEL_CHECKPOINT_SHA256`** (refuses to load and crashes
   startup loudly on a mismatch — a corrupt transfer or a URL silently
   re-pointed at the wrong file should never fail silently into serving
   bad weights), then caches it at `MODEL_CHECKPOINT_PATH` for next time.
   Verified end-to-end: local checkpoint moved aside, server restarted with
   only these two env vars set, downloaded, checksum matched, loaded, and
   served a request with scores identical to the pre-move run — see the
   cold-start test log below.
   **Trade-off:** first startup after each fresh deploy is slower (one-time
   ~70MB download); works identically on every host with zero
   platform-specific setup, which is why it's the default here.
2. **Render persistent disk.** Attach a disk to the service, `scp`/upload
   `best.pt` onto it once via Render's shell, and set
   `MODEL_CHECKPOINT_PATH` to the mounted path. **Trade-off:** no
   re-download on restart (faster cold starts after the first), but
   Render-specific — you redo this manually if you ever recreate the
   service or disk, and persistent disks aren't available on Render's free
   tier.
3. **Bake it into the Docker image at build time.** Add a `COPY
   best_inference.pt /app/ml/runs/rawnet2_v3_hien/best_inference.pt` step
   (fetched via a build-time
   `curl`/`ADD <url>` if you don't want the binary in your build context).
   **Trade-off:** simplest at request time (zero startup latency, no
   runtime dependency on an external host being up), but bloats the image
   by ~200MB on every build and re-couples the image to one specific
   checkpoint version — not recommended once you're iterating on models.

**Recommended default: option 1.** It's already wired up — you only need
to host the file somewhere and set one env var.

## Render deployment

This is a monorepo — `backend/` imports the sibling `ml/` package, so the
**Docker build context must be the repo root**, not `backend/`.

1. New Web Service → **Docker** (not "native"/buildpack).
2. **Root Directory**: leave blank / repo root (this is what makes `ml/`
   visible to the build — do not set it to `backend`).
3. **Dockerfile Path**: `backend/Dockerfile`.
4. **Environment variables**: set at minimum `MODEL_CHECKPOINT_URL` (see
   above). Set `CORS_ORIGINS` to your actual frontend domain once it
   exists instead of leaving it at `*`.
5. Render injects `PORT` itself — the Dockerfile's `CMD` already reads
   `${PORT}`, don't override it. If a deploy ever gets stuck on "No open
   ports detected, continuing to scan" despite the app logging that it
   started successfully, that's this: Render's `PORT` injection didn't
   reach the container, so it fell back to whatever the Dockerfile
   defaults to — which is why that fallback is now pinned to 10000
   (Render's own documented default) instead of a value picked for local
   dev convenience.
6. Instance size: this model runs on CPU fine for single-file inference
   (no GPU needed/available on standard Render plans) — a small instance
   is enough; the ~200MB checkpoint plus PyTorch's own footprint wants at
   least 1GB RAM to be comfortable.

   **RAM footprint gotcha (caused a real OOM kill on this project):** plain
   `pip install torch` on Linux does **not** get you a CPU-only build —
   PyPI's default linux wheel for torch is CUDA-enabled and pulls in
   `cuda-toolkit`, `nvidia-cudnn`, `nvidia-nccl`, `triton`, etc. (multiple
   GB of GPU runtime libs, useless on Render's GPU-less instances) and
   inflates the process's baseline memory footprint well past what a
   CPU-only build needs. The Dockerfile now installs torch explicitly from
   PyTorch's own CPU wheel index (`https://download.pytorch.org/whl/cpu`)
   instead, which has zero CUDA dependencies. Even with this fix, the
   512MB **Free** tier is cutting it close (checkpoint + torch + uvicorn
   baseline) — prefer at least the 512MB **Starter** tier's neighbor with
   more headroom, or size up if you see memory warnings in Render's
   metrics after deploying.

No build or start command fields to fill in separately — the Dockerfile
defines both (`pip install` steps at build time, `uvicorn` at container
start).
