# OutfitLens AWS Deployment

**No GitHub push was performed.** Deployed with AWS CLI only.

## Live URLs

- **Website:** https://d6b0pwn1494r0.cloudfront.net
- **API:** https://6qmgad27k9.execute-api.us-east-1.amazonaws.com/api
- **Health:** https://6qmgad27k9.execute-api.us-east-1.amazonaws.com/api/health

## Architecture (cost-optimized)

| Service | Purpose | Cost model |
|---------|---------|------------|
| Lambda (1024MB) | FastAPI API via Mangum | Pay per request |
| API Gateway HTTP API | HTTPS API endpoint | Pay per request |
| S3 + CloudFront | Static frontend | Low / free-tier friendly |
| Amazon Bedrock | Compare + virtual try-on | Pay per inference |

No always-on ECS/GPU. Idle cost is near-zero beyond tiny CloudFront/S3 storage.

## Bedrock models

- **Try-on:** `us.stability.stable-image-search-replace-v1:0` (~$0.07/image)
- **Garment description:** `amazon.nova-lite-v1:0`
- **Image compare:** `amazon.titan-embed-image-v1`

Nova Canvas / Titan Image Generator are Legacy-EOL on this account; active Bedrock models are used instead.

## Stack

- Region: `us-east-1`
- Stack: `outfitlens`
- Redeploy API/frontend: `scripts/deploy-aws.ps1`
