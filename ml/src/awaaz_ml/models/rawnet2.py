"""RawNet2-style end-to-end anti-spoofing model (raw waveform input).

Architecture follows the RawNet2 countermeasure of Tak et al. (2021),
"End-to-end anti-spoofing with RawNet2" (ICASSP), as used in the ASVspoof
2021 baselines:

    raw wave → SincConv (mel-initialised band-pass bank) → |.| → maxpool
             → 2 residual blocks (20 ch) + 4 residual blocks (128 ch),
               each with Filter-wise feature Map Scaling (FMS)
             → 3-layer GRU (1024) → FC → 2 logits [spoof, bonafide]

Score convention: score = logit_bonafide − logit_spoof (higher = bonafide).
Default input length 64600 samples (≈4.04 s @ 16 kHz).
"""

from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


def _hz_to_mel(hz: torch.Tensor) -> torch.Tensor:
    return 2595.0 * torch.log10(1.0 + hz / 700.0)


def _mel_to_hz(mel: torch.Tensor) -> torch.Tensor:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


class SincConv(nn.Module):
    """Bank of parameterised sinc band-pass filters (SincNet-style).

    Filters are mel-spaced across [30 Hz, sr/2 − 100 Hz]. With
    trainable=False (the RawNet2 anti-spoofing default) the filter bank is
    precomputed once and registered as a buffer.
    """

    def __init__(
        self,
        out_channels: int = 20,
        kernel_size: int = 1025,
        sample_rate: int = 16_000,
        trainable: bool = False,
        min_hz: float = 30.0,
    ):
        super().__init__()
        if kernel_size % 2 == 0:
            kernel_size += 1  # need symmetric filters
        self.out_channels = out_channels
        self.kernel_size = kernel_size
        self.sample_rate = sample_rate
        self.trainable = trainable

        max_hz = sample_rate / 2 - 100.0
        mel = torch.linspace(
            _hz_to_mel(torch.tensor(min_hz)).item(),
            _hz_to_mel(torch.tensor(max_hz)).item(),
            out_channels + 1,
        )
        hz = _mel_to_hz(mel)
        low_hz = hz[:-1].clone()                     # (C,)
        band_hz = (hz[1:] - hz[:-1]).clone()         # (C,)

        n = (kernel_size - 1) // 2
        t = torch.arange(-n, n + 1, dtype=torch.float32) / sample_rate  # (K,)
        window = torch.hamming_window(kernel_size, periodic=False)

        if trainable:
            self.low_hz_ = nn.Parameter(low_hz)
            self.band_hz_ = nn.Parameter(band_hz)
            self.register_buffer("t_", t)
            self.register_buffer("window_", window)
        else:
            filters = self._build_filters(low_hz, band_hz, t, window)
            self.register_buffer("filters", filters)

    def _build_filters(
        self,
        low_hz: torch.Tensor,
        band_hz: torch.Tensor,
        t: torch.Tensor,
        window: torch.Tensor,
    ) -> torch.Tensor:
        low = torch.clamp(low_hz, min=1.0)                       # (C,)
        high = torch.clamp(low + torch.abs(band_hz),
                           max=self.sample_rate / 2 - 1.0)       # (C,)
        low = low.unsqueeze(1)    # (C,1)
        high = high.unsqueeze(1)  # (C,1)
        t = t.unsqueeze(0)        # (1,K)
        # Ideal band-pass: 2*f2*sinc(2*f2*t) − 2*f1*sinc(2*f1*t);
        # torch.sinc(x) = sin(πx)/(πx).
        filt = 2 * high * torch.sinc(2 * high * t) - 2 * low * torch.sinc(2 * low * t)
        filt = filt * window.unsqueeze(0)
        # Per-filter peak normalisation for stable activation scale.
        filt = filt / (filt.abs().max(dim=1, keepdim=True).values + 1e-8)
        return filt.unsqueeze(1)  # (C,1,K)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, 1, T) → (B, C, T)"""
        if self.trainable:
            filters = self._build_filters(
                self.low_hz_, self.band_hz_, self.t_, self.window_
            )
        else:
            filters = self.filters
        return F.conv1d(x, filters, padding=self.kernel_size // 2)


class ResBlockFMS(nn.Module):
    """RawNet2 residual block with Filter-wise feature Map Scaling.

    (BN → LeakyReLU →) Conv3 → BN → LeakyReLU → Conv3, + skip (1×1 if channel
    change), → MaxPool(3) → FMS: y = y·s + s with s = σ(FC(GAP(y))).
    """

    def __init__(self, in_ch: int, out_ch: int, first: bool = False):
        super().__init__()
        self.first = first
        if not first:
            self.bn1 = nn.BatchNorm1d(in_ch)
        self.conv1 = nn.Conv1d(in_ch, out_ch, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(out_ch)
        self.conv2 = nn.Conv1d(out_ch, out_ch, kernel_size=3, padding=1)
        self.act = nn.LeakyReLU(0.3)
        self.downsample = (
            nn.Conv1d(in_ch, out_ch, kernel_size=1) if in_ch != out_ch else None
        )
        self.pool = nn.MaxPool1d(3)
        self.fms = nn.Linear(out_ch, out_ch)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        y = x if self.first else self.act(self.bn1(x))
        y = self.conv1(y)
        y = self.act(self.bn2(y))
        y = self.conv2(y)
        if self.downsample is not None:
            x = self.downsample(x)
        y = self.pool(y + x)
        s = torch.sigmoid(self.fms(F.adaptive_avg_pool1d(y, 1).squeeze(-1)))
        s = s.unsqueeze(-1)
        return y * s + s


class RawNet2(nn.Module):
    def __init__(
        self,
        sinc_filters: int = 20,
        sinc_kernel: int = 1025,
        sinc_trainable: bool = False,
        gru_hidden: int = 1024,
        gru_layers: int = 3,
        fc_hidden: int = 1024,
        num_classes: int = 2,
        sample_rate: int = 16_000,
    ):
        super().__init__()
        self.sinc = SincConv(
            out_channels=sinc_filters,
            kernel_size=sinc_kernel,
            sample_rate=sample_rate,
            trainable=sinc_trainable,
        )
        self.first_pool = nn.MaxPool1d(3)
        self.first_bn = nn.BatchNorm1d(sinc_filters)
        self.act = nn.LeakyReLU(0.3)

        c1, c2 = sinc_filters, 128
        self.blocks = nn.Sequential(
            ResBlockFMS(c1, c1, first=True),
            ResBlockFMS(c1, c1),
            ResBlockFMS(c1, c2),
            ResBlockFMS(c2, c2),
            ResBlockFMS(c2, c2),
            ResBlockFMS(c2, c2),
        )
        self.pre_gru_bn = nn.BatchNorm1d(c2)
        self.gru = nn.GRU(
            input_size=c2,
            hidden_size=gru_hidden,
            num_layers=gru_layers,
            batch_first=True,
        )
        self.fc1 = nn.Linear(gru_hidden, fc_hidden)
        self.fc2 = nn.Linear(fc_hidden, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, T) raw waveform → logits (B, 2) as [spoof, bonafide]."""
        if x.dim() == 2:
            x = x.unsqueeze(1)  # (B,1,T)
        x = self.sinc(x)
        x = self.first_pool(torch.abs(x))
        x = self.act(self.first_bn(x))
        x = self.blocks(x)
        x = self.act(self.pre_gru_bn(x))
        x = x.transpose(1, 2)  # (B, T', C)
        self.gru.flatten_parameters()
        out, _ = self.gru(x)
        x = out[:, -1, :]
        x = self.act(self.fc1(x))
        return self.fc2(x)

    @staticmethod
    def scores_from_logits(logits: torch.Tensor) -> torch.Tensor:
        """LLR-style score: higher = more bonafide."""
        return logits[:, 1] - logits[:, 0]


def build_model(model_cfg: dict) -> RawNet2:
    return RawNet2(
        sinc_filters=model_cfg.get("sinc_filters", 20),
        sinc_kernel=model_cfg.get("sinc_kernel", 1025),
        sinc_trainable=model_cfg.get("sinc_trainable", False),
        gru_hidden=model_cfg.get("gru_hidden", 1024),
        gru_layers=model_cfg.get("gru_layers", 3),
        fc_hidden=model_cfg.get("fc_hidden", 1024),
    )
