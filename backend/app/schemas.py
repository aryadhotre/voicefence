"""Pydantic request/response models for the analyze endpoint and the
live-analyze WebSocket message shapes.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DISCLAIMER = (
    "This is a probabilistic risk signal, not a guarantee. Verify "
    "independently: call back on a known number, ask an unscripted question."
)


class AnalyzeResponse(BaseModel):
    verdict: str = Field(..., description="'bonafide-like' or 'spoof-like'")
    score_min: float = Field(..., description="Minimum window score (higher = more bonafide-like)")
    score_mean: float = Field(..., description="Mean window score across the clip")
    threshold: float = Field(..., description="Decision threshold from the model's dev-set EER operating point")
    duration_sec: float = Field(..., description="Decoded audio duration in seconds")
    window_scores: list[float] = Field(..., description="Per-window scores, in order, for explainability visualizations")
    disclaimer: str = Field(default=DISCLAIMER)


class ErrorResponse(BaseModel):
    detail: str


# --- /ws/live-analyze WebSocket message shapes -----------------------------
#
# Wire protocol (see routes/stream.py for the full docstring):
#   client -> server: binary frames, raw little-endian PCM16 mono 16 kHz
#                      audio chunks (~1s recommended; any chunk size works)
#   server -> client: JSON text frames, one of the three shapes below


class StreamScoreMessage(BaseModel):
    """Sent once per completed sliding-window inference."""

    type: Literal["score"] = "score"
    window_index: int = Field(..., description="1-based index of this inference window")
    raw_score: float = Field(..., description="Score for this specific window only — feeds the moment-by-moment timeline")
    smoothed_score: float = Field(..., description="EMA over recent windows — feeds the stable trust-meter display")
    threshold: float = Field(..., description="Decision threshold (same operating point as /analyze)")
    verdict: str = Field(..., description="'bonafide-like' or 'spoof-like', based on smoothed_score vs threshold")
    duration_sec: float = Field(..., description="Total call duration processed so far")


class StreamErrorMessage(BaseModel):
    """Sent for a problem with one chunk — the connection stays open."""

    type: Literal["error"] = "error"
    detail: str


class StreamEndMessage(BaseModel):
    """Sent immediately before the server closes the connection."""

    type: Literal["call_ended"] = "call_ended"
    reason: str
    duration_sec: float
