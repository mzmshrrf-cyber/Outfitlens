# Use official slim Python image
FROM python:3.11-slim

# Set system-level optimization variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TORCH_HOME=/app/torch_cache

WORKDIR /app

# Install system dependencies required for OpenCV, torchvision, and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpng-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies (CPU PyTorch wheels)
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Create cache directory for torchvision model weights
RUN mkdir -p /app/torch_cache /app/dataset /app/models

# Pre-download the torchvision MobileNetV3 weights during build-time so it works 100% offline
RUN python -c "from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights; mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT)"

# Copy rest of the application files
COPY . .

# Expose backend FastAPI port
EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
