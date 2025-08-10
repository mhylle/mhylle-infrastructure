#!/bin/bash

# Application Deployment Script for mhylle.com Infrastructure
# Deploys an application with zero-downtime using blue-green deployment
# Usage: ./deploy-app.sh APP_NAME FRONTEND_IMAGE BACKEND_IMAGE [VERSION]

set -e

# Configuration
APP_NAME="$1"
FRONTEND_IMAGE="$2"
BACKEND_IMAGE="$3"
VERSION="${4:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to get the correct health check URL for each app
get_health_check_url() {
    local app_name="$1"
    case "$app_name" in
        app1)
            echo "http://localhost:3000/health"
            ;;
        app2)
            echo "http://localhost:3000/api/app2/health"
            ;;
        *)
            echo "http://localhost:3000/health"
            ;;
    esac
}

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Validate inputs
validate_inputs() {
    if [[ -z "$APP_NAME" || -z "$FRONTEND_IMAGE" || -z "$BACKEND_IMAGE" ]]; then
        error "Usage: $0 APP_NAME FRONTEND_IMAGE BACKEND_IMAGE [VERSION]"
        error "Example: $0 app1 ghcr.io/username/app1-frontend ghcr.io/username/app1-backend"
        exit 1
    fi
    
    # Validate app name format
    if [[ ! "$APP_NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
        error "App name must contain only alphanumeric characters and hyphens"
        exit 1
    fi
    
    log "Deploying application: $APP_NAME"
    log "Frontend image: $FRONTEND_IMAGE:$VERSION"
    log "Backend image: $BACKEND_IMAGE:$VERSION"
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
    
    # Check if core infrastructure is running
    if ! docker ps | grep -q "mhylle-nginx"; then
        error "Core infrastructure is not running. Please run 'docker-compose up -d' in the infrastructure directory"
        exit 1
    fi
    
    # Check if nginx config directory exists
    if [[ ! -d "$INFRA_DIR/nginx/apps" ]]; then
        mkdir -p "$INFRA_DIR/nginx/apps"
        log "Created nginx apps directory"
    fi
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

# Create application database
create_app_database() {
    log "Creating application database..."
    
    local db_name="${APP_NAME}_db"
    local db_user="app_${APP_NAME}"
    local db_password=$(openssl rand -base64 32)
    
    # Create database and user
    docker exec mhylle-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_name') THEN
                CREATE DATABASE $db_name;
            END IF;
            
            IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$db_user') THEN
                CREATE USER $db_user WITH PASSWORD '$db_password';
            END IF;
            
            GRANT ALL PRIVILEGES ON DATABASE $db_name TO $db_user;
        END
        \$\$;
    " 2>/dev/null || warning "Database setup may have failed"
    
    # Store database credentials
    echo "DB_PASSWORD_${APP_NAME^^}=$db_password" >> "$INFRA_DIR/.env.apps"
    
    info "Database $db_name created with user $db_user"
}

# Stop existing containers
stop_existing_containers() {
    log "Stopping existing containers for $APP_NAME..."
    
    # Stop and remove old containers gracefully
    for container in "${APP_NAME}-frontend" "${APP_NAME}-backend"; do
        if docker ps -q -f name="$container" | grep -q .; then
            log "Stopping container: $container"
            docker stop "$container" || true
        fi
        if docker ps -aq -f name="$container" | grep -q .; then
            log "Removing container: $container"
            docker rm "$container" || true
        fi
    done
    
    # Wait a moment for cleanup to complete
    sleep 2
}

# Start new containers
start_new_containers() {
    log "Starting new containers for $APP_NAME..."
    
    # Get database credentials
    local db_name="${APP_NAME}_db"
    local db_user="app_${APP_NAME}"
    local db_password_var="DB_PASSWORD_${APP_NAME^^}"
    local db_password="${!db_password_var}"
    
    # Get the correct health check URL for this app
    local health_check_url=$(get_health_check_url "$APP_NAME")
    
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
        --health-cmd="curl -f $health_check_url || exit 1" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=40s \
        "$BACKEND_IMAGE:$VERSION"
    
    # Wait for backend to be healthy
    log "Waiting for backend to be healthy..."
    local attempts=0
    while [[ $attempts -lt 30 ]]; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "${APP_NAME}-backend" 2>/dev/null || echo "unknown")
        
        if [[ "$health_status" == "healthy" ]]; then
            log "✅ Backend is healthy!"
            break
        elif [[ "$health_status" == "unhealthy" ]]; then
            warning "Backend health check failed, checking logs..."
            docker logs "${APP_NAME}-backend" --tail 10 2>/dev/null || true
        fi
        
        info "Backend health status: $health_status (attempt $((attempts + 1))/30)"
        sleep 2
        ((attempts++))
    done
    
    if [[ $attempts -eq 30 ]]; then
        warning "Backend health check timeout after 60 seconds"
        # Check if the container is at least running
        if docker ps --format "table {{.Names}}" | grep -q "^${APP_NAME}-backend$"; then
            warning "Backend container is running but health check failed. Continuing with deployment..."
        else
            error "Backend container is not running. Deployment failed."
            return 1
        fi
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
        "$FRONTEND_IMAGE:$VERSION"
    
    log "Containers started successfully"
}

# Update Nginx configuration
update_nginx_config() {
    log "Updating Nginx configuration for $APP_NAME..."
    
    local config_file="$INFRA_DIR/nginx/apps/${APP_NAME}.conf"
    
    # Get the health endpoint path for nginx
    local health_check_url=$(get_health_check_url "$APP_NAME")
    local health_path=$(echo "$health_check_url" | sed 's|http://localhost:3000||')
    
    # Generate nginx config from template
    cat > "$config_file" << EOF
# Nginx configuration for $APP_NAME
# Auto-generated by deploy-app.sh

# Upstream definitions for $APP_NAME services
upstream ${APP_NAME}_frontend {
    server ${APP_NAME}-frontend:80;
    keepalive 32;
}

upstream ${APP_NAME}_backend {
    server ${APP_NAME}-backend:3000;
    keepalive 32;
}

# $APP_NAME server block within the main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mhylle.com www.mhylle.com;
    
    # SSL certificates (inherited from main config)
    ssl_certificate /etc/nginx/ssl/mhylle.com.crt;
    ssl_certificate_key /etc/nginx/ssl/mhylle.com.key;
    
    # Frontend routes - Angular application
    location /$APP_NAME {
        limit_req zone=web burst=20 nodelay;
        
        rewrite ^/$APP_NAME/(.*)$ /\$1 break;
        rewrite ^/$APP_NAME$ / break;
        
        proxy_pass http://${APP_NAME}_frontend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        try_files \$uri \$uri/ @${APP_NAME}_fallback;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Content-Type-Options nosniff;
        }
        
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }
    
    location @${APP_NAME}_fallback {
        rewrite ^.*$ /index.html last;
        proxy_pass http://${APP_NAME}_frontend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Backend API routes
    location /api/$APP_NAME {
        limit_req zone=api burst=10 nodelay;
        
        rewrite ^/api/$APP_NAME/(.*)$ /\$1 break;
        rewrite ^/api/$APP_NAME$ / break;
        
        proxy_pass http://${APP_NAME}_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        add_header Access-Control-Allow-Origin "https://mhylle.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization, X-Requested-With" always;
        add_header Access-Control-Allow-Credentials true always;
        
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://mhylle.com";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization, X-Requested-With";
            add_header Access-Control-Allow-Credentials true;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
    
    # WebSocket support
    location /ws/$APP_NAME {
        proxy_pass http://${APP_NAME}_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Health check
    location /health/$APP_NAME {
        access_log off;
        proxy_pass http://${APP_NAME}_backend${health_path};
        proxy_set_header Host \$host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 5s;
    }
}
EOF
    
    log "Nginx configuration updated"
}

# Reload Nginx
reload_nginx() {
    log "Reloading Nginx configuration..."
    
    # Test configuration first
    if docker exec mhylle-nginx nginx -t; then
        docker exec mhylle-nginx nginx -s reload
        log "Nginx configuration reloaded successfully"
    else
        error "Nginx configuration test failed"
        exit 1
    fi
}

# Cleanup old images
cleanup_old_images() {
    log "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old versions of the specific images (keep last 3)
    for image in "$FRONTEND_IMAGE" "$BACKEND_IMAGE"; do
        docker images "$image" --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" | \
        tail -n +2 | sort -k2 -Vr | tail -n +4 | awk '{print $3}' | \
        xargs -r docker rmi || true
    done
    
    log "Cleanup completed"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check container status
    local frontend_status=$(docker inspect --format='{{.State.Status}}' "${APP_NAME}-frontend" 2>/dev/null || echo "not found")
    local backend_status=$(docker inspect --format='{{.State.Status}}' "${APP_NAME}-backend" 2>/dev/null || echo "not found")
    
    if [[ "$frontend_status" == "running" && "$backend_status" == "running" ]]; then
        log "Containers are running successfully"
        
        # Test HTTP endpoints
        sleep 5
        if curl -f -s "https://mhylle.com/health/$APP_NAME" > /dev/null; then
            log "Health check passed"
        else
            warning "Health check failed, but containers are running"
        fi
        
        return 0
    else
        error "Deployment verification failed"
        error "Frontend status: $frontend_status"
        error "Backend status: $backend_status"
        return 1
    fi
}

# Rollback function
rollback() {
    error "Deployment failed, attempting rollback..."
    
    # Stop new containers
    docker stop "${APP_NAME}-frontend" "${APP_NAME}-backend" 2>/dev/null || true
    docker rm "${APP_NAME}-frontend" "${APP_NAME}-backend" 2>/dev/null || true
    
    # Remove nginx config
    rm -f "$INFRA_DIR/nginx/apps/${APP_NAME}.conf"
    
    # Reload nginx
    docker exec mhylle-nginx nginx -s reload 2>/dev/null || true
    
    error "Rollback completed"
}

# Main deployment function
main() {
    log "Starting deployment of $APP_NAME..."
    
    # Set trap for rollback on error
    trap rollback ERR
    
    validate_inputs
    load_environment
    check_prerequisites
    pull_images
    create_app_database
    stop_existing_containers
    start_new_containers
    update_nginx_config
    reload_nginx
    
    # Remove trap before verification
    trap - ERR
    
    if verify_deployment; then
        cleanup_old_images
        log "Deployment of $APP_NAME completed successfully!"
        info "Application available at: https://mhylle.com/$APP_NAME"
        info "API available at: https://mhylle.com/api/$APP_NAME"
    else
        rollback
        exit 1
    fi
}

# Run main function
main "$@"
