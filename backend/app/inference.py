"""Wraps awaaz_ml's existing checkpoint-loading and windowed-scoring logic for
serving. No audio-decoding or scoring logic is reimplemented here — all of it
comes straight from the ml/ package (awaaz_ml.evaluate, awaaz_ml.predict,
awaaz_ml.synth.ingest_bonafide, awaaz_ml.utils).
"""

from __future__ import annotations

import hashlib
import logging
import tempfile
import urllib.request
from pathlib import Path

import numpy as np

from awaaz_ml.evaluate import load_checkpoint
from awaaz_ml.predict import window_scores

# Reuses the same "soundfile first, ffmpeg fallback" decode path already
# written for ingesting arbitrary real-world audio (mp3/m4a/opus/etc.) into
# the training pipeline — deliberately not reimplemented here.
from awaaz_ml.synth.ingest_bonafide import _load_any as _decode_any_audio
from awaaz_ml.utils import get_device

logger = logging.getLogger("awaaz_backend.inference")


class InferenceError(ValueError):
    """Bad/corrupt/unsupported/too-short audio input — routes map this to a 4xx."""


class ChecksumMismatchError(RuntimeError):
    """Downloaded checkpoint doesn't match the expected hash — a startup-fatal
    error (wrong file, corrupt transfer, or a tampered URL), never a per-request
    4xx, so this deliberately does not subclass InferenceError."""


def _sha256sum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url: str, dest: Path, expected_sha256: str | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    logger.info("Downloading model checkpoint from %s ...", url)
    urllib.request.urlretrieve(url, tmp)  # noqa: S310 - operator-provided URL, not user input

    if expected_sha256:
        actual = _sha256sum(tmp)
        if actual.lower() != expected_sha256.strip().lower():
            tmp.unlink(missing_ok=True)
            raise ChecksumMismatchError(
                f"Downloaded checkpoint checksum mismatch: expected "
                f"{expected_sha256}, got {actual}. Refusing to load it — "
                "the download may be corrupt, or MODEL_CHECKPOINT_URL may "
                "be serving the wrong file. The partial download was "
                "deleted; fix the URL/hash and restart."
            )
        logger.info("Checkpoint checksum verified: %s", actual)
    else:
        logger.warning(
            "MODEL_CHECKPOINT_SHA256 not set — downloaded checkpoint is "
            "being loaded WITHOUT integrity verification."
        )

    tmp.rename(dest)
    logger.info("Checkpoint saved to %s (%.1f MB)", dest, dest.stat().st_size / 1e6)


class ModelService:
    """Loads the checkpoint once at startup; reused across all requests."""

    def __init__(
        self,
        checkpoint_path: str,
        device_pref: str | None = None,
        checkpoint_url: str | None = None,
        checkpoint_sha256: str | None = None,
    ):
        path = Path(checkpoint_path)
        if not path.is_file():
            if checkpoint_url:
                _download(checkpoint_url, path, checkpoint_sha256)
            else:
                raise FileNotFoundError(
                    f"Model checkpoint not found at '{path}' and no "
                    "MODEL_CHECKPOINT_URL was set to fetch it. See "
                    "backend/README.md for deployment options."
                )

        self.device = get_device(device_pref)
        self.model, ck = load_checkpoint(path, self.device)
        self.samples = int(ck["config"]["data"]["samples"])
        self.threshold = float(ck.get("eer_threshold", 0.0))
        # Identify exactly which checkpoint is live, so /health can confirm a
        # deploy is serving the intended weights (byte-for-byte via sha256).
        self.checkpoint_sha256 = _sha256sum(path)
        self.checkpoint_epoch = ck.get("epoch")
        self.checkpoint_run = ck.get("config", {}).get("out_dir")
        # Optimizer/scaler state is only needed for --resume during training,
        # not for inference — drop the references to keep the serving
        # process's memory footprint down.
        ck.pop("optimizer", None)
        ck.pop("scaler", None)
        logger.info(
            "Model ready: run=%s epoch=%s sha256=%s device=%s samples=%d threshold=%+.3f",
            self.checkpoint_run, self.checkpoint_epoch, self.checkpoint_sha256[:12],
            self.device, self.samples, self.threshold,
        )

    def analyze(self, audio_bytes: bytes, filename: str) -> dict:
        suffix = Path(filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)
        try:
            try:
                wav = _decode_any_audio(tmp_path)
            except Exception as e:
                raise InferenceError(
                    f"Could not decode '{filename}' as audio: {e}"
                ) from e

            if wav.size == 0:
                raise InferenceError("Decoded audio contains no samples.")

            duration_sec = wav.shape[0] / 16_000
            if duration_sec < 0.25:
                raise InferenceError(
                    f"Audio is too short to analyze ({duration_sec:.2f}s; "
                    "need at least 0.25s)."
                )

            scores = window_scores(self.model, wav, self.samples, self.device)
            s_min = float(scores.min())
            s_mean = float(scores.mean())
            verdict = "bonafide-like" if s_min >= self.threshold else "spoof-like"

            return {
                "verdict": verdict,
                "score_min": s_min,
                "score_mean": s_mean,
                "threshold": self.threshold,
                "duration_sec": duration_sec,
                "window_scores": [float(s) for s in scores],
            }
        finally:
            tmp_path.unlink(missing_ok=True)


