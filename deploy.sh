#!/usr/bin/env bash
# Deploy script for OSIRIS CENTER Payment Portal to Google Cloud Run + Neon DB
# Usage: ./deploy.sh [PROJECT_ID] [REGION]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_ID="${1:-}"
REGION="${2:-asia-southeast1}"
SERVICE_NAME="osiris-center"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   OSIRIS CENTER Payment Portal - Cloud Run Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Validate project ID
if [[ -z "${PROJECT_ID}" ]]; then
    echo -e "${RED}Error: PROJECT_ID is required${NC}"
    echo "Usage: ./deploy.sh PROJECT_ID [REGION]"
    echo "Example: ./deploy.sh my-gcp-project asia-southeast1"
    exit 1
fi

echo -e "${GREEN}Project ID:${NC} ${PROJECT_ID}"
echo -e "${GREEN}Region:${NC} ${REGION}"
echo -e "${GREEN}Service:${NC} ${SERVICE_NAME}"
echo ""

# Check required tools
for cmd in gcloud docker; do
    if ! command -v "${cmd}" &> /dev/null; then
        echo -e "${RED}Error: ${cmd} not found in PATH${NC}"
        exit 1
    fi
done

# Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    cloudscheduler.googleapis.com \
    artifactregistry.googleapis.com \
    --project="${PROJECT_ID}"

# Build and push Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t "${IMAGE_NAME}" .

echo -e "${YELLOW}Pushing to Container Registry...${NC}"
docker push "${IMAGE_NAME}"

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE_NAME}" \
    --platform=managed \
    --region="${REGION}" \
    --allow-unauthenticated \
    --project="${PROJECT_ID}" \
    --max-instances=10 \
    --min-instances=0 \
    --cpu=1 \
    --memory=512Mi \
    --timeout=300s \
    --concurrency=80 \
    --set-env-vars="NODE_ENV=production"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --platform=managed \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format='value(status.url)')

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Service URL:${NC} ${SERVICE_URL}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Set up secrets in Secret Manager (see deploy-secrets.sh)"
echo "2. Run database migrations: gcloud run jobs execute migrate --region=${REGION}"
echo "3. Set up Cloud Scheduler jobs (see deploy-scheduler.sh)"
echo "4. Configure custom domain (optional)"
echo ""
echo -e "${BLUE}Service URL for scheduler:${NC} ${SERVICE_URL}/api/cron/daily"