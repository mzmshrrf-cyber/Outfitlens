"""Unit tests for OutfitLens compare helpers and URL security."""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest
from PIL import Image

# Ensure backend package imports resolve when running from repo root or backend/
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))


def _solid_jpeg(color: tuple[int, int, int], size=(128, 128)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_cosine_identical_vectors():
    import numpy as np
    from app.ml.compare import cosine_similarity

    v = np.array([1.0, 2.0, 3.0])
    assert cosine_similarity(v, v) == pytest.approx(1.0)


def test_cosine_orthogonal():
    import numpy as np
    from app.ml.compare import cosine_similarity

    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert cosine_similarity(a, b) == pytest.approx(0.0)


def test_compare_identical_images():
    from app.ml.compare import compare_images

    img = _solid_jpeg((40, 120, 200))
    result = compare_images(img, img)
    assert result["similarity_score"] >= 0.99
    assert result["label"]
    assert isinstance(result["limitations"], list)
    assert len(result["limitations"]) >= 3


def test_compare_different_images_lower_score():
    from app.ml.compare import compare_images

    a = _solid_jpeg((255, 0, 0))
    b = _solid_jpeg((0, 0, 255))
    result = compare_images(a, b)
    assert 0.0 <= result["similarity_score"] <= 1.0


def test_validate_blocks_localhost():
    from fastapi import HTTPException
    from app.services.product_url import validate_public_http_url

    with pytest.raises(HTTPException) as exc:
        validate_public_http_url("http://localhost/admin")
    assert exc.value.status_code == 400


def test_validate_blocks_private_ip_literal():
    from fastapi import HTTPException
    from app.services.product_url import validate_public_http_url

    with pytest.raises(HTTPException):
        validate_public_http_url("http://127.0.0.1/secret")


def test_validate_blocks_non_http():
    from fastapi import HTTPException
    from app.services.product_url import validate_public_http_url

    with pytest.raises(HTTPException):
        validate_public_http_url("file:///etc/passwd")


def test_tryon_status_shape():
    from app.services.tryon import tryon_status

    status = tryon_status()
    assert status["provider"] == "Amazon Bedrock"
    assert "configured" in status
    assert "nova" in status.get("vision_model", "").lower() or "bedrock" in status["provider"].lower()
    assert status.get("model")
