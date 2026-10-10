# Phase 1 — Baseline Inspection Report

**Date:** 2026-10-10  
**Backup:** `c:\Users\symoi\Desktop\New folder\Teachable-Machine-BACKUP-20261010-152047`  
**Product inspected:** Teachable Core / Teachable Machine clone

## What this project actually is

This is **not** an image-comparison or virtual try-on app today. It is a **Google Teachable Machine–style image classifier**:

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 15, React 19, Zustand, Tailwind, Framer Motion, Lucide |
| Backend | FastAPI, PyTorch MobileNetV3-Small (576-d features), scikit-learn LogisticRegression |
| Ops | Docker Compose, `run.bat` (backend on **8001**, docs say **8000** — mismatch) |

## Architecture (verified from source)

1. Webcam / upload → `POST /api/upload-sample` → `dataset/{class}/`
2. `POST /api/train` → MobileNet embeddings + LogisticRegression → `models/model.pkl`
3. Live `POST /api/predict` every ~300ms from webcam canvas
4. Export ZIP, reset, evaluate (cross-val), class rename/delete

## Baseline run results (local, 2026-10-10)

| Check | Result |
|-------|--------|
| Python / Node / Docker / AWS CLI | Present (`Python 3.13.9`, `Node v24.14.0`, Docker 29.3.1, aws-cli 2.36.49) |
| AWS Q CLI (`q`) | **Not installed** |
| Existing tests | **None** (0 test files) |
| Existing AWS / IaC config | **None** |
| Backend venv / frontend `node_modules` | Missing initially; installed for baseline |
| Frontend `npm install` | Failed first (lucide-react peer vs React 19); succeeded with `--legacy-peer-deps` |
| `GET /api/health` | **OK** — `{"status":"healthy","has_model":false,"classes_count":0}` |
| `GET /api/classes` | **OK** — empty dataset |
| Frontend `http://localhost:3000` | **OK** — HTTP 200 |
| MobileNetV3 weight load | **OK** |

## What works

- Health endpoint and CORS-enabled FastAPI app
- Class CRUD / sample upload / train / predict / export / reset / evaluate endpoints (code present)
- Frontend three-column TM-style UI wiring to Zustand + API
- Dockerfiles and compose file present

## What fails / gaps

- No automated tests
- No image-compare endpoint or UI
- No virtual try-on (classification ≠ try-on)
- Branding tightly couples to “Teachable Machine” / Google palette
- `run.bat` uses port **8001** while `.env.example` / compose use **8000**
- `requirements.txt` has invalid inline `--extra-index-url` pip syntax
- No AWS deployment assets; AWS Q CLI unavailable
- Frontend public folder referenced in Dockerfile but may be empty

## Planned product direction (Phase 2+)

**Brand:** OutfitLens (unique; unrelated to Google Teachable Machine)

1. **Image Compare** — reuse MobileNet embeddings for cosine / visual similarity + clear limitation copy  
2. **AI Virtual Try-On** — fal.ai **FASHN Try-On v1.6** (~$0.075/gen, commercial) with optional Leffa; API key via env only  
3. Preserve classifier workflow as optional **Lab** mode so existing ML path is not deleted
