#!/bin/bash

# Application Rollback Script for mhylle.com Infrastructure
# Rolls back an application to a previous version
# Usage: ./rollback-app.sh APP_NAME [VERSION]

set -e

# Configuration
APP_NAME="$1"
TARGET_VERSION="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Validate inputs
validate_inputs() {
    if [[ -z "$APP_NAME" ]]; then
        error "Usage: $0 APP_NAME [VERSION]"
        error "Example: $0 app1"
        error "         $0 app1 v1.2.3"
        exit 1
    fi
    
    # Validate app name format
    if [[ ! "$APP_NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
        error "App name must contain only alphanumeric characters and hyphens"
        exit 1
    fi
    
    log "Preparing rollback for application: $APP_NAME"
    if [[ -n "$TARGET_VERSION" ]]; then
        log "Target version: $TARGET_VERSION"
    else
        log "Will rollback to previous version"
    fi
}

# Load environment variables
load_environment() {
    if [[ -f "$INFRA_DIR/.env" ]]; then
        source "$INFRA_DIR/.env"
        log "Environment loaded from $INFRA_DIR/.env"
    else
        warning "Environment file not found at $INFRA_DIR/.env"
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
    
    # Check if app containers exist
    if ! docker ps -a --format '{{.Names}}' | grep -q "${APP_NAME}-"; then
        error "No containers found for app: $APP_NAME"
        exit 1
    fi
    
    # Check if core infrastructure is running
    if ! docker ps | grep -q "mhylle-nginx"; then
        error "Core infrastructure is not running"
        exit 1
    fi
}

# Get deployment history from database
get_deployment_history() {
    log "Retrieving deployment history..."
    
    # Query deployment logs from PostgreSQL
    local deployments=$(docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
        SELECT deployment_id, version, frontend_image, backend_image, started_at, status 
        FROM deployment_logs 
        WHERE app_name = '$APP_NAME' AND status = 'success' 
        ORDER BY started_at DESC 
        LIMIT 10;
    " 2>/dev/null || echo "")
    
    if [[ -z "$deployments" ]]; then
        warning "No deployment history found in database"
        return 1
    fi
    
    echo "$deployments"
    return 0
}

# Show available versions
show_available_versions() {
    log "Available versions for rollback:"
    echo ""
    
    local history=$(get_deployment_history)
    if [[ $? -ne 0 ]]; then
        # Fallback: check Docker images
        warning "Using Docker images as fallback"
        
        echo "Available Docker images:"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep -E "${APP_NAME}-(frontend|backend)" | head -10
        return 1
    fi
    
    echo "Recent successful deployments:"
    echo "DEPLOYMENT_ID                     VERSION    DATE                 STATUS"
    echo "----------------------------------------------------------------"
    echo "$history" | head -5 | while IFS='|' read -r dep_id version frontend backend date status; do
        # Clean up whitespace
        dep_id=$(echo "$dep_id" | tr -d ' ')
        version=$(echo "$version" | tr -d ' ')
        date=$(echo "$date" | tr -d ' ')
        status=$(echo "$status" | tr -d ' ')
        
        printf "%-35s %-10s %-20s %s\n" "$dep_id" "$version" "$date" "$status"
    done
    
    return 0
}

# Get target deployment info
get_target_deployment() {
    local target_version="$1"
    
    if [[ -n "$target_version" ]]; then
        # Find specific version
        local deployment=$(docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
            SELECT deployment_id, version, frontend_image, backend_image 
            FROM deployment_logs 
            WHERE app_name = '$APP_NAME' AND version = '$target_version' AND status = 'success' 
            ORDER BY started_at DESC 
            LIMIT 1;
        " 2>/dev/null || echo "")
    else
        # Get previous version (skip the most recent one)
        local deployment=$(docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
            SELECT deployment_id, version, frontend_image, backend_image 
            FROM deployment_logs 
            WHERE app_name = '$APP_NAME' AND status = 'success' 
            ORDER BY started_at DESC 
            OFFSET 1 LIMIT 1;
        " 2>/dev/null || echo "")
    fi
    
    if [[ -z "$deployment" ]]; then
        return 1
    fi
    
    echo "$deployment"
    return 0
}

# Create rollback deployment record
create_rollback_record() {
    local deployment_id="$1"
    local version="$2"
    local frontend_image="$3"
    local backend_image="$4"
    
    local rollback_id="rollback-$(date +%s)"
    
    # Insert rollback record
    docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        INSERT INTO deployment_logs (
            app_name, deployment_id, status, frontend_image, backend_image, 
            version, deployed_by, metadata
        ) VALUES (
            '$APP_NAME', '$rollback_id', 'started', '$frontend_image', '$backend_image',
            '$version', 'rollback_script', 
            '{\"rollback_from\": \"$(get_current_version)\", \"rollback_to\": \"$version\", \"original_deployment\": \"$deployment_id\"}'
        );
    " 2>/dev/null || warning "Failed to create rollback record"
    
    echo "$rollback_id"
}

# Get current version
get_current_version() {
    # Try to get from deployment logs
    local current=$(docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
        SELECT version 
        FROM deployment_logs 
        WHERE app_name = '$APP_NAME' AND status = 'success' 
        ORDER BY started_at DESC 
        LIMIT 1;
    " 2>/dev/null | tr -d ' ' || echo "unknown")
    
    echo "$current"
}

# Stop current containers
stop_current_containers() {
    log "Stopping current containers..."
    
    for container in "${APP_NAME}-frontend" "${APP_NAME}-backend"; do
        if docker ps -q -f name="$container" | grep -q .; then
            log "Stopping container: $container"
            docker stop "$container" || true
            docker rm "$container" || true
        fi
    done
}

# Start rollback containers
start_rollback_containers() {
    local frontend_image="$1"
    local backend_image="$2"
    local version="$3"
    
    log "Starting rollback containers..."
    log "Frontend image: $frontend_image"
    log "Backend image: $backend_image"
    
    # Get database credentials
    local db_name="${APP_NAME}_db"
    local db_user="app_${APP_NAME}"
    local db_password_var="DB_PASSWORD_${APP_NAME^^}"
    local db_password="${!db_password_var}"
    
    # Pull images if needed
    docker pull "$frontend_image" || warning "Failed to pull frontend image"
    docker pull "$backend_image" || warning "Failed to pull backend image"
    
    # Start backend container
    docker run -d \
        --name "${APP_NAME}-backend" \
        --network mhylle_app-network \
        --restart unless-stopped \
        -e NODE_ENV=production \
        -e DB_HOST=mhylle-postgres \
        -e DB_PORT=5432 \
        -e DB_NAME="$db_name" \
        -e DB_USER="$db_user" \
        -e DB_PASSWORD="$db_password" \
        -e API_PREFIX="/api/$APP_NAME" \
        --health-cmd="curl -f http://localhost:3000/health || exit 1" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=40s \
        "$backend_image"
    
    # Wait for backend to be healthy
    log "Waiting for backend to be healthy..."
    local attempts=0
    while [[ $attempts -lt 30 ]]; do
        if docker inspect --format='{{.State.Health.Status}}' "${APP_NAME}-backend" | grep -q "healthy"; then
            break
        fi
        sleep 2
        ((attempts++))
    done
    
    if [[ $attempts -eq 30 ]]; then
        warning "Backend health check timeout, continuing anyway"
    fi
    
    # Start frontend container
    docker run -d \
        --name "${APP_NAME}-frontend" \
        --network mhylle_app-network \
        --restart unless-stopped \
        -e NODE_ENV=production \
        --health-cmd="curl -f http://localhost:80 || exit 1" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=30s \
        "$frontend_image"
    
    log "Rollback containers started successfully"
}

# Verify rollback
verify_rollback() {
    log "Verifying rollback..."
    
    # Check container status
    local frontend_status=$(docker inspect --format='{{.State.Status}}' "${APP_NAME}-frontend" 2>/dev/null || echo "not found")
    local backend_status=$(docker inspect --format='{{.State.Status}}' "${APP_NAME}-backend" 2>/dev/null || echo "not found")
    
    if [[ "$frontend_status" == "running" && "$backend_status" == "running" ]]; then
        log "Containers are running successfully"
        
        # Test HTTP endpoints
        sleep 5
        if curl -f -s "https://mhylle.com/health/$APP_NAME" > /dev/null; then
            log "Health check passed"
            return 0
        else
            warning "Health check failed, but containers are running"
            return 1
        fi
    else
        error "Rollback verification failed"
        error "Frontend status: $frontend_status"
        error "Backend status: $backend_status"
        return 1
    fi
}

# Update rollback record status
update_rollback_status() {
    local rollback_id="$1"
    local status="$2"
    local error_message="$3"
    
    local error_sql=""
    if [[ -n "$error_message" ]]; then
        error_sql=", error_message = '$error_message'"
    fi
    
    docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        UPDATE deployment_logs 
        SET status = '$status', completed_at = NOW() $error_sql
        WHERE deployment_id = '$rollback_id';
    " 2>/dev/null || warning "Failed to update rollback status"
}

# Confirm rollback
confirm_rollback() {
    local current_version="$1"
    local target_version="$2"
    
    echo ""
    warning "You are about to rollback $APP_NAME"
    warning "Current version: $current_version"
    warning "Target version: $target_version"
    echo ""
    warning "This action cannot be undone automatically."
    echo ""
    
    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Rollback cancelled"
        exit 0
    fi
}

# Main rollback function
main() {
    validate_inputs
    load_environment
    check_prerequisites
    
    # Show available versions if no target specified
    if [[ -z "$TARGET_VERSION" ]]; then
        show_available_versions
        echo ""
    fi
    
    # Get target deployment info
    local deployment_info=$(get_target_deployment "$TARGET_VERSION")
    if [[ $? -ne 0 ]]; then
        if [[ -n "$TARGET_VERSION" ]]; then
            error "Version $TARGET_VERSION not found for app $APP_NAME"
        else
            error "No previous version found for app $APP_NAME"
        fi
        exit 1
    fi
    
    # Parse deployment info
    IFS='|' read -r dep_id version frontend_image backend_image <<< "$deployment_info"
    dep_id=$(echo "$dep_id" | tr -d ' ')
    version=$(echo "$version" | tr -d ' ')
    frontend_image=$(echo "$frontend_image" | tr -d ' ')
    backend_image=$(echo "$backend_image" | tr -d ' ')
    
    # Get current version for confirmation
    local current_version=$(get_current_version)
    
    # Confirm rollback
    confirm_rollback "$current_version" "$version"
    
    # Create rollback record
    local rollback_id=$(create_rollback_record "$dep_id" "$version" "$frontend_image" "$backend_image")
    
    log "Starting rollback of $APP_NAME to version $version..."
    
    # Set trap for error handling
    trap "update_rollback_status '$rollback_id' 'failed' 'Rollback script error'; error 'Rollback failed'; exit 1" ERR
    
    # Perform rollback
    stop_current_containers
    start_rollback_containers "$frontend_image" "$backend_image" "$version"
    
    # Remove trap before verification
    trap - ERR
    
    if verify_rollback; then
        update_rollback_status "$rollback_id" "success" ""
        log "Rollback of $APP_NAME to version $version completed successfully!"
        info "Application available at: https://mhylle.com/$APP_NAME"
        info "API available at: https://mhylle.com/api/$APP_NAME"
    else
        update_rollback_status "$rollback_id" "failed" "Verification failed"
        error "Rollback verification failed"
        exit 1
    fi
}

# Run main function
main "$@"
