"""Image similarity via Amazon Titan Multimodal Embeddings (Bedrock) — no PyTorch."""
from __future__ import annotations

import base64
import io
import json
import os

import boto3
import numpy as np
from botocore.exceptions import ClientError
from fastapi import HTTPException
from PIL import Image

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
EMBED_MODEL = os.getenv("BEDROCK_EMBED_MODEL_ID", "amazon.titan-embed-image-v1")


def _client():
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


def _jpeg_b64(image_bytes: bytes, max_side: int = 384) -> str:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _embed(image_bytes: bytes) -> np.ndarray:
    body = {
        "inputImage": _jpeg_b64(image_bytes),
        "embeddingConfig": {"outputEmbeddingLength": 256},
    }
    try:
        response = _client().invoke_model(
            modelId=EMBED_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        payload = json.loads(response["body"].read())
    except ClientError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Bedrock embedding failed: {exc.response.get('Error', {}).get('Message', str(exc))}",
        ) from exc

    embedding = payload.get("embedding")
    if not embedding:
        raise HTTPException(status_code=502, detail="Bedrock returned no embedding vector.")
    return np.array(embedding, dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def compare_images(image_a_bytes: bytes, image_b_bytes: bytes) -> dict:
    feat_a = _embed(image_a_bytes)
    feat_b = _embed(image_b_bytes)
    raw_cosine = cosine_similarity(feat_a, feat_b)
    score = max(0.0, min(1.0, (raw_cosine + 1.0) / 2.0))

    if score >= 0.92:
        label, explanation = (
            "Very similar",
            "The images share highly overlapping visual features.",
        )
    elif score >= 0.78:
        label, explanation = (
            "Moderately similar",
            "The images share some visual characteristics but also differ.",
        )
    elif score >= 0.60:
        label, explanation = (
            "Somewhat related",
            "There is limited visual overlap.",
        )
    else:
        label, explanation = (
            "Quite different",
            "The embeddings diverge strongly.",
        )

    return {
        "similarity_score": round(score, 4),
        "raw_cosine": round(raw_cosine, 4),
        "label": label,
        "explanation": explanation,
        "method": f"Amazon Bedrock {EMBED_MODEL} embeddings + cosine similarity",
        "limitations": [
            "This is visual embedding similarity, not identity verification.",
            "Lighting, crop, and pose can change scores for the same subject.",
            "It cannot perform virtual try-on or measure garment fit.",
            "Scores are relative heuristics — treat them as guidance, not ground truth.",
        ],
    }
