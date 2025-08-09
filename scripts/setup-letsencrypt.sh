#!/bin/bash

# Let's Encrypt SSL Certificate Setup Script
# Sets up automated SSL certificates using Certbot
# Usage: ./setup-letsencrypt.sh

set -e

# Configuration
DOMAIN="mhylle.com"
EMAIL="${SSL_EMAIL:-admin@mhylle.com}"
WEBROOT="/var/www/certbot"

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
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        error "Certbot is not installed. Please run the setup.sh script first."
        exit 1
    fi
    
    # Check if domain resolves to server
    local resolved_ip=$(dig +short $DOMAIN)
    if [[ "$resolved_ip" != "51.159.168.239" ]]; then
        warning "Domain $DOMAIN does not resolve to 51.159.168.239 (resolved to: $resolved_ip)"
        warning "Please ensure DNS is configured correctly before proceeding"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create webroot directory
create_webroot() {
    log "Creating webroot directory..."
    sudo mkdir -p $WEBROOT
    sudo chown -R www-data:www-data $WEBROOT
}

# Update nginx for ACME challenge
update_nginx_for_acme() {
    log "Updating Nginx configuration for ACME challenge..."
    
    # Create temporary nginx config that serves ACME challenges
    cat > /tmp/acme-nginx.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root $WEBROOT;
        try_files \$uri =404;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
    
    # Copy to nginx config directory
    sudo cp /tmp/acme-nginx.conf /home/$USER/infrastructure/nginx/apps/acme.conf
    
    # Reload nginx
    docker exec mhylle-nginx nginx -s reload
}

# Obtain SSL certificates
obtain_certificates() {
    log "Obtaining SSL certificates from Let's Encrypt..."
    
    # Stop nginx temporarily if needed
    local nginx_was_running=false
    if systemctl is-active --quiet nginx; then
        nginx_was_running=true
        sudo systemctl stop nginx
    fi
    
    # Request certificates
    sudo certbot certonly \
        --webroot \
        --webroot-path=$WEBROOT \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --staging \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # If staging worked, get real certificates
    if [[ $? -eq 0 ]]; then
        log "Staging certificates obtained successfully, now getting production certificates..."
        
        sudo certbot certonly \
            --webroot \
            --webroot-path=$WEBROOT \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            --force-renewal \
            -d $DOMAIN \
            -d www.$DOMAIN
    fi
    
    # Restart nginx if it was running
    if [[ $nginx_was_running == true ]]; then
        sudo systemctl start nginx
    fi
}

# Copy certificates to infrastructure directory
copy_certificates() {
    log "Copying certificates to infrastructure directory..."
    
    local cert_dir="/etc/letsencrypt/live/$DOMAIN"
    local infra_ssl_dir="/home/$USER/infrastructure/ssl"
    
    if [[ -d "$cert_dir" ]]; then
        sudo cp "$cert_dir/fullchain.pem" "$infra_ssl_dir/$DOMAIN.crt"
        sudo cp "$cert_dir/privkey.pem" "$infra_ssl_dir/$DOMAIN.key"
        
        # Set proper permissions
        sudo chown $USER:$USER "$infra_ssl_dir"/*
        sudo chmod 644 "$infra_ssl_dir/$DOMAIN.crt"
        sudo chmod 600 "$infra_ssl_dir/$DOMAIN.key"
        
        log "Certificates copied successfully"
    else
        error "Certificate directory not found: $cert_dir"
        exit 1
    fi
}

# Setup automatic renewal
setup_auto_renewal() {
    log "Setting up automatic certificate renewal..."
    
    # Create renewal hook script
    cat > /tmp/certbot-renewal-hook.sh << 'EOF'
#!/bin/bash
# Copy renewed certificates to infrastructure directory
DOMAIN="mhylle.com"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
INFRA_SSL_DIR="/home/mhylle/infrastructure/ssl"

if [[ -d "$CERT_DIR" ]]; then
    cp "$CERT_DIR/fullchain.pem" "$INFRA_SSL_DIR/$DOMAIN.crt"
    cp "$CERT_DIR/privkey.pem" "$INFRA_SSL_DIR/$DOMAIN.key"
    
    # Set proper permissions
    chown mhylle:mhylle "$INFRA_SSL_DIR"/*
    chmod 644 "$INFRA_SSL_DIR/$DOMAIN.crt"
    chmod 600 "$INFRA_SSL_DIR/$DOMAIN.key"
    
    # Reload nginx in docker container
    docker exec mhylle-nginx nginx -s reload
fi
EOF
    
    sudo mv /tmp/certbot-renewal-hook.sh /etc/letsencrypt/renewal-hooks/deploy/
    sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/certbot-renewal-hook.sh
    
    # Add cron job for renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    log "Automatic renewal configured"
}

# Update nginx with real SSL configuration
update_nginx_ssl() {
    log "Updating Nginx with SSL configuration..."
    
    # Remove ACME-only config
    rm -f /home/$USER/infrastructure/nginx/apps/acme.conf
    
    # Reload nginx with new certificates
    docker exec mhylle-nginx nginx -s reload
    
    log "Nginx SSL configuration updated"
}

# Test SSL configuration
test_ssl() {
    log "Testing SSL configuration..."
    
    # Wait a moment for nginx to reload
    sleep 5
    
    # Test HTTPS connection
    if curl -f -s "https://$DOMAIN/health" > /dev/null; then
        log "SSL configuration test passed"
    else
        warning "SSL test failed, but certificates may still be working"
    fi
    
    # Check certificate expiration
    local expiry=$(openssl x509 -in "/home/$USER/infrastructure/ssl/$DOMAIN.crt" -noout -enddate | cut -d= -f2)
    info "Certificate expires: $expiry"
}

# Main function
main() {
    log "Setting up Let's Encrypt SSL certificates for $DOMAIN..."
    
    check_prerequisites
    create_webroot
    update_nginx_for_acme
    obtain_certificates
    copy_certificates
    setup_auto_renewal
    update_nginx_ssl
    test_ssl
    
    log "Let's Encrypt SSL setup completed successfully!"
    info "Your site is now available at: https://$DOMAIN"
    info "Certificates will be automatically renewed"
}

# Run main function
main "$@"
