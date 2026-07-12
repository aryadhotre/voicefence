"""Strip a training checkpoint down to inference-only weights.

train.py's save() writes optimizer + AMP-scaler state alongside the model so a
run can be `--resume`d. Serving never needs either: for RawNet2 the Adam
moments alone are 141 MB against 70 MB of actual weights, and torch.load
materialises the whole file in RAM before anything can be discarded — so a
memory-capped server pays the full 212 MB as a peak-RSS spike at startup even
though it throws the optimizer away immediately. That spike is what OOM-kills
the 512 MB Render tier.

Dropping the two training-only keys is a pure serving-artifact change: the
forward pass reads `model` and nothing else, so scores are bit-identical (see
--verify, which proves it rather than assuming it).

Usage (from ml/):
    python -m awaaz_ml.strip_checkpoint --checkpoint runs/rawnet2_v3_hien/best.pt \
        --out runs/rawnet2_v3_hien/best_inference.pt
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import torch

# Written by train.py for --resume only; the forward pass never reads them.
TRAINING_ONLY_KEYS = ("optimizer", "scaler")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def strip_checkpoint(src: Path, dst: Path) -> dict:
    """Copy `src` to `dst` without the training-only keys. Returns a summary."""
    ck = torch.load(src, map_location="cpu", weights_only=False)

    dropped = {}
    for key in TRAINING_ONLY_KEYS:
        if key in ck:
            dropped[key] = _state_bytes(ck[key])

    keep = {k: v for k, v in ck.items() if k not in TRAINING_ONLY_KEYS}
    if "model" not in keep:
        raise KeyError(
            f"{src} has no 'model' key — this does not look like a checkpoint "
            "written by awaaz_ml.train."
        )

    dst.parent.mkdir(parents=True, exist_ok=True)
    torch.save(keep, dst)
    return {
        "dropped": dropped,
        "kept_keys": sorted(keep),
        "src_bytes": src.stat().st_size,
        "dst_bytes": dst.stat().st_size,
    }


def _state_bytes(state: object) -> int:
    """Total bytes of tensors nested anywhere in an optimizer/scaler state dict."""
    if torch.is_tensor(state):
        return state.numel() * state.element_size()
    if isinstance(state, dict):
        return sum(_state_bytes(v) for v in state.values())
    if isinstance(state, (list, tuple)):
        return sum(_state_bytes(v) for v in state)
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    info = strip_checkpoint(args.checkpoint, args.out)

    for key, nbytes in info["dropped"].items():
        print(f"dropped {key:<10} {nbytes / 1e6:8.1f} MB")
    print(f"kept       {', '.join(info['kept_keys'])}")
    print(f"size       {info['src_bytes'] / 1e6:.1f} MB -> "
          f"{info['dst_bytes'] / 1e6:.1f} MB")
    print(f"sha256     {_sha256(args.out)}")


if __name__ == "__main__":
    main()
