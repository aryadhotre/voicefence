# Build context MUST be the repo root (not backend/), since this image needs
# both backend/ and the sibling ml/ package. On Render: set "Root Directory"
# to the repo root and "Dockerfile Path" to backend/Dockerfile. Locally:
#   docker build -f backend/Dockerfile -t awaaz-backend .
FROM python:3.11-slim

# ffmpeg: fallback decoder for audio formats libsndfile can't read natively
# (mp3, m4a/aac, wma — see awaaz_ml.synth.ingest_bonafide._load_any).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1a. Torch, installed separately from PyTorch's own CPU-only wheel index.
#    Plain `pip install torch` from PyPI is NOT a CPU wheel on Linux — it
#    pulls in cuda-toolkit, nvidia-cudnn, nvidia-nccl, triton, etc. (several
#    GB of CUDA runtime libs, irrelevant on Render's GPU-less instances) and
#    was the actual cause of the 512MB OOM kill. The +cpu wheel below has
#    zero CUDA dependencies and is ~1/3 the size.
RUN pip install --no-cache-dir torch==2.12.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# 1b. Backend's remaining pinned deps (better Docker layer caching — this
#    layer only rebuilds when requirements.txt changes, not on every code
#    edit).
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 2. The awaaz_ml package itself. --no-deps because its dependencies were
#    already installed with exact pins in step 1 — this only registers the
#    package and copies its source, it doesn't re-resolve anything.
COPY ml/pyproject.toml /app/ml/pyproject.toml
COPY ml/src /app/ml/src
RUN pip install --no-cache-dir --no-deps /app/ml

# 3. Backend application code.
COPY backend/app /app/backend/app

WORKDIR /app/backend
# 10000 matches Render's own documented default PORT for web services
# (https://render.com/docs/web-services#port-binding). Render's PORT
# injection for Docker-type services isn't as consistently reliable as it
# is for native/buildpack runtimes — if it doesn't fire for some reason,
# this fallback still binds to the exact port Render's scanner expects,
# instead of silently defaulting to a different port (e.g. 8000) that
# never gets detected ("No open ports detected, continuing to scan").
ENV PORT=10000
EXPOSE 10000

# Shell form so ${PORT} expands (Render injects its own PORT at runtime).
#
# --workers 1 is pinned deliberately: uvicorn falls back to $WEB_CONCURRENCY
# when --workers isn't passed (uvicorn/config.py), and every worker is a
# separate process that loads its own copy of torch + the model. At ~400 MB
# resident each, a second worker alone would blow the 512 MB tier before the
# service ever binds a port. Scale with instance count, not workers.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
