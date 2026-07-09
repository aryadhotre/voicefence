"""POST /analyze — upload an audio file, get a spoof-likelihood verdict."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from ..config import get_settings
from ..inference import InferenceError
from ..schemas import AnalyzeResponse

logger = logging.getLogger("awaaz_backend.routes.analyze")

router = APIRouter()


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    responses={400: {"description": "Bad or undecodable audio"},
               413: {"description": "File too large"}},
)
async def analyze(request: Request, file: UploadFile = File(...)) -> AnalyzeResponse:
    settings = get_settings()
    max_bytes = int(settings.max_upload_mb * 1024 * 1024)

    audio_bytes = await file.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(audio_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large: {len(audio_bytes) / 1e6:.1f} MB exceeds the "
                f"{settings.max_upload_mb:.0f} MB limit."
            ),
        )

    model_service = request.app.state.model_service
    try:
        result = model_service.analyze(audio_bytes, file.filename or "upload")
    except InferenceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("Unexpected error analyzing upload '%s'", file.filename)
        raise HTTPException(
            status_code=500,
            detail="Internal error while analyzing the file. Please try again.",
        ) from None

    return AnalyzeResponse(**result)
