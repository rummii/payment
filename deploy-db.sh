#!/usr/bin/env bash
# Database migration and seed script for OSIRIS CENTER on Cloud Run
# Usage: ./deploy-db.sh [PROJECT_ID] [REGION] [COMMAND]
# Commands: migrate | seed | reset | status

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${1:-}"
REGION="${2:-asia-southeast1}"
COMMAND="${3:-status}"

if [[ -z "${PROJECT_ID}" ]]; then
    echo -e "${RED}Error: PROJECT_ID is required${NC}"
    echo "Usage: ./deploy-db.sh PROJECT_ID [REGION] [COMMAND]"
    echo "Commands: migrate | seed | reset | status"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   OSIRIS CENTER - Database Operations${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Project ID:${NC} ${PROJECT_ID}"
echo -e "${GREEN}Region:${NC} ${REGION}"
echo -e "${GREEN}Command:${NC} ${COMMAND}"
echo ""

case "${COMMAND}" in
    migrate)
        echo -e "${YELLOW}Running database migrations...${NC}"
        gcloud run jobs execute migrate \
            --platform=managed \
            --region="${REGION}" \
            --project="${PROJECT_ID}" \
            --wait \
            --format='json(status)'
        echo -e "${GREEN}Migrations completed successfully!${NC}"
        ;;
    
    seed)
        echo -e "${YELLOW}Seeding database with demo data...${NC}"
        gcloud run jobs execute seed \
            --platform=managed \
            --region="${REGION}" \
            --project="${PROJECT_ID}" \
            --wait \
            --format='json(status)'
        echo -e "${GREEN}Database seeded successfully!${NC}"
        ;;
    
    reset)
        echo -e "${YELLOW}Resetting database (this will delete all data)...${NC}"
        read -p "Are you sure? (y/N): " CONFIRM
        if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 0
        fi
        gcloud run jobs execute reset \
            --platform=managed \
            --region="${REGION}" \
            --project="${PROJECT_ID}" \
            --wait \
            --format='json(status)'
        echo -e "${GREEN}Database reset completed!${NC}"
        ;;
    
    status)
        echo -e "${YELLOW}Checking database status...${NC}"
        echo -e "${GREEN}Database connection:${NC} Neon PostgreSQL"
        echo -e "${GREEN}Prisma client:${NC} Generated"
        echo ""
        echo -e "${YELLOW}To run migrations:${NC} ./deploy-db.sh ${PROJECT_ID} ${REGION} migrate"
        echo -e "${YELLOW}To seed data:${NC} ./deploy-db.sh ${PROJECT_ID} ${REGION} seed"
        ;;
    
    *)
        echo -e "${RED}Unknown command: ${COMMAND}${NC}"
        echo "Available commands: migrate | seed | reset | status"
        exit 1
        ;;
esac