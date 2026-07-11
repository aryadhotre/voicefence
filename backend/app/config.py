"""Environment-driven settings for the backend service.

All configuration comes from environment variables so the same image runs
locally and on Render without code changes — see .env.example for the full
list and backend/README.md for what each one does in deployment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# backend/app/config.py -> backend/app -> backend -> repo root -> ml/...
# Points at the current production checkpoint (rawnet2_v3_hien). On an
# ephemeral deploy this file won't exist, so the server fetches it from
# MODEL_CHECKPOINT_URL and caches it here; the run-specific name also means a
# checkpoint bump (new URL/hash) never collides with a previously-cached file
# from an older run on a persistent disk — it downloads the new one.
_DEFAULT_CHECKPOINT = (
    Path(__file__).resolve().parent.parent.parent
    / "ml" / "runs" / "rawnet2_v3_hien" / "best.pt"
)


@dataclass(frozen=True)
class Settings:
    checkpoint_path: str
    checkpoint_url: str | None
    checkpoint_sha256: str | None
    device: str | None
    cors_origins: list[str]
    max_upload_mb: float
    port: int
    max_call_seconds: float
    max_ws_chunk_bytes: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    origins_raw = os.getenv("CORS_ORIGINS", "*").strip()
    cors_origins = (
        ["*"] if origins_raw == "*"
        else [o.strip() for o in origins_raw.split(",") if o.strip()]
    )
    return Settings(
        checkpoint_path=os.getenv("MODEL_CHECKPOINT_PATH", str(_DEFAULT_CHECKPOINT)),
        checkpoint_url=os.getenv("MODEL_CHECKPOINT_URL") or None,
        checkpoint_sha256=os.getenv("MODEL_CHECKPOINT_SHA256") or None,
        device=os.getenv("MODEL_DEVICE") or None,
        cors_origins=cors_origins,
        max_upload_mb=float(os.getenv("MAX_UPLOAD_MB", "25")),
        port=int(os.getenv("PORT", "8000")),
        # Abuse-protection defaults for the public /ws/live-analyze demo
        # endpoint (see backend/README.md "Streaming endpoint" — no auth yet).
        max_call_seconds=float(os.getenv("MAX_CALL_SECONDS", "600")),
        max_ws_chunk_bytes=int(os.getenv("MAX_WS_CHUNK_BYTES", str(1_000_000))),
    )
