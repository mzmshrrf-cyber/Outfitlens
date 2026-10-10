<#
.SYNOPSIS
  Cost-optimized OutfitLens deploy via AWS CLI only (no GitHub push).
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$Stack = "outfitlens"
$Build = Join-Path $Root "build"
$LambdaDir = Join-Path $Build "lambda"
$ZipPath = Join-Path $Build "api.zip"
$FrontendOut = Join-Path $Build "frontend-out"
$Account = aws sts get-caller-identity --query Account --output text
$ArtifactBucket = "outfitlens-artifacts-$Account-$Region"
$FrontendBucket = "outfitlens-web-$Account-$Region"

Write-Host "== OutfitLens AWS deploy (region=$Region account=$Account) ==" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Build | Out-Null

Write-Host "`n[1/6] Packaging Lambda (Bedrock-only, no PyTorch)..." -ForegroundColor Yellow
if (Test-Path $LambdaDir) { Remove-Item -Recurse -Force $LambdaDir }
New-Item -ItemType Directory -Force -Path $LambdaDir | Out-Null
$Py = Join-Path $Root "backend\venv\Scripts\python.exe"
& $Py -m pip install -r (Join-Path $Root "backend\requirements-lambda.txt") -t $LambdaDir --upgrade --quiet
Copy-Item -Recurse (Join-Path $Root "backend\app") (Join-Path $LambdaDir "app")
Copy-Item (Join-Path $Root "backend\lambda_handler.py") $LambdaDir
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $LambdaDir "app\ml\pipeline.py")
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $LambdaDir "app\ml\compare.py")
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }

# Prefer system zip for Linux-compatible archives; Compress-Archive can break Lambda
Push-Location $LambdaDir
if (Get-Command jar -ErrorAction SilentlyContinue) {
  jar -cfM $ZipPath *
} else {
  Compress-Archive -Path * -DestinationPath $ZipPath -Force
}
Pop-Location
Write-Host ("  api.zip = {0:N2} MB" -f ((Get-Item $ZipPath).Length / 1MB))

Write-Host "`n[2/6] Ensuring S3 buckets..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
aws s3 mb "s3://$ArtifactBucket" --region $Region 2>$null | Out-Host
aws s3 mb "s3://$FrontendBucket" --region $Region 2>$null | Out-Host
$ErrorActionPreference = "Stop"
# Confirm buckets exist
aws s3api head-bucket --bucket $ArtifactBucket --region $Region
if ($LASTEXITCODE -ne 0) { throw "Failed to create/access artifact bucket $ArtifactBucket" }
aws s3api head-bucket --bucket $FrontendBucket --region $Region
if ($LASTEXITCODE -ne 0) { throw "Failed to create/access frontend bucket $FrontendBucket" }

Write-Host "`n[3/6] Uploading Lambda zip..." -ForegroundColor Yellow
aws s3 cp $ZipPath "s3://$ArtifactBucket/artifacts/api.zip" --region $Region

Write-Host "`n[4/6] Deploying CloudFormation stack..." -ForegroundColor Yellow
$Template = Join-Path $Root "infrastructure\cloudformation\outfitlens-serverless.yml"
aws cloudformation deploy `
  --stack-name $Stack `
  --template-file $Template `
  --region $Region `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    ProjectName=outfitlens `
    ArtifactBucketName=$ArtifactBucket `
    FrontendBucketName=$FrontendBucket `
    LambdaZipKey=artifacts/api.zip

$ApiUrl = aws cloudformation describe-stacks --stack-name $Stack --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
$WebUrl = aws cloudformation describe-stacks --stack-name $Stack --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" --output text
$DistId = aws cloudformation describe-stacks --stack-name $Stack --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text

Write-Host "`n[5/6] Building static frontend for $ApiUrl ..." -ForegroundColor Yellow
$env:NEXT_PUBLIC_API_URL = "$ApiUrl/api"
$env:OUTFITLENS_STATIC_EXPORT = "1"
$Fe = Join-Path $Root "frontend"
Push-Location $Fe
npm run build
if (-not (Test-Path (Join-Path $Fe "out"))) { throw "Frontend 'out' folder missing after build." }
if (Test-Path $FrontendOut) { Remove-Item -Recurse -Force $FrontendOut }
Copy-Item -Recurse (Join-Path $Fe "out") $FrontendOut
Pop-Location

Write-Host "`n[6/6] Publishing frontend + invalidating CDN..." -ForegroundColor Yellow
aws s3 sync $FrontendOut "s3://$FrontendBucket/" --delete --region $Region
aws cloudfront create-invalidation --distribution-id $DistId --paths "/*" --region $Region | Out-Null

@"
# OutfitLens AWS Deployment

**No GitHub push was performed.**

## Live URLs

- **Website:** $WebUrl
- **API base:** $ApiUrl
- **Health:** $ApiUrl/api/health

## Architecture (cost-optimized)

| Service | Role | Cost note |
|---------|------|-----------|
| Lambda | API (FastAPI/Mangum) | Pay per request |
| API Gateway HTTP API | Public HTTPS API | Pay per request |
| S3 + CloudFront | Frontend | Pennies at low traffic |
| Amazon Bedrock | Compare embeddings + try-on | Pay per inference |

## Bedrock models used

- Vision / garment description: ``amazon.nova-lite-v1:0``
- Try-on edit: ``us.stability.stable-image-search-replace-v1:0``
- Compare embeddings: ``amazon.titan-embed-image-v1``

Enable/accept these in the **AWS Console → Amazon Bedrock → Model access** if prompts appear.

## Region / stack

- Region: ``$Region``
- Stack: ``$Stack``
- Account: ``$Account``
"@ | Set-Content (Join-Path $Root "docs\DEPLOYMENT.md") -Encoding UTF8

Write-Host "`n==============================" -ForegroundColor Green
Write-Host "Website: $WebUrl"
Write-Host "API:     $ApiUrl/api"
Write-Host "==============================`n"
