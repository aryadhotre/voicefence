"""WebSocket /ws/live-analyze — real-time streaming spoof-likelihood scoring.

Wire protocol
--------------
Client -> server: **binary** WebSocket frames, raw little-endian PCM16, mono,
16 kHz audio samples. ~1 second per chunk (32,000 bytes) is the recommended
cadence — small enough to feel responsive, large enough not to be pure
per-message overhead for a model this size — but the server doesn't actually
care how the client chunks its sends; it buffers incoming samples and runs
its own sliding window/hop regardless (see inference.StreamingScorer).

Server -> client: **JSON text** frames, one of three shapes (schemas.py):
  - StreamScoreMessage  — sent once per completed inference window
  - StreamErrorMessage  — sent for a problem with a single chunk; connection
                          stays open, keep sending audio
  - StreamEndMessage    — sent immediately before the server closes the
                          connection (max call duration reached)

RawNet2 needs a full ~4.04s (64,600-sample) window per inference, unlike ASR
which can usefully score much shorter frames — the first StreamScoreMessage
won't arrive until ~4s of audio has been received, then roughly once per
second after that (one hop) as long as audio keeps arriving.

No authentication yet. TODO(auth): before this leaves internal/demo use,
require an API key or JWT before accepting the WebSocket connection (e.g.
check a query param or the Sec-WebSocket-Protocol header in a dependency
before `websocket.accept()`) — see backend/README.md "Streaming endpoint".
The message-size cap and max-call-duration limit below are basic abuse
protection in the meantime, not a substitute for real auth on a public
deployment.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from ..config import get_settings
from ..inference import InferenceError, StreamingScorer

logger = logging.getLogger("awaaz_backend.routes.stream")

router = APIRouter()


async def _safe_close(websocket: WebSocket, code: int, reason: str) -> None:
    """Close if not already disconnected — avoids a second exception when the
    connection dropped for a reason we're already handling."""
    if websocket.client_state == WebSocketState.CONNECTED:
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            logger.debug("Ignoring error while closing an already-troubled socket.")


@router.websocket("/ws/live-analyze")
async def live_analyze(websocket: WebSocket) -> None:
    settings = get_settings()
    model_service = websocket.app.state.model_service
    scorer = StreamingScorer(
        model_service,
        hop_seconds=1.0,
        max_duration_sec=settings.max_call_seconds,
    )

    await websocket.accept()
    logger.info("live-analyze: connection opened")

    try:
        while True:
            data = await websocket.receive_bytes()

            if len(data) > settings.max_ws_chunk_bytes:
                await websocket.send_json({
                    "type": "error",
                    "detail": (
                        f"Chunk too large ({len(data)} bytes > "
                        f"{settings.max_ws_chunk_bytes} limit)."
                    ),
                })
                logger.warning(
                    "live-analyze: closing connection, oversized chunk (%d bytes)",
                    len(data),
                )
                await _safe_close(websocket, code=1008, reason="chunk too large")
                return

            try:
                messages, limit_reached = scorer.push_chunk(data)
            except InferenceError as e:
                # Bad chunk (e.g. odd byte count) — tell the client, keep going.
                await websocket.send_json({"type": "error", "detail": str(e)})
                continue

            for msg in messages:
                await websocket.send_json(msg)

            if limit_reached:
                await websocket.send_json({
                    "type": "call_ended",
                    "reason": (
                        f"Max call duration ({settings.max_call_seconds:.0f}s) "
                        "reached."
                    ),
                    "duration_sec": scorer.duration_sec,
                })
                logger.info(
                    "live-analyze: closing connection, max duration reached "
                    "(%.1fs)", scorer.duration_sec,
                )
                await _safe_close(websocket, code=1000, reason="max duration reached")
                return

    except WebSocketDisconnect:
        logger.info(
            "live-analyze: connection closed by client (duration=%.1fs, "
            "windows=%d)", scorer.duration_sec, scorer.window_count,
        )
    except Exception:
        logger.exception("live-analyze: unexpected error, closing connection")
        await _safe_close(websocket, code=1011, reason="internal error")
