# Teachable Core - Image Classifier Project Clone

A production-grade, offline-first image classification application built to mimic the workflows and user experience of **Google Teachable Machine Image Project**. 

Built with a fast, modern stack combining **Next.js 15, FastAPI, PyTorch (MobileNetV3 backbone), and scikit-learn (Logistic Regression)**.

---

## Architecture Overview

This clone uses a state-of-the-art hybrid approach for rapid local training on CPU:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Next.js 15)             │
│                                                                        │
│   Webcam Feeds  ──[Canvas Frame Blobs]──► [API upload] ──► Zustand Store│
│   Live prediction ◄──[Probabilities]───── [API predict] ◄── [Interval 300ms]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ HTTP REST
┌────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (FastAPI + Python)                │
│                                                                        │
│   1. /upload-sample ──► Saves UUID images to dataset/{class_name}/      │
│   2. /train         ──► Passes images through MobileNetV3 small         │
│                         extracts 576-dim feature embeddings            │
│                         trains fast scikit-learn Logistic Regression   │
│                         saves classifier to models/model.pkl           │
│   3. /predict       ──► Preprocesses canvas JPEG, extracts features    │
│                         predicts probabilities in real time (<15ms)    │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Pretrained Backbone**: PyTorch torchvision `mobilenet_v3_small` is utilized as a deep feature extractor. By stripping the final classification layers (`classifier = nn.Identity()`), we map each image to a dense $576$-dimensional embedding representation containing rich semantic shapes/textures.
2. **Dynamic Classifier**: A scikit-learn `LogisticRegression` model is trained on top of the extracted embeddings. Fitting a logistic regression model on a few hundred embeddings takes less than **0.2 seconds on CPU**, yielding instant training and high-fidelity probabilities.
3. **Reactive State**: Zustand maintains strict unified control over classes, sample previews, webcam initialization, training logs, confusion matrix outputs, and background real-time predict ticking (every 300ms).

---

## Core Features

- 🏷️ **Dynamic Classes**: Add, rename (folder is renamed dynamically on disk), and delete custom target classes.
- 📸 **Camera Continuous Ingestion**: Dynamic "Hold-to-Record" webcam capture that extracts canvas frames and streams them to the dataset folders in real time.
- 📂 **Multi-Selection Drag & Drop**: Batch upload folders of PNG, JPG, or WebP training samples.
- ⚡ **Instant Model Training**: Features are extracted and Logistic Regression is fitted locally in seconds, outputting exact logs.
- 🔮 **Live predictions & Confidence**: Active testing feeds webcam frames to the model every 300ms, driving fluid glassmorphic confidence progress bars.
- 📦 **Model Export**: Stream and download the trained model bundle (`model.pkl`, `labels.json`, `metrics.json`) as a compressed ZIP file.
- 📊 **Confusion Matrix**: Fully interactive per-class hit rates and confusion visualizers calculated inside the console dashboard.

---

## Directory Structure

```
teachable-machine-clone/
├── frontend/
│   ├── app/                 # Next.js App Router (layout, pages, global CSS)
│   ├── components/          # Reusable UI components (Sidebar, ClassCard, Predictor)
│   ├── store/               # Zustand store for unified state management
│   ├── services/            # API client service layer
│   ├── public/              # Static assets
│   ├── Dockerfile           # Multi-stage production build for Frontend
│   ├── tailwind.config.ts   # Design token utilities
│   └── package.json         # Node dependencies
│
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI endpoints (samples, model, train)
│   │   ├── ml/              # PyTorch + scikit-learn training pipelines
│   │   └── main.py          # FastAPI application entry point
│   ├── dataset/             # Dataset storage partitioned by class name
│   ├── models/              # Saved model.pkl, labels.json, and metrics.json
│   ├── Dockerfile           # Python production build for Backend
│   └── requirements.txt     # Python packages
│
├── docker-compose.yml       # Production-ready compose configuration
└── README.md                # Documentation
```

---

## Installation & Setup

### Method A: Docker Compose (Recommended - Quickest)

Ensure you have **Docker** and **Docker Compose** installed.

1. **Spin Up Containers**:
   From the root directory, execute:
   ```bash
   docker-compose up --build
   ```
   *Note: On the first run, the backend will automatically download and cache the lightweight MobileNetV3 weights (~10MB) during the build layer. This guarantees 100% offline capability afterwards.*

2. **Access Applications**:
   - **Frontend Dashboard**: Open [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Method B: Manual Local Setup (Development)

Ensure you have **NodeJS 18+** and **Python 3.11** installed.

#### 1. Setup Backend ML Server

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start development server:
   ```bash
   python app/main.py
   ```
   The backend server will launch on `http://localhost:8000`.

---

#### 2. Setup Frontend Dashboard

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) inside your web browser.

---

## API Endpoints Documentation

FastAPI automatically generates an interactive Swagger interface at `http://localhost:8000/docs`.

### 📂 Dataset Endpoints

- **`GET /api/classes`**:
  Gathers all target directories under `dataset/`, maps current count of items, and bundles the most recent 6 samples as small Base64 previews for instant UI thumbnail load.
- **`POST /api/upload-sample`**:
  Accepts form data containing `class_name` and a list of `images` files. Images are validated, resized to a maximum of 640px to conserve disk footprint, and saved using secure UUID filenames.
- **`POST /api/class/rename`**:
  Accepts form fields `old_name` and `new_name`. Dynamically renames the folder on disk.
- **`DELETE /api/class/{name}`**:
  Wipes a target folder and all its images from the disk.
- **`DELETE /api/sample/{class_name}/{id}`**:
  Deletes an individual image in a specific class folder by UUID.

### 🧠 Machine Learning Endpoints

- **`POST /api/train`**:
  Extracts 576-dimensional feature representations using MobileNetV3 small, fits a multinomial Logistic Regression classifier on the dataset, writes `model.pkl`, `labels.json`, and `metrics.json` inside the `models/` directory, and returns performance statistics (accuracy, fit time).
- **`POST /api/predict`**:
  Accepts a JSON payload `{ "image": "data:image/jpeg;base64,..." }`. Performs identical preprocessing (ImageNet normalization), runs feature extraction, and feeds vectors to the active model to compute probabilities for all classes.
- **`POST /api/export-model`**:
  Compresses `model.pkl`, `labels.json`, and `metrics.json` into a single zip archive and returns it as a streaming file download.
- **`POST /api/reset`**:
  Resets the project by wiping out `dataset/` and `models/` completely.

---

## Troubleshooting & FAQ

#### 1. Why is the "Train" button disabled?
Ensure that:
- The backend status dot is **Green** (ML Engine Online).
- You have created at least **two separate classes** in the sidebar.
- Every class card has **at least 1 image sample** uploaded or recorded.

#### 2. The Webcam isn't loading!
Webcams are restricted to **secure contexts** in modern browsers.
- Ensure you are visiting `http://localhost:3000` (localhost is exempted from SSL requirements).
- Check that other camera apps (like Zoom, Teams, or Skype) are closed so they release hardware locks.
- Grant camera permissions to the site in your browser settings bar.

#### 3. How fast is inference/training?
Feature extraction and classifier training takes **less than 2 seconds** on CPU for up to 300 samples. Inference/prediction ticks run in background loops at **300ms intervals** and resolve in `< 15ms` per frame, providing smooth real-time progress bar animations.
