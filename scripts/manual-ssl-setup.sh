#!/bin/bash

# Manual SSL Certificate Setup Script
# Uses docker cp to transfer challenge files instead of volume mounts
# Usage: ./manual-ssl-setup.sh

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

# Setup ACME challenge configuration
setup_acme_challenge() {
    log "Setting up ACME challenge configuration..."
    
    # Create challenge directory in nginx
    docker exec mhylle-nginx mkdir -p /var/www/certbot
    
    # Create ACME-only server configuration
    docker exec mhylle-nginx sh -c 'cat > /etc/nginx/conf.d/acme-challenge.conf << "EOF"
server {
    listen 80;
    server_name mhylle.com;
    
    # ACME challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }
    
    # Temporary: allow other requests for now
    location / {
        proxy_pass http://app1-frontend:80/;
        proxy_set_header Host $host;
    }
}
EOF'
    
    # Reload nginx
    docker exec mhylle-nginx nginx -s reload
    log "ACME challenge configuration ready"
}

# Test ACME challenge setup
test_acme_setup() {
    log "Testing ACME challenge setup..."
    
    # Create a test file
    docker exec mhylle-nginx sh -c 'echo "test123" > /var/www/certbot/test-file'
    
    # Test if we can access it
    if curl -s "http://mhylle.com/.well-known/acme-challenge/test-file" | grep -q "test123"; then
        log "ACME challenge setup working correctly"
        docker exec mhylle-nginx rm -f /var/www/certbot/test-file
        return 0
    else
        error "ACME challenge setup not working"
        return 1
    fi
}

# Manual certificate generation with file copying
obtain_certificates() {
    log "Starting certificate generation process..."
    
    mkdir -p "$CERT_DIR" "$CHALLENGE_DIR"
    
    # Start certbot in webroot mode but handle file copying manually
    info "Running certbot with manual challenge handling..."
    
    # Use certbot with manual plugin to get the challenge files
    docker run --rm -it \
        -v "$CERT_DIR:/etc/letsencrypt" \
        certbot/certbot certonly \
        --manual \
        --preferred-challenges http \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --staging \
        -d "$DOMAIN" \
        --manual-auth-hook '/bin/sh -c "echo \$CERTBOT_VALIDATION > /etc/letsencrypt/\$CERTBOT_TOKEN"' \
        --manual-cleanup-hook '/bin/sh -c "rm -f /etc/letsencrypt/\$CERTBOT_TOKEN"'
}

# Simpler approach: Use HTTP-01 with standalone mode temporarily
obtain_certificates_standalone() {
    log "Using standalone mode for certificate generation..."
    
    mkdir -p "$CERT_DIR"
    
    # Stop nginx temporarily
    info "Stopping nginx temporarily for standalone challenge..."
    docker stop mhylle-nginx
    
    # Get certificate using standalone mode
    docker run --rm \
        -p 80:80 \
        -v "$CERT_DIR:/etc/letsencrypt" \
        certbot/certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --staging \
        -d "$DOMAIN"
    
    if [[ $? -eq 0 ]]; then
        log "Staging certificate successful, getting production certificate..."
        
        # Get production certificate
        docker run --rm \
            -p 80:80 \
            -v "$CERT_DIR:/etc/letsencrypt" \
            certbot/certbot certonly \
            --standalone \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            --force-renewal \
            -d "$DOMAIN"
        
        log "Production certificate obtained"
    else
        error "Staging certificate failed"
        return 1
    fi
    
    # Start nginx again
    info "Restarting nginx..."
    docker start mhylle-nginx
    
    # Wait for nginx to be ready
    sleep 5
}

# Copy certificates to nginx container
copy_certificates_to_nginx() {
    log "Copying certificates to nginx container..."
    
    local source_cert="$CERT_DIR/live/$DOMAIN"
    
    if [[ -d "$source_cert" ]]; then
        docker exec mhylle-nginx mkdir -p /etc/nginx/ssl
        
        # Copy certificates
        docker cp "$source_cert/fullchain.pem" mhylle-nginx:/etc/nginx/ssl/mhylle.com.crt
        docker cp "$source_cert/privkey.pem" mhylle-nginx:/etc/nginx/ssl/mhylle.com.key
        
        # Copy DH parameters from host
        if [[ -f "/tmp/dhparam.pem" ]]; then
            docker cp "/tmp/dhparam.pem" mhylle-nginx:/etc/nginx/ssl/dhparam.pem
        fi
        
        log "Certificates copied successfully"
        return 0
    else
        error "Certificate directory not found: $source_cert"
        return 1
    fi
}

# Enable HTTPS configuration
enable_https() {
    log "Enabling HTTPS configuration..."
    
    # Remove ACME-only config
    docker exec mhylle-nginx rm -f /etc/nginx/conf.d/acme-challenge.conf
    
    # Uncomment HTTPS server block
    docker exec mhylle-nginx sh -c '
        sed -i "/# Main HTTPS server block - DISABLED/,/# }/s/^[[:space:]]*# //" /etc/nginx/nginx.conf &&
        sed -i "s|# return 301 https://\$host\$request_uri;|return 301 https://\$host\$request_uri;|" /etc/nginx/nginx.conf
    '
    
    log "HTTPS configuration enabled"
}

# Test and reload nginx
test_and_reload() {
    log "Testing nginx configuration and reloading..."
    
    if docker exec mhylle-nginx nginx -t; then
        docker exec mhylle-nginx nginx -s reload
        log "Nginx reloaded successfully"
        
        # Test HTTPS
        sleep 5
        if curl -k -s "https://$DOMAIN/" >/dev/null 2>&1; then
            log "HTTPS is working!"
        else
            warning "HTTPS test failed, but certificates may still be working"
        fi
        
        # Show certificate info
        info "Certificate information:"
        echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || true
        
        return 0
    else
        error "Nginx configuration test failed"
        return 1
    fi
}

# Main function
main() {
    log "Starting manual SSL certificate setup for $DOMAIN..."
    
    info "This script will temporarily stop nginx to obtain certificates"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Cancelled by user"
        exit 1
    fi
    
    obtain_certificates_standalone
    copy_certificates_to_nginx
    enable_https
    test_and_reload
    
    log "SSL setup completed!"
    info "Your site is now available at: https://$DOMAIN"
}

main "$@"