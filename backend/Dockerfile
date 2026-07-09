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

# 1. Backend's own pinned deps first (better Docker layer caching — this
#    layer only rebuilds when requirements.txt changes, not on every code
#    edit). Plain PyPI `torch==...` resolves to the CPU wheel, which is what
#    Render's (GPU-less) instances need.
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
ENV PORT=8000
EXPOSE 8000

# Shell form so ${PORT} expands (Render injects its own PORT at runtime).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
