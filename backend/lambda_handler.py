"""AWS Lambda entrypoint for OutfitLens API (Mangum + FastAPI)."""
import os

# Force Bedrock compare path in Lambda (no PyTorch layer)
os.environ.setdefault("OUTFITLENS_SERVERLESS", "1")
os.environ.setdefault("USE_BEDROCK_COMPARE", "1")
os.environ.setdefault(
    "BEDROCK_IMAGE_MODEL_ID",
    "us.stability.stable-image-search-replace-v1:0",
)
os.environ.setdefault("BEDROCK_VISION_MODEL_ID", "amazon.nova-lite-v1:0")

from mangum import Mangum
from app.main import app

handler = Mangum(app, lifespan="off")
