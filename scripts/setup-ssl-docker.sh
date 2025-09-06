#!/bin/bash

# Docker-based SSL Certificate Setup Script
# Sets up Let's Encrypt SSL certificates using Docker containers only
# Usage: ./setup-ssl-docker.sh

set -e

# Configuration
DOMAIN="mhylle.com"
EMAIL="${SSL_EMAIL:-admin@mhylle.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check if nginx container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^mhylle-nginx$"; then
        error "mhylle-nginx container is not running"
        exit 1
    fi
    
    # Check domain resolution
    local resolved_ip=$(nslookup $DOMAIN 8.8.8.8 | grep -A1 "Name:" | tail -n1 | awk '{print $2}' || echo "")
    if [[ "$resolved_ip" != "51.159.168.239" ]]; then
        warning "Domain $DOMAIN may not resolve to 51.159.168.239 (resolved to: $resolved_ip)"
        warning "Please ensure DNS is configured correctly"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$PROJECT_ROOT/certbot-challenges"
    mkdir -p "$PROJECT_ROOT/infrastructure/ssl"
    mkdir -p "$PROJECT_ROOT/certbot-certs"
    
    # Set permissions
    chmod 755 "$PROJECT_ROOT/certbot-challenges"
    chmod 755 "$PROJECT_ROOT/infrastructure/ssl"
}

# Generate DH parameters for perfect forward secrecy
generate_dhparam() {
    log "Generating DH parameters for perfect forward secrecy..."
    
    if [[ ! -f "$PROJECT_ROOT/infrastructure/ssl/dhparam.pem" ]]; then
        docker run --rm -v "$PROJECT_ROOT/infrastructure/ssl:/ssl" alpine/openssl \
            dhparam -out /ssl/dhparam.pem 2048
        log "DH parameters generated"
    else
        info "DH parameters already exist, skipping generation"
    fi
}

# Update nginx for ACME challenge
setup_acme_challenge() {
    log "Setting up ACME challenge configuration..."
    
    # Create ACME challenge location config
    cat > "$PROJECT_ROOT/infrastructure/nginx/apps/acme-challenge.conf" << 'EOF'
# ACME Challenge configuration for Let's Encrypt
# This is a temporary configuration used during certificate generation

server {
    listen 80;
    server_name mhylle.com www.mhylle.com;
    
    # ACME challenge location - must be accessible over HTTP
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
        
        # Allow from anywhere for certificate validation
        allow all;
        
        # Set proper headers
        add_header Content-Type text/plain;
    }
    
    # Redirect other traffic to HTTPS (after we have certificates)
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF
    
    log "ACME challenge configuration created"
}

# Obtain SSL certificates using Docker
obtain_certificates() {
    log "Obtaining SSL certificates using Certbot Docker container..."
    
    # Restart nginx to load ACME challenge config
    docker exec mhylle-nginx nginx -s reload
    
    # Wait for nginx reload
    sleep 2
    
    # Run certbot in Docker container
    info "Running certbot for staging certificates first..."
    docker run --rm \
        -v "$PROJECT_ROOT/certbot-certs:/etc/letsencrypt" \
        -v "$PROJECT_ROOT/certbot-challenges:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --staging \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    
    if [[ $? -eq 0 ]]; then
        log "Staging certificates obtained successfully, getting production certificates..."
        
        # Get production certificates
        docker run --rm \
            -v "$PROJECT_ROOT/certbot-certs:/etc/letsencrypt" \
            -v "$PROJECT_ROOT/certbot-challenges:/var/www/certbot" \
            certbot/certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            --force-renewal \
            -d "$DOMAIN" \
            -d "www.$DOMAIN"
        
        log "Production certificates obtained"
    else
        error "Failed to obtain staging certificates"
        return 1
    fi
}

# Copy certificates to infrastructure directory
copy_certificates() {
    log "Copying certificates to infrastructure directory..."
    
    local cert_dir="$PROJECT_ROOT/certbot-certs/live/$DOMAIN"
    
    if [[ -d "$cert_dir" ]]; then
        cp "$cert_dir/fullchain.pem" "$PROJECT_ROOT/infrastructure/ssl/$DOMAIN.crt"
        cp "$cert_dir/privkey.pem" "$PROJECT_ROOT/infrastructure/ssl/$DOMAIN.key"
        
        # Set proper permissions
        chmod 644 "$PROJECT_ROOT/infrastructure/ssl/$DOMAIN.crt"
        chmod 600 "$PROJECT_ROOT/infrastructure/ssl/$DOMAIN.key"
        
        log "Certificates copied successfully"
    else
        error "Certificate directory not found: $cert_dir"
        return 1
    fi
}