class StreamingScorer:
    """Per-connection sliding-window scorer for the /ws/live-analyze endpoint.

    One instance per live WebSocket call — never shared across connections,
    since each call needs its own rolling-buffer/EMA state. Reuses the exact
    same awaaz_ml.predict.window_scores function the batch /analyze endpoint
    uses: feeding it a slice that's already exactly `window_samples` long
    makes it score that single window, with no reimplementation of the
    scoring logic itself.

    Memory footprint is bounded regardless of call length: the rolling
    buffer only ever retains the most recent `window_samples` (~258 KB for
    the default 64,600-sample/4.04s window) — total call duration is
    tracked with a plain counter, not by keeping the whole call's audio
    in memory.
    """

    def __init__(
        self,
        model_service: ModelService,
        hop_seconds: float = 1.0,
        ema_alpha: float = 0.3,
        max_duration_sec: float = 600.0,
    ):
        self.model_service = model_service
        self.sr = 16_000
        self.window_samples = model_service.samples
        self.hop_samples = max(1, int(hop_seconds * self.sr))
        self.ema_alpha = ema_alpha
        self.max_samples = int(max_duration_sec * self.sr)

        self._buffer = np.zeros(0, dtype=np.float32)
        self._new_samples_since_infer = 0
        self._total_samples_seen = 0
        self._ema: float | None = None
        self._window_index = 0

    @property
    def duration_sec(self) -> float:
        return self._total_samples_seen / self.sr

    @property
    def window_count(self) -> int:
        return self._window_index

    def push_chunk(self, pcm16_bytes: bytes) -> tuple[list[dict], bool]:
        """Feed one chunk of raw little-endian PCM16 mono 16 kHz audio.

        Returns (score_messages, limit_reached). score_messages holds zero or
        one dicts: zero until the buffer first fills a full window, or if
        less than one hop's worth of new audio has arrived since the last
        score; one otherwise. Deliberately never more than one per call — the
        rolling buffer holds a single window's worth of audio, so there is
        only ever one distinct window to score per call. A client that sends
        one large chunk spanning several hops' worth of audio still gets
        exactly one fresh score (from the most recent window in that chunk),
        not several duplicate ones computed from identical buffer content.
        limit_reached=True means max_duration_sec has been hit — the caller
        should send these messages then close the connection; this instance
        won't usefully accept more audio.
        """
        if not pcm16_bytes:
            return [], False
        if len(pcm16_bytes) % 2 != 0:
            raise InferenceError(
                "Audio chunk has an odd number of bytes; expected 16-bit "
                "PCM samples (2 bytes each)."
            )

        chunk = np.frombuffer(pcm16_bytes, dtype="<i2").astype(np.float32) / 32768.0
        self._buffer = np.concatenate([self._buffer, chunk])
        self._new_samples_since_infer += len(chunk)
        self._total_samples_seen += len(chunk)

        # Only the most recent window is ever needed for inference.
        if len(self._buffer) > self.window_samples:
            self._buffer = self._buffer[-self.window_samples:]

        limit_reached = self._total_samples_seen >= self.max_samples

        messages: list[dict] = []
        if (
            len(self._buffer) >= self.window_samples
            and self._new_samples_since_infer >= self.hop_samples
        ):
            scores = window_scores(
                self.model_service.model, self._buffer,
                self.window_samples, self.model_service.device,
            )
            raw_score = float(scores[0])
            self._ema = (
                raw_score if self._ema is None
                else self.ema_alpha * raw_score + (1 - self.ema_alpha) * self._ema
            )
            self._window_index += 1
            threshold = self.model_service.threshold
            verdict = "bonafide-like" if self._ema >= threshold else "spoof-like"
            messages.append({
                "type": "score",
                "window_index": self._window_index,
                "raw_score": raw_score,
                "smoothed_score": float(self._ema),
                "threshold": threshold,
                "verdict": verdict,
                "duration_sec": self.duration_sec,
            })
            # Reset rather than decrement: the buffer holds only one window's
            # worth of audio, so there's nothing new left to score again this
            # call regardless of how much hop-credit had built up.
            self._new_samples_since_infer = 0

        return messages, limit_reached
