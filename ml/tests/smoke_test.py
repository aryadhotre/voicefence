"""Smoke test: verifies every component that can run without the real
dataset or GPU. Run from ml/ with the venv active:

    python tests/smoke_test.py

Covers: config load, protocol parse + dataset getitem (pad & crop paths),
model forward/backward, EER math, template expansion, codec round-trip
(whichever ffmpeg encoders are present).
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np

ML_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_DIR / "src"))

PASS = []


def check(name: str, fn) -> None:
    try:
        fn()
    except Exception as e:
        print(f"FAIL  {name}: {type(e).__name__}: {e}")
        raise
    PASS.append(name)
    print(f"ok    {name}")


def t_config():
    from awaaz_ml.utils import load_config
    cfg = load_config(ML_DIR / "configs" / "rawnet2_asvspoof_la.yaml")
    assert cfg["data"]["samples"] == 64600
    assert cfg["model"]["sinc_filters"] == 20


def t_protocol_and_dataset():
    import soundfile as sf
    import torch
    from awaaz_ml.data import AudioListDataset, build_items, parse_protocol

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        (root / "flac").mkdir()
        rng = np.random.default_rng(0)
        # short file (needs tile-pad) + long file (needs crop)
        sf.write(root / "flac" / "U1.flac",
                 rng.standard_normal(16000).astype(np.float32) * 0.1,
                 16000, subtype="PCM_16", format="FLAC")
        sf.write(root / "flac" / "U2.flac",
                 rng.standard_normal(16000 * 6).astype(np.float32) * 0.1,
                 16000, subtype="PCM_16", format="FLAC")
        proto = root / "protocol.txt"
        proto.write_text(
            "SPK1 U1 - - bonafide\nSPK1 U2 - A01 spoof\nSPK1 U3 - A01 spoof\n",
            encoding="utf-8",
        )
        entries = parse_protocol(proto)
        assert len(entries) == 3 and entries[0].label == 1 and entries[1].label == 0

        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # U3 intentionally missing
            items = build_items([(proto, root)])
        assert len(items) == 2  # U3 skipped

        for mode in ("train", "eval"):
            ds = AudioListDataset(items, 64600, mode=mode)
            for i in range(len(ds)):
                wav, label, utt = ds[i]
                assert isinstance(wav, torch.Tensor)
                assert wav.shape == (64600,) and wav.dtype == torch.float32
                assert label in (0, 1) and utt in ("U1", "U2")


def t_model_forward_backward():
    import torch
    from awaaz_ml.models.rawnet2 import RawNet2, build_model

    torch.manual_seed(0)
    model = build_model({"gru_hidden": 128, "gru_layers": 2, "fc_hidden": 128})
    x = torch.randn(2, 64600) * 0.1
    logits = model(x)
    assert logits.shape == (2, 2), logits.shape
    assert torch.isfinite(logits).all()
    loss = torch.nn.functional.cross_entropy(logits, torch.tensor([0, 1]))
    loss.backward()
    grads = [p.grad for p in model.parameters() if p.requires_grad]
    assert any(g is not None and torch.isfinite(g).all() and g.abs().sum() > 0
               for g in grads)
    scores = RawNet2.scores_from_logits(logits)
    assert scores.shape == (2,)
    # full-size model builds too
    full = build_model({})
    n = sum(p.numel() for p in full.parameters() if p.requires_grad)
    assert 10e6 < n < 40e6, f"unexpected param count {n}"


def t_eer():
    from awaaz_ml.metrics import compute_eer

    rng = np.random.default_rng(0)
    bona = rng.normal(3.0, 0.3, 2000)
    spoof = rng.normal(-3.0, 0.3, 2000)
    eer, thr = compute_eer(bona, spoof)
    assert eer < 0.01, eer
    assert -3 < thr < 3

    same_a = rng.normal(0, 1, 5000)
    same_b = rng.normal(0, 1, 5000)
    eer2, _ = compute_eer(same_a, same_b)
    assert 0.45 < eer2 < 0.55, eer2

    # perfect separation edge
    eer3, _ = compute_eer(np.array([1.0, 2.0]), np.array([-1.0, -2.0]))
    assert eer3 < 1e-9


def t_templates():
    from awaaz_ml.synth.templates import expand_templates

    sents = expand_templates(300, seed=7)
    assert len(sents) == 300
    texts = [s.text for s in sents]
    assert len(set(texts)) == 300, "duplicates generated"
    assert not any("{" in t or "}" in t for t in texts)
    langs = {s.lang for s in sents}
    assert langs == {"hi-en", "hi", "en"}
    ids = [s.sid for s in sents]
    assert len(set(ids)) == 300
    # determinism
    again = expand_templates(300, seed=7)
    assert [s.text for s in again] == texts


def t_codecs():
    import soundfile as sf
    from awaaz_ml.augment.codecs import CODECS, apply_codec, available_codecs

    specs = available_codecs(list(CODECS))  # warns+skips missing encoders
    assert specs, "no codecs available in this ffmpeg build"
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        t = np.linspace(0, 1.0, 16000, endpoint=False)
        tone = (0.4 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        src = td / "tone.flac"
        sf.write(src, tone, 16000, subtype="PCM_16", format="FLAC")
        for spec in specs:
            out = td / spec.name / "tone.flac"
            apply_codec(src, spec, out)
            y, sr = sf.read(out, dtype="float32")
            assert sr == 16000
            assert 0.5 * 16000 < y.shape[0] < 2.0 * 16000, (spec.name, y.shape)
            assert float(np.abs(y).max()) > 0.01, f"{spec.name}: silent output"
        print(f"      codecs verified: {[s.name for s in specs]}")


def main() -> None:
    check("config load", t_config)
    check("protocol + dataset", t_protocol_and_dataset)
    check("model forward/backward", t_model_forward_backward)
    check("EER metric", t_eer)
    check("template expansion", t_templates)
    check("codec round-trip", t_codecs)
    print(f"\nALL {len(PASS)} CHECKS PASSED")


if __name__ == "__main__":
    main()
