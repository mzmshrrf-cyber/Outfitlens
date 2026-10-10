import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure the backend root directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env from project root and backend/
_backend_root = Path(__file__).resolve().parents[1]
_project_root = _backend_root.parent
load_dotenv(_project_root / ".env")
load_dotenv(_backend_root / ".env")

from app.api.endpoints import router as api_router

SERVERLESS = os.getenv("OUTFITLENS_SERVERLESS", "").lower() in {"1", "true", "yes"}

app = FastAPI(
    title="OutfitLens API",
    description=(
        "OutfitLens backend: visual image comparison (MobileNet embeddings), "
        "AI virtual try-on (fal.ai FASHN), and optional local image-class lab."
    ),
    version="2.0.0",
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost",
    "http://127.0.0.1",
]

# Optional production frontend origin
extra_origin = os.getenv("FRONTEND_ORIGIN")
if extra_origin:
    origins.append(extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if extra_origin else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    print("--------------------------------------------------")
    print("OutfitLens Backend Startup")
    if SERVERLESS:
        print("Mode: serverless (Amazon Bedrock compare + try-on)")
    else:
        print("Pre-loading MobileNetV3 Small weights...")
        try:
            from app.ml.pipeline import get_extractor

            get_extractor()
            print("MobileNetV3 small backbone weights loaded successfully!")
        except Exception as e:
            print(f"Warning: Failed to cache MobileNetV3 weights on startup: {e}")
    print(f"AWS region: {os.getenv('AWS_REGION') or os.getenv('AWS_DEFAULT_REGION') or 'us-east-1'}")
    print("Virtual try-on: Amazon Bedrock (Nova Lite + Stability Search & Replace)")
    print("--------------------------------------------------")


app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
