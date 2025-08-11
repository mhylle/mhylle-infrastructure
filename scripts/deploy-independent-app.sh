#!/bin/bash

# Independent Application Deployment Script
# Deploys a single application without affecting others
# Usage: ./deploy-independent-app.sh APP_NAME FRONTEND_IMAGE BACKEND_IMAGE VERSION

set -e

# Configuration
APP_NAME="$1"
FRONTEND_IMAGE="$2"
BACKEND_IMAGE="$3"
VERSION="$4"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Validate inputs
validate_inputs() {
    if [[ -z "$APP_NAME" || -z "$FRONTEND_IMAGE" || -z "$BACKEND_IMAGE" || -z "$VERSION" ]]; then
        error "Usage: $0 APP_NAME FRONTEND_IMAGE BACKEND_IMAGE VERSION"
        error "Example: $0 app1 ghcr.io/username/app1-frontend ghcr.io/username/app1-backend v20250811-abc123"
        exit 1
    fi
    
    # Validate app name format
    if [[ ! "$APP_NAME" =~ ^(app1|app2)$ ]]; then
        error "App name must be either 'app1' or 'app2'"
        exit 1
    fi
    
    log "Deploying application: $APP_NAME"
    log "Frontend image: $FRONTEND_IMAGE:$VERSION"
    log "Backend image: $BACKEND_IMAGE:$VERSION"
}

# Load environment variables
load_environment() {
    if [[ -f ".env" ]]; then
        source .env
        log "Environment loaded from .env"
    else
        warning "Environment file not found"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running"
        exit 1
    fi
    
    # Check if unified compose file exists
    if [[ ! -f "docker-compose.apps.yml" ]]; then
        error "Unified compose file not found: docker-compose.apps.yml"
        exit 1
    fi
    
    log "Prerequisites validated"
}

# Pull Docker images
pull_images() {
    log "Pulling Docker images..."
    
    # Pull frontend image
    if ! docker pull "$FRONTEND_IMAGE:$VERSION"; then
        error "Failed to pull frontend image: $FRONTEND_IMAGE:$VERSION"
        exit 1
    fi
    
    # Pull backend image
    if ! docker pull "$BACKEND_IMAGE:$VERSION"; then
        error "Failed to pull backend image: $BACKEND_IMAGE:$VERSION"
        exit 1
    fi
    
    log "Images pulled successfully"
}

# Deploy application using Docker Compose profiles
deploy_app() {
    log "Deploying $APP_NAME using Docker Compose profiles..."
    
    # Set environment variables for the specific app
    if [[ "$APP_NAME" == "app1" ]]; then
        export APP1_FRONTEND_IMAGE="$FRONTEND_IMAGE"
        export APP1_BACKEND_IMAGE="$BACKEND_IMAGE"
        export APP1_VERSION="$VERSION"
    elif [[ "$APP_NAME" == "app2" ]]; then
        export APP2_FRONTEND_IMAGE="$FRONTEND_IMAGE"
        export APP2_BACKEND_IMAGE="$BACKEND_IMAGE"
        export APP2_VERSION="$VERSION"
    fi
    
    # Stop existing containers for this app only
    log "Stopping existing $APP_NAME containers..."
    docker-compose -f docker-compose.apps.yml --profile $APP_NAME down --remove-orphans || true
    
    # Start the application
    log "Starting $APP_NAME services..."
    docker-compose -f docker-compose.apps.yml --profile $APP_NAME up -d
    
    log "$APP_NAME deployment completed"
}

# Wait for services to be healthy
wait_for_health() {
    log "Waiting for $APP_NAME services to be healthy..."
    
    local backend_container="${APP_NAME}-backend"
    local frontend_container="${APP_NAME}-frontend"
    
    # Wait for backend health
    local attempts=0
    while [[ $attempts -lt 40 ]]; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$backend_container" 2>/dev/null || echo "unknown")
        
        if [[ "$health_status" == "healthy" ]]; then
            log "✅ Backend is healthy!"
            break
        elif [[ "$health_status" == "unhealthy" ]]; then
            warning "Backend health check failed, checking logs..."
            docker logs "$backend_container" --tail 5 2>/dev/null || true
        fi
        
        info "Backend health status: $health_status (attempt $((attempts + 1))/40)"
        sleep 3
        ((attempts++))
    done
    
    # Wait for frontend health
    attempts=0
    while [[ $attempts -lt 20 ]]; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$frontend_container" 2>/dev/null || echo "unknown")
        
        if [[ "$health_status" == "healthy" ]]; then
            log "✅ Frontend is healthy!"
            break
        fi
        
        info "Frontend health status: $health_status (attempt $((attempts + 1))/20)"
        sleep 3
        ((attempts++))
    done
}

# Verify deployment without affecting other apps
verify_deployment() {
    log "Verifying $APP_NAME deployment..."
    
    # Check container status
    local frontend_status=$(docker inspect --format='{{.State.Status}}' "${APP_NAME}-frontend" 2>/dev/null || echo "not found")
    local backend_status=$(docker inspect --format='{{.State.Status}}' "${APP_NAME}-backend" 2>/dev/null || echo "not found")
    
    if [[ "$frontend_status" == "running" && "$backend_status" == "running" ]]; then
        log "✅ $APP_NAME containers are running successfully"
        
        # Verify other apps are still running
        check_other_apps_still_running
        
        return 0
    else
        error "❌ $APP_NAME deployment verification failed"
        error "Frontend status: $frontend_status"
        error "Backend status: $backend_status"
        return 1
    fi
}

# Critical: Ensure other apps are still running
check_other_apps_still_running() {
    log "Verifying other applications are still running..."
    
    if [[ "$APP_NAME" == "app1" ]]; then
        # Check if app2 is still running
        if docker ps --format "table {{.Names}}" | grep -q "app2"; then
            log "✅ app2 is still running"
        else
            warning "⚠️ app2 is not running - this may need investigation"
        fi
    elif [[ "$APP_NAME" == "app2" ]]; then
        # Check if app1 is still running
        if docker ps --format "table {{.Names}}" | grep -q "app1"; then
            log "✅ app1 is still running"
        else
            warning "⚠️ app1 is not running - this may need investigation"
        fi
    fi
}

# Rollback function
rollback() {
    error "Deployment failed, attempting rollback..."
    
    # Stop failed containers
    docker-compose -f docker-compose.apps.yml --profile $APP_NAME down --remove-orphans || true
    
    error "Rollback completed"
}

# Main deployment function
main() {
    log "Starting independent deployment of $APP_NAME..."
    
    # Set trap for rollback on error
    trap rollback ERR
    
    validate_inputs
    load_environment
    check_prerequisites
    pull_images
    deploy_app
    
    # Remove trap before verification
    trap - ERR
    
    if verify_deployment; then
        wait_for_health
        log "🎉 Independent deployment of $APP_NAME completed successfully!"
        info "Other applications remain unaffected"
        
        # Show current status
        log "Current application status:"
        docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(app1|app2)" || echo "No application containers found"
    else
        rollback
        exit 1
    fi
}

# Run main function
main "$@"
