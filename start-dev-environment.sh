#!/bin/bash

# Development Environment Startup Script
# Mirrors production deployment pattern: infrastructure first, then applications

set -e

echo "🚀 Starting development environment with production-like architecture..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if service is healthy
check_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for $service to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null | grep -q "healthy"; then
            echo -e "${GREEN}✅ $service is healthy${NC}"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: $service not healthy yet..."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service failed to become healthy${NC}"
    return 1
}

# Clean up any existing development containers
echo -e "${YELLOW}🧹 Cleaning up existing development containers...${NC}"
docker-compose -f docker-compose.dev-infrastructure.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.dev-apps.yml --profile auth --profile app1 down -v 2>/dev/null || true

# Remove old development containers
docker rm -f mhylle-nginx-dev mhylle-postgres-dev mhylle-auth-service app1-frontend app1-backend 2>/dev/null || true

# Step 1: Start infrastructure (nginx, postgres) - matches production pattern
echo -e "${GREEN}📦 Step 1: Starting infrastructure (nginx, postgres)...${NC}"
docker-compose -f docker-compose.dev-infrastructure.yml up -d

# Wait for infrastructure to be healthy
check_health "mhylle-postgres-dev"
check_health "mhylle-nginx-dev"

echo -e "${GREEN}✅ Infrastructure is running${NC}"

# Step 2: Start auth service - matches production pattern
echo -e "${GREEN}🔐 Step 2: Starting auth service...${NC}"
docker-compose -f docker-compose.dev-apps.yml --profile auth up -d

# Wait for auth service to be healthy
check_health "mhylle-auth-service"

echo -e "${GREEN}✅ Auth service is running${NC}"

# Step 3: Start app1 services - matches production pattern
echo -e "${GREEN}🎯 Step 3: Starting app1 services...${NC}"
docker-compose -f docker-compose.dev-apps.yml --profile app1 up -d

# Wait for app1 services to be healthy
check_health "app1-backend"
check_health "app1-frontend"

echo -e "${GREEN}✅ App1 services are running${NC}"

# Show status
echo -e "${GREEN}🎉 Development environment is ready!${NC}"
echo ""
echo "Services running:"
echo "- Infrastructure nginx: http://localhost:8090"
echo "- Auth service: http://localhost:3003 (via nginx: http://localhost:8090/api/auth/)"
echo "- App1 frontend: http://localhost:3001 (via nginx: http://localhost:8090/app1/)"
echo "- App1 backend: http://localhost:8001 (via nginx: http://localhost:8090/api/app1/)"
echo "- PostgreSQL: localhost:5435"
echo ""
echo "Test URLs:"
echo "- App1: http://localhost:8090/app1/"
echo "- Auth health: http://localhost:8090/api/auth/health"
echo "- App1 API health: http://localhost:8090/api/app1/health"
echo ""
echo "To stop the environment:"
echo "  docker-compose -f docker-compose.dev-apps.yml --profile auth --profile app1 down"
echo "  docker-compose -f docker-compose.dev-infrastructure.yml down"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.dev-infrastructure.yml logs -f"
echo "  docker-compose -f docker-compose.dev-apps.yml logs -f"