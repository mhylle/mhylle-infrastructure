#!/bin/bash
set -e

# SSL Setup Script for mhylle.com
# This script generates Let's Encrypt SSL certificates and configures them for nginx
# It should be run once initially and can be re-run to renew certificates

DOMAIN="mhylle.com"
EMAIL="admin@mhylle.com"  # Update this with your email
SSL_DIR="/opt/mhylle/ssl"
WEBROOT="/var/www/certbot"

echo "🔐 SSL Certificate Setup for $DOMAIN"
echo "======================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p "$SSL_DIR"
mkdir -p "$WEBROOT"

# Check if nginx container is running
if ! docker ps | grep -q mhylle-nginx; then
    echo "❌ Nginx container (mhylle-nginx) is not running"
    echo "Please deploy nginx first using GitHub Actions"
    exit 1
fi

# Check if certificates already exist
if [[ -f "$SSL_DIR/mhylle.com.crt" ]] && [[ -f "$SSL_DIR/mhylle.com.key" ]]; then
    echo "⚠️  SSL certificates already exist at $SSL_DIR"
    read -p "Do you want to renew them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates"
        exit 0
    fi
fi

# Generate Let's Encrypt certificates using Docker
echo "🔄 Generating Let's Encrypt certificates..."
docker run --rm \
    -v "$WEBROOT:/var/www/certbot" \
    -v "$SSL_DIR:/etc/letsencrypt" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --domains "$DOMAIN,www.$DOMAIN" \
    --expand

# Check if certificates were generated
if [[ ! -d "$SSL_DIR/live/$DOMAIN" ]]; then
    echo "❌ Certificate generation failed"
    exit 1
fi

# Create symlinks with standard names
echo "🔗 Creating certificate symlinks..."
ln -sf "$SSL_DIR/live/$DOMAIN/fullchain.pem" "$SSL_DIR/mhylle.com.crt"
ln -sf "$SSL_DIR/live/$DOMAIN/privkey.pem" "$SSL_DIR/mhylle.com.key"

# Generate DH parameters if they don't exist
if [[ ! -f "$SSL_DIR/dhparam.pem" ]]; then
    echo "🔐 Generating DH parameters (this may take a few minutes)..."
    openssl dhparam -out "$SSL_DIR/dhparam.pem" 2048
else
    echo "✅ DH parameters already exist"
fi

# Set proper permissions
echo "🔒 Setting permissions..."
chmod 600 "$SSL_DIR"/*.key 2>/dev/null || true
chmod 644 "$SSL_DIR"/*.crt 2>/dev/null || true
chmod 644 "$SSL_DIR"/*.pem 2>/dev/null || true

# Restart nginx to load new certificates
echo "🔄 Reloading nginx configuration..."
docker exec mhylle-nginx nginx -s reload || {
    echo "⚠️  Failed to reload nginx, restarting container..."
    docker restart mhylle-nginx
}

# Verify HTTPS is working
echo "🔍 Verifying HTTPS setup..."
sleep 3

# Test HTTPS connection
if curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" | grep -q "200\|301\|302\|404"; then
    echo "✅ HTTPS is working!"
    echo ""
    echo "📋 Certificate Information:"
    openssl x509 -in "$SSL_DIR/mhylle.com.crt" -noout -dates
    echo ""
    echo "🎉 SSL setup completed successfully!"
    echo ""
    echo "📌 Next steps:"
    echo "1. Commit and push your changes to trigger deployment"
    echo "2. The deployment will automatically use the SSL certificates"
    echo "3. Set up automatic renewal with: ./scripts/setup-ssl-renewal.sh"
else
    echo "⚠️  HTTPS verification failed, but certificates were generated"
    echo "You may need to redeploy nginx using GitHub Actions"
fi