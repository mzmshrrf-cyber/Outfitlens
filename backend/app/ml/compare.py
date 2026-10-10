"""Visual similarity via MobileNetV3 embeddings (cosine similarity)."""
from __future__ import annotations

import io
import numpy as np
from PIL import Image
import torch

from app.ml.pipeline import get_extractor, img_transform


def _features_from_bytes(image_bytes: bytes) -> np.ndarray:
    """Extract 576-d features from raw image bytes without writing to disk."""
    extractor = get_extractor()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = img_transform(img).unsqueeze(0)
    device = next(extractor.parameters()).device
    tensor = tensor.to(device)
    with torch.no_grad():
        features = extractor(tensor)
    return features.squeeze(0).cpu().numpy()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def compare_images(image_a_bytes: bytes, image_b_bytes: bytes) -> dict:
    """
    Compare two images using deep visual embeddings.

    Returns a similarity score in [0, 1] (cosine mapped from [-1,1] to [0,1])
    plus human-readable interpretation and explicit limitations.
    """
    feat_a = _features_from_bytes(image_a_bytes)
    feat_b = _features_from_bytes(image_b_bytes)

    raw_cosine = cosine_similarity(feat_a, feat_b)
    # Map cosine [-1, 1] → [0, 1] for a friendlier UI percentage
    score = (raw_cosine + 1.0) / 2.0
    score = max(0.0, min(1.0, score))

    if score >= 0.92:
        label = "Very similar"
        explanation = (
            "The images share highly overlapping visual features "
            "(shapes, textures, and overall appearance)."
        )
    elif score >= 0.78:
        label = "Moderately similar"
        explanation = (
            "The images share some visual characteristics but also differ "
            "in notable ways (pose, crop, color, or object detail)."
        )
    elif score >= 0.60:
        label = "Somewhat related"
        explanation = (
            "There is limited visual overlap. They may share a category or "
            "palette but are not close matches."
        )
    else:
        label = "Quite different"
        explanation = (
            "The embeddings diverge strongly — the scenes, objects, or styles "
            "appear visually distinct."
        )

    return {
        "similarity_score": round(score, 4),
        "raw_cosine": round(raw_cosine, 4),
        "label": label,
        "explanation": explanation,
        "method": "MobileNetV3-Small 576-d embeddings + cosine similarity",
        "limitations": [
            "This is visual embedding similarity, not identity verification or duplicate detection.",
            "It does not understand text in images, brand logos, or fine-grained product SKUs reliably.",
            "Lighting, crop, background, and pose can change the score even when the subject is the same.",
            "It cannot perform virtual try-on, garment fit estimation, or pixel-perfect matching.",
            "Scores are relative heuristics — treat them as guidance, not ground truth.",
        ],
    }
