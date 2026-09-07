#!/bin/bash
# GCP Setup Script - Run in Cloud Shell
# Usage: ./setup-gcp.sh

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

PROJECT_ID=$(gcloud config get-value project)
REGION="europe-west1"
SERVICE_NAME="osiris-center"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   OSIRIS CENTER - GCP Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# 1. Enable APIs
echo -e "${YELLOW}[1/6] Enabling GCP APIs...${NC}"
gcloud services enable cloudbuild run secretmanager cloudscheduler artifactregistry --quiet

# 2. Create Artifact Registry
echo -e "${YELLOW}[2/6] Creating Artifact Registry...${NC}"
gcloud artifacts repositories create ${SERVICE_NAME} --repository-format=docker --location=${REGION} --quiet 2>/dev/null || true
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# 3. Generate secrets
echo -e "${YELLOW}[3/6] Creating secrets...${NC}"
AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
echo -n "$AUTH_SECRET" | gcloud secrets create auth-secret --data-file=- --replication-policy=automatic 2>/dev/null || gcloud secrets versions add auth-secret --data-file=-
echo -n "$CRON_SECRET" | gcloud secrets create cron-secret --data-file=- --replication-policy=automatic 2>/dev/null || gcloud secrets versions add cron-secret --data-file=-

# 4. Build & Push
echo -e "${YELLOW}[4/6] Building Docker image (may take a few minutes)...${NC}"
docker build -t ${IMAGE} .
docker push ${IMAGE}

# 5. Deploy
echo -e "${YELLOW}[5/6] Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE} \
    --platform=managed \
    --region=${REGION} \
    --allow-unauthenticated \
    --max-instances=10 \
    --min-instances=0 \
    --cpu=1 \
    --memory=512Mi \
    --set-secrets="AUTH_SECRET=auth-secret:latest,CRON_SECRET=cron-secret:latest" \
    --set-env-vars="NODE_ENV=production,ENABLE_IN_SERVER_CRON=false"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform=managed --region=${REGION} --format='value(status.url)')

# 6. Cloud Scheduler
echo -e "${YELLOW}[6/6] Setting up Cloud Scheduler...${NC}"
gcloud scheduler jobs create http daily-job --location=${REGION} --schedule="0 1 * * *" \
    --uri="${SERVICE_URL}/api/cron/daily" --http-method=GET \
    --headers="x-cron-secret=${CRON_SECRET}" --time-zone="Asia/Manila" 2>/dev/null || \
    gcloud scheduler jobs update http daily-job --location=${REGION} --schedule="0 1 * * *" \
    --uri="${SERVICE_URL}/api/cron/daily" --http-method=GET \
    --headers="x-cron-secret=${CRON_SECRET}" --time-zone="Asia/Manila"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "Service URL: ${SERVICE_URL}"
echo ""
echo -e "${YELLOW}IMPORTANT - Save these secrets:${NC}"
echo "AUTH_SECRET=${AUTH_SECRET}"
echo "CRON_SECRET=${CRON_SECRET}"
echo ""
echo -e "${RED}NEXT STEPS:${NC}"
echo "1. Create Neon DB: https://console.neon.tech"
echo "2. Update DATABASE_URL secret with your Neon connection string"
echo "3. Run migrations: curl -X POST '${SERVICE_URL}/api/cron/migrate' -H 'x-cron-secret: ${CRON_SECRET}'"
echo ""
echo -e "Test: curl '${SERVICE_URL}/api/channels'"