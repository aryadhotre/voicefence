"""Shared utilities: seeding, device selection, config loading, CSV logging."""

from __future__ import annotations

import csv
import os
import random
from pathlib import Path
from typing import Any

import numpy as np
import torch
import yaml


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def get_device(prefer: str | None = None) -> torch.device:
    """Resolve compute device. prefer: 'cuda' | 'cpu' | None (auto)."""
    if prefer == "cpu":
        return torch.device("cpu")
    if torch.cuda.is_available():
        torch.backends.cudnn.benchmark = True
        return torch.device("cuda")
    if prefer == "cuda":
        raise RuntimeError(
            "CUDA requested but not available. Install a CUDA build of PyTorch "
            "or train on Kaggle/Colab (see ml/README.md)."
        )
    return torch.device("cpu")


def load_config(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if not isinstance(cfg, dict):
        raise ValueError(f"Config {path} did not parse to a mapping.")
    cfg["_config_path"] = str(path.resolve())
    return cfg


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def count_parameters(model: torch.nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


class CSVLogger:
    """Append-only CSV logger; writes header once."""

    def __init__(self, path: str | Path, fieldnames: list[str]):
        self.path = Path(path)
        self.fieldnames = fieldnames
        self._header_written = self.path.exists() and self.path.stat().st_size > 0
        ensure_dir(self.path.parent)

    def log(self, row: dict[str, Any]) -> None:
        with self.path.open("a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.fieldnames)
            if not self._header_written:
                writer.writeheader()
                self._header_written = True
            writer.writerow(row)


def worker_count(requested: int) -> int:
    """Clamp DataLoader workers to available CPUs (Windows-safe)."""
    cpus = os.cpu_count() or 1
    return max(0, min(requested, cpus))
