"""FastAPI app: loads the anti-spoofing model once at startup, serves /analyze."""

from __future__ import annotations

import logging
import os
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
        loaded = hasattr(app.state, "model_service")
        return {"status": "ok" if loaded else "starting"}

    # TEMPORARY — re-checking CORS_ORIGINS after a reported trailing-slash
    # fix that didn't change the "Disallowed CORS origin" behavior.
    @app.get("/debug/cors-check")
    def debug_cors_check() -> dict:
        return {
            "raw_env_repr": repr(os.environ.get("CORS_ORIGINS")),
            "parsed_cors_origins": settings.cors_origins,
        }

    return app


app = create_app()
