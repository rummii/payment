#!/usr/bin/env bash
# Setup secrets in Google Cloud Secret Manager for OSIRIS CENTER
# Usage: ./deploy-secrets.sh [PROJECT_ID]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${1:-}"

if [[ -z "${PROJECT_ID}" ]]; then
    echo -e "${RED}Error: PROJECT_ID is required${NC}"
    echo "Usage: ./deploy-secrets.sh PROJECT_ID"
    exit 1
fi

echo -e "${BLUE}Setting up secrets in Secret Manager for project: ${PROJECT_ID}${NC}"
echo ""

# Helper function to create/update secret
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"

    if gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" &>/dev/null; then
        echo -e "${YELLOW}Secret ${secret_name} exists, adding new version...${NC}"
        echo -n "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=- --project="${PROJECT_ID}"
    else
        echo -e "${GREEN}Creating secret ${secret_name}...${NC}"
        echo -n "${secret_value}" | gcloud secrets create "${secret_name}" --data-file=- --project="${PROJECT_ID}" --replication-policy="automatic"
    fi
}

# Generate random secrets if not provided
generate_secret() {
    openssl rand -hex 32
}

# ─── Core Secrets ─────────────────────────────────────────────────────────────

echo -e "${YELLOW}Core authentication secrets:${NC}"

read -p "AUTH_SECRET (64-char hex, leave empty to generate): " AUTH_SECRET
AUTH_SECRET="${AUTH_SECRET:-$(generate_secret)}"
create_secret "auth-secret" "${AUTH_SECRET}" "JWT signing secret for sessions"

read -p "CRON_SECRET (32-char hex, leave empty to generate): " CRON_SECRET
CRON_SECRET="${CRON_SECRET:-$(generate_secret)}"
create_secret "cron-secret" "${CRON_SECRET}" "Shared secret for cron endpoints"

read -p "PROVISIONING_SEED_KEY (leave empty to generate): " PROVISIONING_SEED_KEY
PROVISIONING_SEED_KEY="${PROVISIONING_SEED_KEY:-pk_$(generate_secret)}"
create_secret "provisioning-seed-key" "${PROVISIONING_SEED_KEY}" "Seed key for provisioning API"

# ─── PayPal Secrets ───────────────────────────────────────────────────────────

echo -e "${YELLOW}PayPal credentials:${NC}"

read -p "PAYPAL_CLIENT_ID: " PAYPAL_CLIENT_ID
create_secret "paypal-client-id" "${PAYPAL_CLIENT_ID}" "PayPal client ID"

read -p "PAYPAL_CLIENT_SECRET: " PAYPAL_CLIENT_SECRET
create_secret "paypal-client-secret" "${PAYPAL_CLIENT_SECRET}" "PayPal client secret"

read -p "PAYPAL_WEBHOOK_ID: " PAYPAL_WEBHOOK_ID
create_secret "paypal-webhook-id" "${PAYPAL_WEBHOOK_ID}" "PayPal webhook ID for verification"

read -p "NEXT_PUBLIC_PAYPAL_CLIENT_ID (same as client ID for browser SDK): " NEXT_PUBLIC_PAYPAL_CLIENT_ID
create_secret "paypal-public-client-id" "${NEXT_PUBLIC_PAYPAL_CLIENT_ID}" "PayPal client ID for browser SDK"

# ─── GCash / Xendit / PayMongo Secrets ────────────────────────────────────────

echo -e "${YELLOW}GCash provider credentials (optional):${NC}"

read -p "XENDIT_API_KEY (leave empty if not using Xendit): " XENDIT_API_KEY
if [[ -n "${XENDIT_API_KEY}" ]]; then
    create_secret "xendit-api-key" "${XENDIT_API_KEY}" "Xendit API key"
    read -p "XENDIT_CALLBACK_TOKEN: " XENDIT_CALLBACK_TOKEN
    create_secret "xendit-callback-token" "${XENDIT_CALLBACK_TOKEN}" "Xendit callback token"
fi

read -p "PAYMONGO_SECRET_KEY (leave empty if not using PayMongo): " PAYMONGO_SECRET_KEY
if [[ -n "${PAYMONGO_SECRET_KEY}" ]]; then
    create_secret "paymongo-secret-key" "${PAYMONGO_SECRET_KEY}" "PayMongo secret key"
    read -p "PAYMONGO_WEBHOOK_SECRET: " PAYMONGO_WEBHOOK_SECRET
    create_secret "paymongo-webhook-secret" "${PAYMONGO_WEBHOOK_SECRET}" "PayMongo webhook secret"
fi

# ─── Email Secrets ────────────────────────────────────────────────────────────

echo -e "${YELLOW}Email provider credentials:${NC}"

read -p "EMAIL_PROVIDER (log|resend|sendgrid) [resend]: " EMAIL_PROVIDER
EMAIL_PROVIDER="${EMAIL_PROVIDER:-resend}"

if [[ "${EMAIL_PROVIDER}" == "resend" ]]; then
    read -p "RESEND_API_KEY: " RESEND_API_KEY
    create_secret "resend-api-key" "${RESEND_API_KEY}" "Resend API key"
elif [[ "${EMAIL_PROVIDER}" == "sendgrid" ]]; then
    read -p "SENDGRID_API_KEY: " SENDGRID_API_KEY
    create_secret "sendgrid-api-key" "${SENDGRID_API_KEY}" "SendGrid API key"
fi

# ─── SMS Secrets ──────────────────────────────────────────────────────────────

echo -e "${YELLOW}SMS provider credentials:${NC}"

read -p "SMS_PROVIDER (log|semaphore) [semaphore]: " SMS_PROVIDER
SMS_PROVIDER="${SMS_PROVIDER:-semaphore}"

if [[ "${SMS_PROVIDER}" == "semaphore" ]]; then
    read -p "SEMAPHORE_API_KEY: " SEMAPHORE_API_KEY
    create_secret "semaphore-api-key" "${SEMAPHORE_API_KEY}" "Semaphore API key"
fi

# ─── Database ─────────────────────────────────────────────────────────────────

echo -e "${YELLOW}Database configuration:${NC}"
read -p "DATABASE_URL (Neon connection string): " DATABASE_URL

if [[ -n "${DATABASE_URL}" ]]; then
    create_secret "database-url" "${DATABASE_URL}" "Neon PostgreSQL connection string"
fi

# ─── Application URL ──────────────────────────────────────────────────────────

echo -e "${YELLOW}Application URL:${NC}"
read -p "NEXT_PUBLIC_APP_URL (Cloud Run service URL): " NEXT_PUBLIC_APP_URL

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All secrets created/updated successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next step:${NC} Run ./deploy.sh ${PROJECT_ID} to deploy the service"
echo -e "${YELLOW}Then run:${NC} ./deploy-scheduler.sh ${PROJECT_ID} ${SERVICE_URL}/api/cron/daily"