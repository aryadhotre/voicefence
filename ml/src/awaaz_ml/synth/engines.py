"""TTS engine adapters for synthetic spoof generation.

Engines (install with `pip install -e .[synth]`; GPU strongly recommended;
first run downloads multi-GB checkpoints from Hugging Face):

  parler  ai4bharat/indic-parler-tts — Apache-2.0, commercial-safe.
          Hindi + English + code-switch capable. Speaker controlled by a
          natural-language description (no reference-audio cloning).

  xtts    coqui XTTS-v2 — Coqui Public Model License = NON-COMMERCIAL.
          Reference-audio voice cloning (speaker-matched spoofs). Use ONLY
          for research evaluation sets, never in a commercial pipeline;
          the adapter refuses to run without an explicit acknowledgement.

Every adapter returns mono float32 numpy audio resampled to 16 kHz.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soxr

TARGET_SR = 16_000

DEFAULT_DESCRIPTIONS = [
    "A female speaker with a clear, slightly expressive voice speaks at a "
    "moderate pace in a quiet room with a close microphone.",
    "A male speaker delivers speech in a calm, deep voice at a slightly "
    "fast pace; the recording is very clear with no background noise.",
    "A young female speaker with a bright tone speaks quickly and "
    "energetically; close-sounding studio recording.",
    "An older male speaker talks slowly and deliberately in a slightly "
    "muffled room-sounding recording.",
]

# ai4bharat/indic-parler-tts was fine-tuned on named speakers per language;
# the model card explicitly recommends naming one of them in the description
# rather than a generic "a female speaker..." caption — generic captions
# don't reliably pick a native-language voice and can come out sounding like
# an English speaker attempting Hindi. Rohit/Divya/Aman/Rani are the model's
# own Hindi speakers (Rohit + Divya are its "recommended" pair), used here
# for both monolingual Hindi and code-switched hi-en text.
DESCRIPTIONS_HI = [
    "Rohit speaks with a clear, moderate pace in a close-sounding "
    "recording with very clear audio and minimal background noise.",
    "Divya's voice is slightly expressive and delivered at a normal pace, "
    "captured in a very clear, close-sounding recording.",
    "Aman speaks quickly with a slightly higher pitch, in a clear and "
    "close-sounding recording with very clear audio.",
    "Rani's voice is calm and steady at a moderate pace, recorded very "
    "clearly with a close, intimate sound.",
]


def _trim_trailing_silence(
    wav: np.ndarray, sr: int,
    win_s: float = 0.02, thresh_ratio: float = 0.05,
    pad_s: float = 0.12, fade_s: float = 0.015,
) -> np.ndarray:
    """Drop the near-silent tail some generations leave after real speech
    ends (the codec keeps emitting frames for a beat before EOS), plus a
    short fade to avoid an audible click at the new cut point."""
    win = max(1, int(win_s * sr))
    n_win = len(wav) // win
    if n_win < 2:
        return wav
    energies = np.array([
        np.sqrt(np.mean(wav[i * win:(i + 1) * win].astype(np.float64) ** 2))
        for i in range(n_win)
    ])
    peak_energy = float(energies.max())
    if peak_energy <= 0:
        return wav
    above = np.nonzero(energies > peak_energy * thresh_ratio)[0]
    if len(above) == 0:
        return wav
    last_voiced_sample = min(len(wav), (above[-1] + 1) * win + int(pad_s * sr))
    if last_voiced_sample >= len(wav):
        return wav
    trimmed = wav[:last_voiced_sample].copy()
    fade_len = min(int(fade_s * sr), len(trimmed))
    if fade_len > 0:
        trimmed[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=np.float32)
    return trimmed


def _to_16k(wav: np.ndarray, sr: int) -> np.ndarray:
    wav = np.asarray(wav, dtype=np.float32).squeeze()
    if wav.ndim > 1:
        wav = wav.mean(axis=0)
    if sr != TARGET_SR:
        wav = soxr.resample(wav, sr, TARGET_SR).astype(np.float32, copy=False)
    wav = _trim_trailing_silence(wav, TARGET_SR)
    peak = float(np.abs(wav).max() or 1.0)
    if peak > 1.0:
        wav = wav / peak
    return wav


class ParlerIndicEngine:
    """ai4bharat/indic-parler-tts (Apache-2.0)."""

    name = "parler"

    # Audio codec runs at 87 frames/s (model.config.audio_encoder.frame_rate);
    # the checkpoint ships a 2610-token (30s) generation cap, far more than
    # these short scam-script lines need. Capping tighter keeps a stuck/
    # slow-to-stop sample from burning a full 30s of autoregressive decoding.
    MAX_AUDIO_SECONDS = 15
    FRAME_RATE = 87

    def __init__(self, device: str = "cuda",
                 model_id: str = "ai4bharat/indic-parler-tts"):
        try:
            import torch
            from parler_tts import ParlerTTSForConditionalGeneration
            from transformers import AutoTokenizer
        except ImportError as e:
            raise ImportError(
                "Synthesis extras missing — run: pip install -e .[synth]"
            ) from e
        self._torch = torch
        self.device = device if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.model = ParlerTTSForConditionalGeneration.from_pretrained(
            model_id, torch_dtype=dtype
        ).to(self.device)
        self.model.eval()
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.desc_tokenizer = AutoTokenizer.from_pretrained(
            self.model.config.text_encoder._name_or_path
        )
        self.sr = int(self.model.config.sampling_rate)

    def synthesize(self, text: str, description: str,
                   reference_wav: Path | None = None) -> np.ndarray:
        torch = self._torch
        desc_ids = self.desc_tokenizer(
            description, return_tensors="pt"
        ).to(self.device)
        prompt_ids = self.tokenizer(text, return_tensors="pt").to(self.device)
        with torch.no_grad():
            audio = self.model.generate(
                input_ids=desc_ids.input_ids,
                attention_mask=desc_ids.attention_mask,
                prompt_input_ids=prompt_ids.input_ids,
                prompt_attention_mask=prompt_ids.attention_mask,
                max_new_tokens=self.MAX_AUDIO_SECONDS * self.FRAME_RATE,
            )
        return _to_16k(audio.cpu().numpy(), self.sr)


class XTTSEngine:
    """Coqui XTTS-v2 — CPML licence: NON-COMMERCIAL, research use only."""

    name = "xtts"

    def __init__(self, device: str = "cuda", accept_noncommercial: bool = False):
        if not accept_noncommercial:
            raise RuntimeError(
                "XTTS-v2 is released under the Coqui Public Model License "
                "(non-commercial). Pass --accept-noncommercial to confirm "
                "this dataset is for research evaluation only and will not "
                "feed any commercial artifact."
            )
        try:
            import torch
            from TTS.api import TTS
        except ImportError as e:
            raise ImportError(
                "Synthesis extras missing — run: pip install -e .[synth]"
            ) from e
        use_gpu = device == "cuda" and torch.cuda.is_available()
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(
            "cuda" if use_gpu else "cpu"
        )
        self.sr = 24_000  # XTTS-v2 native output rate

    def synthesize(self, text: str, description: str = "",
                   reference_wav: Path | None = None,
                   language: str = "hi") -> np.ndarray:
        if reference_wav is None:
            raise ValueError("XTTS requires --ref-dir with speaker wav/flac files.")
        wav = self.tts.tts(
            text=text, speaker_wav=str(reference_wav), language=language
        )
        return _to_16k(np.asarray(wav), self.sr)


def build_engine(name: str, device: str, accept_noncommercial: bool):
    if name == "parler":
        return ParlerIndicEngine(device=device)
    if name == "xtts":
        return XTTSEngine(device=device,
                          accept_noncommercial=accept_noncommercial)
    raise ValueError(f"Unknown engine {name!r} (choose: parler, xtts)")
