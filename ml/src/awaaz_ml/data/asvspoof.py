"""ASVspoof 2019 LA protocol parsing + a generic multi-source audio dataset.

Protocol line format (5 whitespace-separated columns), shared by ASVspoof and
by every set this project generates (codec-augmented, synthetic hi-en):

    SPEAKER_ID  UTT_ID  -  ATTACK_ID  KEY

where KEY is 'bonafide' or 'spoof' and ATTACK_ID is 'A01'..'A19', an engine
tag (e.g. 'parler', 'xtts'), or '-' for bonafide.

Labels: bonafide = 1, spoof = 0 (class order [spoof, bonafide] everywhere).
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset

from .audio import load_audio, pad_or_crop

BONAFIDE = 1
SPOOF = 0

_AUDIO_SUBDIR_CANDIDATES = ("flac", "wav", "")
_AUDIO_EXT_CANDIDATES = (".flac", ".wav", ".ogg")


@dataclass(frozen=True)
class ProtocolEntry:
    speaker: str
    utt: str
    attack: str
    key: str  # 'bonafide' | 'spoof'

    @property
    def label(self) -> int:
        return BONAFIDE if self.key == "bonafide" else SPOOF


def parse_protocol(path: str | Path) -> list[ProtocolEntry]:
    entries: list[ProtocolEntry] = []
    with Path(path).open("r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) != 5:
                raise ValueError(
                    f"{path}:{lineno}: expected 5 columns, got {len(parts)}: {line!r}"
                )
            speaker, utt, _, attack, key = parts
            if key not in ("bonafide", "spoof"):
                raise ValueError(f"{path}:{lineno}: bad key {key!r}")
            entries.append(ProtocolEntry(speaker, utt, attack, key))
    if not entries:
        raise ValueError(f"Protocol {path} is empty.")
    return entries


def resolve_audio(audio_root: str | Path, utt: str) -> Path | None:
    """Find audio for an utt id under root/{flac,wav,.}/utt{.flac,.wav,.ogg}."""
    root = Path(audio_root)
    for sub in _AUDIO_SUBDIR_CANDIDATES:
        for ext in _AUDIO_EXT_CANDIDATES:
            p = (root / sub / f"{utt}{ext}") if sub else (root / f"{utt}{ext}")
            if p.is_file():
                return p
    return None


def build_items(
    sources: list[tuple[str | Path, str | Path]],
    max_items: int | None = None,
) -> list[tuple[Path, int, str, str]]:
    """Merge (protocol, audio_root) sources into [(path, label, utt, attack)].

    Missing audio files are skipped with a single summary warning per source —
    lets you e.g. codec-augment only a subset of the train set.
    """
    items: list[tuple[Path, int, str, str]] = []
    for protocol, audio_root in sources:
        entries = parse_protocol(protocol)
        missing = 0
        for e in entries:
            p = resolve_audio(audio_root, e.utt)
            if p is None:
                missing += 1
                continue
            items.append((p, e.label, e.utt, e.attack))
        if missing:
            warnings.warn(
                f"{missing}/{len(entries)} utterances in {protocol} not found "
                f"under {audio_root}; skipped."
            )
        if missing == len(entries):
            raise FileNotFoundError(
                f"No audio from {protocol} found under {audio_root} — "
                f"check the path."
            )
    if max_items is not None:
        items = items[:max_items]
    if not items:
        raise ValueError("Dataset is empty after merging sources.")
    return items


class AudioListDataset(Dataset):
    """Fixed-length waveform dataset over a merged item list.

    mode='train': random crop. mode='eval': deterministic left crop.
    Returns (waveform FloatTensor [num_samples], label int, utt str).
    """

    def __init__(
        self,
        items: list[tuple[Path, int, str, str]],
        num_samples: int,
        mode: str = "train",
    ):
        assert mode in ("train", "eval")
        self.items = items
        self.num_samples = int(num_samples)
        self.mode = mode

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, idx: int):
        path, label, utt, _attack = self.items[idx]
        x = load_audio(path)
        x = pad_or_crop(x, self.num_samples, random_crop=(self.mode == "train"))
        return torch.from_numpy(np.ascontiguousarray(x)), label, utt

    def class_counts(self) -> tuple[int, int]:
        """(n_spoof, n_bonafide)"""
        n_bona = sum(1 for _, l, _, _ in self.items if l == BONAFIDE)
        return len(self.items) - n_bona, n_bona


def asvspoof_la_paths(root: str | Path) -> dict[str, dict[str, Path]]:
    """Standard ASVspoof 2019 LA layout under `root` (the LA/ directory)."""
    root = Path(root)
    proto = root / "ASVspoof2019_LA_cm_protocols"
    return {
        "train": {
            "protocol": proto / "ASVspoof2019.LA.cm.train.trn.txt",
            "audio_root": root / "ASVspoof2019_LA_train",
        },
        "dev": {
            "protocol": proto / "ASVspoof2019.LA.cm.dev.trl.txt",
            "audio_root": root / "ASVspoof2019_LA_dev",
        },
        "eval": {
            "protocol": proto / "ASVspoof2019.LA.cm.eval.trl.txt",
            "audio_root": root / "ASVspoof2019_LA_eval",
        },
    }
