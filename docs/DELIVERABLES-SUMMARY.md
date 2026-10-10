# OutfitLens — Deliverables Summary

## Phase 1 findings

| Item | Result |
|------|--------|
| Original product | Teachable Machine–style **image classifier** (not compare/try-on) |
| Backup | `..\Teachable-Machine-BACKUP-20261010-152047` |
| Baseline screenshot | `docs/baseline/baseline-home.png` |
| Existing tests | **None** |
| Existing AWS config | **None** |
| AWS Q CLI | **Not installed** |
| Baseline run | Backend health OK, frontend HTTP 200 |

## What changed

- Rebranded to **OutfitLens** (new UI, fonts, teal palette; no Google TM branding)
- **Image Compare** mode using existing MobileNetV3 embeddings + cosine similarity
- **AI Virtual Try-On** via fal.ai FASHN v1.6 (server-side `FAL_KEY`)
- Product URL fetch with SSRF protections + graceful unsupported-site errors
- Class Lab preserves original train/predict/export workflow
- Tests: **8/8 passed** (`backend/tests/test_compare_and_url.py`)
- README + `.env.example` updated

## Verified locally

| Workflow | Status |
|----------|--------|
| Image Compare API | OK (HTTP 200) |
| Compare UI E2E | Captured `docs/final/final-compare-result.png` |
| Try-On UI + status | OK; shows setup until `FAL_KEY` set |
| SSRF block on private URL | OK (HTTP 400) |
| Unit tests | 8 passed |

## Try-on without `FAL_KEY`

Try-on generation was **not** executed against fal.ai (no key in environment). UI and API correctly refuse with setup instructions rather than faking try-on via classification.

## AWS (Phase 4 — paused for approval)

| Check | Result |
|-------|--------|
| Account | `159412676011` (IAM user `claude`) |
| Region | `us-east-1` |
| Existing App Runner / OutfitLens stacks | None |
| AWS Q CLI | Missing |

**Proposed cost-conscious deploy (not created yet):**

1. Frontend → S3 + CloudFront (low cost)  
2. Backend → App Runner (or small Fargate) with CPU Torch image  
3. `FAL_KEY` in SSM / Secrets Manager  

**Estimated costs if approved:**

- App Runner / small always-on API: roughly **$15–40+/month** depending on size/traffic  
- S3 + CloudFront: typically **under a few USD/month** at low traffic  
- fal.ai: **~$0.075 per try-on** (external)  

**Awaiting explicit approval before creating billable AWS resources.**

## Screenshots

- `docs/baseline/baseline-home.png`
- `docs/final/final-compare-mode.png`
- `docs/final/final-tryon-mode.png`
- `docs/final/final-lab-mode.png`
- `docs/final/final-compare-result.png`

## Limitations

- Compare ≠ identity verification or SKU matching  
- Flat / low-texture images can score higher than intuition suggests  
- Try-on needs fal.ai credits + `FAL_KEY`; results are generative previews  
- Product URL fetch fails on JS-heavy / bot-blocked shops  
- AWS deployment not completed pending cost approval and Q CLI absence  
