# OutfitLens

**OutfitLens** is a local-first visual app for:

1. **Image Compare** — visual similarity between two images (MobileNetV3 embeddings + cosine similarity), with clear limitations  
2. **AI Virtual Try-On** — generative garment preview via [fal.ai FASHN Try-On v1.6](https://fal.ai/models/fal-ai/fashn/tryon/v1.6) (~$0.075/generation)  
3. **Class Lab** (optional) — the original local image-classifier workflow (train / predict / export)

This product is **not affiliated with Google Teachable Machine**.

---

## Architecture

```
Frontend (Next.js 15 + React 19 + Zustand + Tailwind)
        │  REST
Backend (FastAPI)
  ├─ /api/compare          → MobileNetV3 features + cosine similarity
  ├─ /api/tryon            → fal.ai FASHN (requires FAL_KEY)
  ├─ /api/fetch-product-image → SSRF-safe public URL → og:image
  └─ /api/train|predict…   → Class Lab (unchanged ML path)
```

**Privacy:** Compare/try-on uploads are processed for the request and are not kept as a long-term gallery. Try-on images are sent to fal.ai when that mode is used. Never put `FAL_KEY` in `NEXT_PUBLIC_*` variables.

---

## Virtual try-on provider (Amazon Bedrock)

| Component | Model | Notes |
|-----------|--------|--------|
| Garment understanding | `amazon.nova-lite-v1:0` | Describes clothing from the product photo |
| Try-on edit | `us.stability.stable-image-search-replace-v1:0` | Replaces clothing region (~$0.07/image typical) |
| Image compare (AWS) | `amazon.titan-embed-image-v1` | Embedding similarity (serverless) |

Nova Canvas / Titan Image Generator are **Legacy-EOL** on many accounts, so this stack uses **active** Bedrock models only. Auth is IAM / `aws configure` — no third-party API keys.

**Limitations:** generative preview only; not accurate size/fit guarantees.

---

## Environment variables

Copy `.env.example` to `.env` at the repo root (and/or `frontend/.env.local`):

| Variable | Where | Required | Purpose |
|----------|--------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Frontend | Yes | Backend API base, e.g. `http://localhost:8000/api` |
| `PORT` | Backend | No | Default `8000` |
| `AWS_REGION` | Backend | Yes (AWS) | e.g. `us-east-1` |
| `BEDROCK_IMAGE_MODEL_ID` | Backend | No | Default Stability Search & Replace inference profile |
| `BEDROCK_VISION_MODEL_ID` | Backend | No | Default Nova Lite |
| `FRONTEND_ORIGIN` | Backend | No | Optional CORS allowlist in production |

## Live AWS deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

- Website: https://d6b0pwn1494r0.cloudfront.net  
- API: https://6qmgad27k9.execute-api.us-east-1.amazonaws.com/api  

Redeploy (AWS CLI only, no GitHub): `powershell -File scripts/deploy-aws.ps1`

---

## Local setup

### Prerequisites

- Node.js 18+
- Python 3.11+ (3.13 works in this workspace)
- Optional: Docker

### Manual (recommended for development)

```bash
# Backend
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend (new terminal)
cd frontend
npm install --legacy-peer-deps
# create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev
```

Or double-click `run.bat` on Windows (uses port **8000** for the API).

- App: http://localhost:3000  
- API docs: http://localhost:8000/docs  

### Docker Compose

```bash
docker-compose up --build
```

---

## Tests

```bash
cd backend
.\venv\Scripts\python.exe -m pytest tests -v
```

Covers cosine similarity, identical-image compare, SSRF blocks for localhost/private IPs, and try-on status shape.

---

## AWS deployment (cost-conscious)

There is **no prior AWS IaC** in this repo. **AWS Q CLI (`q`) is not installed** on this machine.

### Suggested low-cost layout

| Service | Role | Cost notes |
|---------|------|------------|
| **App Runner** or **ECS Fargate** (small) | Backend API | Always-on small service ≈ low tens of USD/mo; scale-to-zero options vary |
| **S3 + CloudFront** | Frontend static/`next export` or container | S3 near-free at low traffic; CloudFront pennies |
| **Secrets Manager** or SSM Parameter Store | `FAL_KEY` | Parameter Store free tier / low cost |
| **ECR** | Images | Storage cents/mo |

**Paid / usage-based you should expect:**

- fal.ai try-on generations (~$0.075 each) — billed by fal, not AWS  
- AWS compute while the API is running  
- Data transfer / CloudFront requests at scale  

### Before creating paid resources

The agent **will ask for confirmation** before provisioning App Runner/ECS/ALB or other billable stacks. Free-tier-only exploration (account identity, region list) is safe.

---

## Backups

A full local snapshot was created before product changes:

`Teachable-Machine-BACKUP-20261010-152047` (sibling folder on the Desktop).

---

## API (new)

- `POST /api/compare` — multipart `image_a`, `image_b`  
- `POST /api/tryon` — multipart `person_image`, `garment_images` (+ optional `category`, `mode`)  
- `GET /api/tryon/status` — provider config / cost notes  
- `POST /api/fetch-product-image` — JSON `{ "url": "https://..." }`  

Class Lab endpoints (`/upload-sample`, `/train`, `/predict`, …) remain available.

---

## Screenshots

- Baseline (pre-change): `docs/baseline/baseline-home.png`  
- Final: `docs/final/` (captured after UI upgrade)
