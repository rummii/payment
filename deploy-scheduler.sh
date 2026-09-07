#!/usr/bin/env bash
# Setup Cloud Scheduler jobs for OSIRIS CENTER Payment Portal
# Usage: ./deploy-scheduler.sh [PROJECT_ID] [REGION] [SERVICE_URL] [CRON_SECRET]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${1:-}"
REGION="${2:-asia-southeast1}"
SERVICE_URL="${3:-}"
CRON_SECRET="${4:-}"

if [[ -z "${PROJECT_ID}" ]]; then
    echo -e "${RED}Error: PROJECT_ID is required${NC}"
    echo "Usage: ./deploy-scheduler.sh PROJECT_ID [REGION] [SERVICE_URL] [CRON_SECRET]"
    exit 1
fi

if [[ -z "${SERVICE_URL}" ]]; then
    echo -e "${YELLOW}Service URL not provided. Attempting to detect...${NC}"
    SERVICE_URL=$(gcloud run services describe osiris-center \
        --platform=managed \
        --region="${REGION}" \
        --project="${PROJECT_ID}" \
        --format='value(status.url)' 2>/dev/null || echo "")
    
    if [[ -z "${SERVICE_URL}" ]]; then
        echo -e "${RED}Error: Could not detect service URL. Please provide it manually.${NC}"
        exit 1
    fi
fi

if [[ -z "${CRON_SECRET}" ]]; then
    echo -e "${YELLOW}CRON_SECRET not provided. Attempting to detect from Secret Manager...${NC}"
    CRON_SECRET=$(gcloud secrets versions access latest --secret=cron-secret --project="${PROJECT_ID}" 2>/dev/null || echo "")
    
    if [[ -z "${CRON_SECRET}" ]]; then
        echo -e "${RED}Error: CRON_SECRET not found in Secret Manager. Please provide it manually.${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   OSIRIS CENTER - Cloud Scheduler Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Project ID:${NC} ${PROJECT_ID}"
echo -e "${GREEN}Region:${NC} ${REGION}"
echo -e "${GREEN}Service URL:${NC} ${SERVICE_URL}"
echo ""

# ─── Daily Cron Job (09:00 PHT = 01:00 UTC) ──────────────────────────────────

echo -e "${YELLOW}Creating daily cron job (09:00 PHT)...${NC}"

if gcloud scheduler jobs describe daily-job --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}Daily job exists, updating...${NC}"
    gcloud scheduler jobs update http daily-job \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="0 1 * * *" \
        --uri="${SERVICE_URL}/api/cron/daily" \
        --http-method=GET \
        --headers="x-cron-secret=${CRON_SECRET}" \
        --time-zone="Asia/Manila"
else
    echo -e "${GREEN}Creating daily job...${NC}"
    gcloud scheduler jobs create http daily-job \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="0 1 * * *" \
        --uri="${SERVICE_URL}/api/cron/daily" \
        --http-method=GET \
        --headers="x-cron-secret=${CRON_SECRET}" \
        --time-zone="Asia/Manila" \
        --description="OSIRIS CENTER daily lifecycle + reminders + webhook retries (09:00 PHT)"
fi

# ─── Webhook Retry Job (every 10 minutes) ────────────────────────────────────

echo -e "${YELLOW}Creating webhook retry job (every 10 minutes)...${NC}"

if gcloud scheduler jobs describe webhook-retries --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}Webhook retries job exists, updating...${NC}"
    gcloud scheduler jobs update http webhook-retries \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="*/10 * * * *" \
        --uri="${SERVICE_URL}/api/cron/webhooks" \
        --http-method=GET \
        --headers="x-cron-secret=${CRON_SECRET}" \
        --time-zone="Asia/Manila"
else
    echo -e "${GREEN}Creating webhook retries job...${NC}"
    gcloud scheduler jobs create http webhook-retries \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --schedule="*/10 * * * *" \
        --uri="${SERVICE_URL}/api/cron/webhooks" \
        --http-method=GET \
        --headers="x-cron-secret=${CRON_SECRET}" \
        --time-zone="Asia/Manila" \
        --description="OSIRIS CENTER webhook delivery retries (every 10 minutes)"
fi

# ─── Verify Jobs ─────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Verifying scheduler jobs...${NC}"

echo -e "${GREEN}Daily job:${NC}"
gcloud scheduler jobs describe daily-job --location="${REGION}" --project="${PROJECT_ID}" --format="table(name,schedule,timeZone,uri)"

echo ""
echo -e "${GREEN}Webhook retries job:${NC}"
gcloud scheduler jobs describe webhook-retries --location="${REGION}" --project="${PROJECT_ID}" --format="table(name,schedule,timeZone,uri)"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All scheduler jobs created/updated successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} The daily job runs at 09:00 AM PHT (01:00 UTC) every day."
echo -e "${YELLOW}Note:${NC} The webhook retries job runs every 10 minutes."