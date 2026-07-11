"""FastAPI app: loads the anti-spoofing model once at startup, serves /analyze."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .inference import ModelService
from .routes import analyze, stream

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("awaaz_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(
        "Loading model checkpoint=%s device=%s ...",
        settings.checkpoint_path, settings.device or "auto",
    )
    app.state.model_service = ModelService(
        checkpoint_path=settings.checkpoint_path,
        device_pref=settings.device,
        checkpoint_url=settings.checkpoint_url,
        checkpoint_sha256=settings.checkpoint_sha256,
    )
    logger.info("Model loaded — ready to serve.")
    yield
    # Nothing to release explicitly: the process exits, freeing the model.


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Voicefence API",
        description=(
            "Voice-authenticity analysis for AI voice-cloning scam detection. "
            "Detection is probabilistic — a risk signal, not a guarantee."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(analyze.router)
    app.include_router(stream.router)

    @app.get("/")
    def root() -> dict:
        return {"service": "Voicefence API", "docs": "/docs", "status": "ok"}

    @app.get("/health")
    def health() -> dict:
        ms = getattr(app.state, "model_service", None)
        if ms is None:
            return {"status": "starting"}
        # Expose which checkpoint is live so a deploy can be verified against
        # the intended weights (sha256 is authoritative; run/epoch are for humans).
        return {
            "status": "ok",
            "checkpoint_run": ms.checkpoint_run,
            "checkpoint_epoch": ms.checkpoint_epoch,
            "checkpoint_sha256": ms.checkpoint_sha256,
            "threshold": ms.threshold,
        }

    return app


app = create_app()
