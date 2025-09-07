#!/bin/bash

# Simple Docker-based SSL Certificate Setup Script for mhylle.com
# Runs directly on the server without requiring project structure
# Usage: ./simple-ssl-setup.sh

set -e

# Configuration
DOMAIN="mhylle.com"
EMAIL="admin@mhylle.com"
CERT_DIR="/root/letsencrypt"
CHALLENGE_DIR="/root/certbot-challenges"

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
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
        exit 1
    fi
    
    if ! docker ps --format '{{.Names}}' | grep -q "^mhylle-nginx$"; then
        error "mhylle-nginx container is not running"
        exit 1
    fi
}

# Create directories
create_directories() {
    log "Creating directories..."
    mkdir -p "$CERT_DIR" "$CHALLENGE_DIR"
}

# Setup ACME challenge in nginx
setup_acme_challenge() {
    log "Setting up ACME challenge in nginx..."
    
    # Add certbot challenge volume to nginx container
    docker exec mhylle-nginx mkdir -p /var/www/certbot
    
    # Create ACME challenge configuration directly in nginx
    docker exec mhylle-nginx sh -c 'cat > /etc/nginx/conf.d/acme-challenge.conf << "EOF"
server {
    listen 80;
    server_name mhylle.com www.mhylle.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
        allow all;
        add_header Content-Type text/plain;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF'
    
    # Reload nginx
    docker exec mhylle-nginx nginx -s reload
    log "ACME challenge configured"
}

# Mount challenge directory to nginx
mount_challenge_dir() {
    log "Setting up challenge directory volume..."
    
    # Copy challenge files to nginx container when needed
    # This will be done during certificate generation
    info "Challenge directory prepared"
}

# Obtain certificates using certbot docker
obtain_certificates() {
    log "Obtaining SSL certificates..."
    
    # First try staging to test
    info "Testing with staging certificates..."
    docker run --rm \
        -v "$CERT_DIR:/etc/letsencrypt" \
        -v "$CHALLENGE_DIR:/var/www/certbot" \
        --network host \
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
        log "Staging successful, getting production certificates..."
        
        # Get production certificates
        docker run --rm \
            -v "$CERT_DIR:/etc/letsencrypt" \
            -v "$CHALLENGE_DIR:/var/www/certbot" \
            --network host \
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
        error "Staging certificates failed"
        return 1
    fi
}

# Copy certificates to nginx
copy_certificates_to_nginx() {
    log "Copying certificates to nginx container..."
    
    local source_cert="$CERT_DIR/live/$DOMAIN"
    
    if [[ -d "$source_cert" ]]; then
        # Create SSL directory in nginx container
        docker exec mhylle-nginx mkdir -p /etc/nginx/ssl
        
        # Copy certificates
        docker cp "$source_cert/fullchain.pem" mhylle-nginx:/etc/nginx/ssl/mhylle.com.crt
        docker cp "$source_cert/privkey.pem" mhylle-nginx:/etc/nginx/ssl/mhylle.com.key
        
        # Copy DH parameters if they exist
        if [[ -f "/tmp/dhparam.pem" ]]; then
            docker cp "/tmp/dhparam.pem" mhylle-nginx:/etc/nginx/ssl/dhparam.pem
        fi
        
        log "Certificates copied to nginx container"
    else
        error "Certificate directory not found: $source_cert"
        return 1
    fi
}

# Generate DH parameters
generate_dhparam() {
    log "Generating DH parameters..."
    
    if [[ ! -f "/tmp/dhparam.pem" ]]; then
        docker run --rm -v "/tmp:/tmp" alpine/openssl \
            dhparam -out /tmp/dhparam.pem 2048
        log "DH parameters generated"
    else
        info "DH parameters already exist"
    fi
}

# Enable HTTPS in nginx
enable_https() {
    log "Enabling HTTPS in nginx configuration..."
    
    # Uncomment the HTTPS server block in nginx.conf
    docker exec mhylle-nginx sh -c '
        sed -i "/# Main HTTPS server block - DISABLED/,/# }/s/^[[:space:]]*# //" /etc/nginx/nginx.conf &&
        sed -i "s|# return 301 https://\$host\$request_uri;|return 301 https://\$host\$request_uri;|" /etc/nginx/nginx.conf
    '
    
    log "HTTPS configuration enabled"
}

# Test configuration and reload
test_and_reload() {
    log "Testing nginx configuration..."
    
    if docker exec mhylle-nginx nginx -t; then
        log "Configuration test passed"
        
        # Remove ACME-only config
        docker exec mhylle-nginx rm -f /etc/nginx/conf.d/acme-challenge.conf
        
        # Reload nginx
        docker exec mhylle-nginx nginx -s reload
        log "Nginx reloaded successfully"
        
        # Wait and test HTTPS
        sleep 5
        test_https_connection
    else
        error "Nginx configuration test failed"
        return 1
    fi
}

# Test HTTPS connection
test_https_connection() {
    log "Testing HTTPS connection..."
    
    if timeout 10 curl -f -s -k "https://$DOMAIN/" > /dev/null 2>&1; then
        log "HTTPS connection test passed"
    else
        warning "HTTPS connection test failed - checking certificate"
    fi
    
    # Check certificate info
    info "Certificate information:"
    echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || warning "Could not retrieve certificate info"
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -f /tmp/dhparam.pem
}

# Main function
main() {
    log "Starting SSL certificate setup for $DOMAIN..."
    
    check_prerequisites
    create_directories
    generate_dhparam
    setup_acme_challenge
    
    # Copy challenge directory contents to nginx
    docker exec mhylle-nginx mkdir -p /var/www/certbot
    
    obtain_certificates
    copy_certificates_to_nginx
    enable_https
    test_and_reload
    
    log "SSL setup completed successfully!"
    info "Your site should now be available at: https://$DOMAIN"
}

# Trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"