# Fix SSL configuration paths
fix_ssl_config() {
    log "Fixing SSL configuration paths..."
    
    # Update ssl.conf to use correct paths
    sed -i 's|/etc/ssl/certs/mhylle.com.crt|/etc/nginx/ssl/mhylle.com.crt|g' \
        "$PROJECT_ROOT/infrastructure/nginx/ssl.conf"
    
    sed -i 's|/etc/ssl/certs/dhparam.pem|/etc/nginx/ssl/dhparam.pem|g' \
        "$PROJECT_ROOT/infrastructure/nginx/ssl.conf"
    
    log "SSL configuration paths updated"
}

# Enable HTTPS in nginx configuration
enable_https() {
    log "Enabling HTTPS in nginx configuration..."
    
    # Uncomment HTTPS server block in nginx.conf
    sed -i '/# Main HTTPS server block - DISABLED/,/# }/s/^[[:space:]]*# //' \
        "$PROJECT_ROOT/infrastructure/nginx/nginx.conf"
    
    # Enable HTTP to HTTPS redirect
    sed -i 's|# return 301 https://\$host\$request_uri;|return 301 https://\$host\$request_uri;|' \
        "$PROJECT_ROOT/infrastructure/nginx/nginx.conf"
    
    log "HTTPS configuration enabled"
}

# Update Docker Compose to include certbot challenge directory
update_docker_compose() {
    log "Updating Docker Compose configuration..."
    
    # Add certbot challenge volume to nginx service
    if ! grep -q "certbot-challenges" "$PROJECT_ROOT/docker-compose.yml"; then
        # Add volume mount for certbot challenges
        sed -i '/- \.\/logs\/nginx:\/var\/log\/nginx/a\      - ./certbot-challenges:/var/www/certbot' \
            "$PROJECT_ROOT/docker-compose.yml"
        
        log "Docker Compose updated with certbot challenge volume"
    else
        info "Docker Compose already configured for certbot challenges"
    fi
}

# Clean up temporary files
cleanup_temp_files() {
    log "Cleaning up temporary files..."
    
    # Remove ACME challenge config
    rm -f "$PROJECT_ROOT/infrastructure/nginx/apps/acme-challenge.conf"
    
    log "Temporary files cleaned up"
}

# Test SSL configuration
test_ssl() {
    log "Testing SSL configuration..."
    
    # Test nginx configuration
    if docker exec mhylle-nginx nginx -t; then
        log "Nginx configuration test passed"
    else
        error "Nginx configuration test failed"
        return 1
    fi
    
    # Reload nginx with new configuration
    docker exec mhylle-nginx nginx -s reload
    
    # Wait for reload
    sleep 5
    
    # Test HTTPS connection
    info "Testing HTTPS connection..."
    if curl -f -s --max-time 10 "https://$DOMAIN/health" > /dev/null 2>&1; then
        log "HTTPS connection test passed"
    else
        warning "HTTPS connection test failed - this may be normal if the health endpoint doesn't exist"
    fi
    
    # Check certificate expiration
    if [[ -f "$PROJECT_ROOT/infrastructure/ssl/$DOMAIN.crt" ]]; then
        local expiry=$(openssl x509 -in "$PROJECT_ROOT/infrastructure/ssl/$DOMAIN.crt" -noout -enddate | cut -d= -f2)
        info "Certificate expires: $expiry"
    fi
}

# Main function
main() {
    log "Starting Docker-based SSL certificate setup for $DOMAIN..."
    
    check_prerequisites
    create_directories
    generate_dhparam
    fix_ssl_config
    update_docker_compose
    setup_acme_challenge
    obtain_certificates
    copy_certificates
    enable_https
    cleanup_temp_files
    test_ssl
    
    log "SSL certificate setup completed successfully!"
    info "Your site is now available at: https://$DOMAIN"
    info "HTTP traffic will be automatically redirected to HTTPS"
    info ""
    info "To renew certificates in the future, run:"
    info "  docker run --rm -v $PROJECT_ROOT/certbot-certs:/etc/letsencrypt certbot/certbot renew"
    info ""
    info "Next steps:"
    info "  1. Test your site: curl -I https://$DOMAIN/"
    info "  2. Check certificate: openssl x509 -in infrastructure/ssl/$DOMAIN.crt -noout -text"
    info "  3. Set up automatic renewal via cron"
}

# Trap for cleanup on exit
trap cleanup_temp_files EXIT

# Run main function
main "$@"