import os
import sys
import uvicorn

# Ensure the backend root directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as api_router
from app.ml.pipeline import get_extractor

# Initialize FastAPI App
app = FastAPI(
    title="Teachable Machine Clone API",
    description="Backend service for feature extraction, training, and predicting custom image classes.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend (typically runs on port 3000 or dockerized environments)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost",
    "http://127.0.0.1",
    "*"  # Fallback wildcard to allow smooth local/docker execution
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pre-load/cache MobileNetV3 weights on startup to avoid training latency
@app.on_event("startup")
def startup_event():
    print("--------------------------------------------------")
    print("Teachable Machine Backend Startup Hook")
    print("Pre-loading MobileNetV3 Small weights...")
    try:
        extractor = get_extractor()
        print("MobileNetV3 small backbone weights loaded successfully!")
    except Exception as e:
        print(f"Warning: Failed to cache MobileNetV3 weights on startup: {e}")
        print("Weights will be downloaded on first training/inference run.")
    print("--------------------------------------------------")

# Include Modular API Routers under /api
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    # Standard development uvicorn runner
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
