"""
Virtual try-on via Amazon Bedrock (AWS only, pay-per-use).

Active pipeline (Nova Canvas / Titan Image are Legacy-EOL on many accounts):
  1) Amazon Nova Lite — describe the garment photo
  2) Stability AI Search & Replace on Bedrock (US inference profile) —
     replace clothing region on the person photo using that description

This is generative Bedrock editing — not image classification.
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from PIL import Image

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
VISION_MODEL = os.getenv("BEDROCK_VISION_MODEL_ID", "amazon.nova-lite-v1:0")
IMAGE_MODEL = os.getenv(
    "BEDROCK_IMAGE_MODEL_ID",
    "us.stability.stable-image-search-replace-v1:0",
)
MAX_UPLOAD_BYTES = 8_000_000

SEARCH_PROMPT_BY_CATEGORY = {
    "auto": "clothing shirt top",
    "tops": "shirt top blouse jacket",
    "shirt": "shirt",
    "upper": "shirt top",
    "upper_body": "shirt top",
    "bottoms": "pants trousers jeans skirt",
    "pants": "pants trousers",
    "lower": "pants",
    "lower_body": "pants",
    "one-pieces": "dress outfit",
    "dress": "dress",
    "dresses": "dress",
    "full_body": "outfit clothing",
}


def _client():
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


def tryon_status() -> dict:
    configured = True
    detail = "Uses IAM / AWS CLI credentials for Amazon Bedrock Runtime."
    try:
        creds = boto3.Session(region_name=AWS_REGION).get_credentials()
        if creds is None:
            configured = False
            detail = "No AWS credentials found. Run `aws configure` or attach an IAM role."
    except Exception as exc:  # noqa: BLE001
        configured = False
        detail = str(exc)

    return {
        "provider": "Amazon Bedrock",
        "model": IMAGE_MODEL,
        "vision_model": VISION_MODEL,
        "task": "SEARCH_AND_REPLACE",
        "region": AWS_REGION,
        "configured": configured,
        "estimated_cost_note": (
            "Pay-per-use Bedrock: Nova Lite tokens + Stability Search & Replace (~$0.07/image typical). "
            "No always-on GPU."
        ),
        "notes": [
            "Uses Amazon Bedrock only (no fal.ai / external try-on SaaS).",
            "Nova Canvas is Legacy; this stack uses active Nova Lite + Stability Search & Replace.",
            "Generative preview only — not a guarantee of real-world fit or size.",
            "Images are sent to Bedrock for inference and are not stored as a long-term gallery.",
            detail,
        ],
        "setup": (
            "Accept the Stability model agreement in Bedrock if prompted, enable Nova Lite, "
            "and grant bedrock:InvokeModel (including inference profiles) on the deployment role."
        ),
    }


def _prepare_jpeg_b64(image_bytes: bytes, max_side: int = 1024) -> str:
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Each image must be 8MB or smaller.")
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    w, h = img.size
    # Stability: each side >= 64, aspect between 1:2.5 and 2.5:1, pixel cap ~9.4MP
    if max(w, h) > max_side:
        if w >= h:
            img = img.resize((max_side, max(64, int(h * max_side / w))), Image.Resampling.LANCZOS)
        else:
            img = img.resize((max(64, int(w * max_side / h)), max_side), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _describe_garment(garment_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(garment_bytes)).convert("RGB")
    img.thumbnail((512, 512))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    raw = buf.getvalue()

    try:
        response = _client().converse(
            modelId=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"image": {"format": "jpeg", "source": {"bytes": raw}}},
                        {
                            "text": (
                                "Describe this clothing item for a photo-edit prompt in one short sentence. "
                                "Include garment type, primary colors, pattern, and style. "
                                "Do not mention backgrounds, people, or the photo itself."
                            )
                        },
                    ],
                }
            ],
            inferenceConfig={"maxTokens": 120, "temperature": 0.2},
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"AccessDeniedException", "ResourceNotFoundException", "ValidationException"}:
            return "a realistic clothing garment matching the reference product photo"
        raise HTTPException(
            status_code=502,
            detail=f"Bedrock vision failed: {exc.response.get('Error', {}).get('Message', str(exc))}",
        ) from exc

    text = ""
    for part in response.get("output", {}).get("message", {}).get("content", []):
        if "text" in part:
            text += part["text"]
    text = re.sub(r"\s+", " ", (text or "").strip())
    return (text or "a realistic clothing garment matching the reference product photo")[:400]


def _search_replace(person_b64: str, search_prompt: str, replace_prompt: str) -> str:
    payload = {
        "image": person_b64,
        "search_prompt": search_prompt,
        "prompt": replace_prompt,
        "output_format": "png",
        "grow_mask": 8,
        "negative_prompt": "deformed hands, blurry face, different person, text artifacts, low quality",
    }
    try:
        response = _client().invoke_model(
            modelId=IMAGE_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload),
        )
        body = json.loads(response["body"].read())
    except ClientError as exc:
        msg = exc.response.get("Error", {}).get("Message", str(exc))
        code = exc.response.get("Error", {}).get("Code", "ClientError")
        raise HTTPException(
            status_code=502,
            detail=f"Bedrock image edit failed ({code}): {msg}",
        ) from exc
    except BotoCoreError as exc:
        raise HTTPException(status_code=502, detail=f"AWS Bedrock error: {exc}") from exc

    images = body.get("images") or []
    if not images:
        raise HTTPException(status_code=502, detail=f"Bedrock returned no image: {body}")
    return images[0]


def normalize_search_prompt(category: Optional[str]) -> str:
    key = (category or "auto").strip().lower().replace(" ", "_").replace("-", "_")
    return SEARCH_PROMPT_BY_CATEGORY.get(key, SEARCH_PROMPT_BY_CATEGORY["auto"])


async def run_tryon(
    person_bytes: bytes,
    garment_bytes_list: list[bytes],
    category: str = "auto",
    mode: str = "balanced",
    person_content_type: str = "image/jpeg",
    garment_content_types: Optional[list[str]] = None,
) -> dict:
    del person_content_type, garment_content_types

    if not garment_bytes_list:
        raise HTTPException(status_code=400, detail="At least one garment image is required.")
    if len(garment_bytes_list) > 3:
        raise HTTPException(status_code=400, detail="A maximum of 3 garments can be applied per request.")

    status = tryon_status()
    if not status["configured"]:
        raise HTTPException(
            status_code=503,
            detail=(
                "AWS credentials not configured for Bedrock. "
                "Run `aws configure` or attach an IAM role with bedrock:InvokeModel."
            ),
        )

    search_prompt = normalize_search_prompt(category)
    current_person = _prepare_jpeg_b64(person_bytes)
    steps: list[dict] = []

    for idx, g_bytes in enumerate(garment_bytes_list):
        description = _describe_garment(g_bytes)
        replace_prompt = (
            f"{description}, worn naturally by the same person, photorealistic fashion photo"
        )
        result_b64 = _search_replace(current_person, search_prompt, replace_prompt)
        data_url = f"data:image/png;base64,{result_b64}"
        steps.append(
            {
                "garment_index": idx,
                "garment_description": description,
                "search_prompt": search_prompt,
                "result_data_url": data_url,
            }
        )
        current_person = result_b64

    final = steps[-1]
    return {
        "provider": "Amazon Bedrock",
        "model": IMAGE_MODEL,
        "vision_model": VISION_MODEL,
        "category": category,
        "mode": mode,
        "garment_count": len(garment_bytes_list),
        "result_url": None,
        "result_data_url": final["result_data_url"],
        "steps": steps,
        "disclaimer": (
            "AI generative preview via Amazon Bedrock (Nova Lite + Stability Search & Replace). "
            "Not a guarantee of real-world fit, size, or fabric behavior."
        ),
        "estimated_cost_usd": round(0.07 * len(garment_bytes_list), 3),
        "region": AWS_REGION,
    }
