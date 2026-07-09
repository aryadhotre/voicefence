"""Metrics: Equal Error Rate (EER) and score-file IO.

Score convention throughout the project: HIGHER score = more bonafide-like.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np


def compute_eer(
    bonafide_scores: np.ndarray, spoof_scores: np.ndarray
) -> tuple[float, float]:
    """Compute EER and the decision threshold at the EER operating point.

    Args:
        bonafide_scores: scores for genuine trials (higher = more bonafide).
        spoof_scores: scores for spoofed trials.

    Returns:
        (eer, threshold). Scores >= threshold are accepted as bonafide.
    """
    bonafide_scores = np.asarray(bonafide_scores, dtype=np.float64).ravel()
    spoof_scores = np.asarray(spoof_scores, dtype=np.float64).ravel()
    if bonafide_scores.size == 0 or spoof_scores.size == 0:
        raise ValueError("Both bonafide and spoof score sets must be non-empty.")

    scores = np.concatenate([bonafide_scores, spoof_scores])
    labels = np.concatenate(
        [np.ones_like(bonafide_scores), np.zeros_like(spoof_scores)]
    )

    order = np.argsort(scores, kind="mergesort")  # ascending; stable
    scores = scores[order]
    labels = labels[order]

    n_bona = bonafide_scores.size
    n_spoof = spoof_scores.size

    # Sweep threshold just above each sorted score:
    # FRR(i) = bonafide with score <= scores[i], rejected.
    # FAR(i) = spoof with score >  scores[i], accepted.
    cum_bona = np.cumsum(labels)
    cum_spoof = np.cumsum(1 - labels)
    frr = cum_bona / n_bona
    far = (n_spoof - cum_spoof) / n_spoof

    # Include the "accept everything" endpoint (threshold below min score).
    frr = np.concatenate([[0.0], frr])
    far = np.concatenate([[1.0], far])
    thresholds = np.concatenate([[scores[0] - 1e-8], scores])

    idx = int(np.argmin(np.abs(far - frr)))
    eer = float((far[idx] + frr[idx]) / 2.0)
    return eer, float(thresholds[idx])


def write_scores(
    path: str | Path, utts: list[str], scores: np.ndarray, labels: list[str]
) -> None:
    """Write TSV: utt_id <TAB> score <TAB> label."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for u, s, l in zip(utts, scores, labels):
            f.write(f"{u}\t{float(s):.6f}\t{l}\n")


def read_scores(path: str | Path) -> tuple[list[str], np.ndarray, list[str]]:
    utts: list[str] = []
    scores: list[float] = []
    labels: list[str] = []
    with Path(path).open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            u, s, l = line.split("\t")
            utts.append(u)
            scores.append(float(s))
            labels.append(l)
    return utts, np.asarray(scores, dtype=np.float64), labels
