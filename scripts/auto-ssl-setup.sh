#!/bin/bash
set -e

# Automated SSL Setup Script - Can be called from GitHub Actions
# Checks if certificates exist and generates them if needed

DOMAIN="mhylle.com"
EMAIL="admin@mhylle.com"  # Update this with your email
SSL_DIR="/opt/mhylle/ssl"
WEBROOT="/var/www/certbot"

echo "🔍 Checking SSL certificate status for $DOMAIN"
echo "=============================================="

# Create necessary directories
mkdir -p "$SSL_DIR"
mkdir -p "$WEBROOT"

# Check if certificates exist and are valid
CERT_VALID=false
if [[ -f "$SSL_DIR/mhylle.com.crt" ]]; then
    # Check if certificate is valid for more than 7 days
    if openssl x509 -in "$SSL_DIR/mhylle.com.crt" -noout -checkend 604800 >/dev/null 2>&1; then
        CERT_VALID=true
        echo "✅ Valid SSL certificates found (valid for >7 days)"
        
        # Check if HTTPS is already enabled in nginx config
        if docker exec mhylle-nginx nginx -T 2>/dev/null | grep -q "listen 443 ssl"; then
            echo "✅ HTTPS configuration already enabled"
            echo "🎉 SSL setup is complete - no action needed"
            exit 0
        else
            echo "⚠️  Certificates exist but HTTPS not enabled - enabling now..."
        fi
    else
        echo "⚠️  Certificate exists but expires within 7 days - renewing..."
    fi
else
    echo "❌ No SSL certificates found - generating new ones..."
fi

# Check if nginx container is running
if ! docker ps | grep -q mhylle-nginx; then
    echo "❌ Nginx container (mhylle-nginx) is not running"
    echo "Please ensure nginx is deployed first"
    exit 1
fi

# Generate or renew certificates if needed
if [[ "$CERT_VALID" != "true" ]]; then
    echo "🔄 Generating/renewing Let's Encrypt certificates..."
    
    # Run certbot
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
        --expand || {
        echo "❌ Certificate generation failed"
        echo "Common issues:"
        echo "1. Domain not pointing to this server"
        echo "2. Port 80 not accessible"
        echo "3. Nginx not serving ACME challenges"
        exit 1
    }

    # Create symlinks
    echo "🔗 Creating certificate symlinks..."
    ln -sf "$SSL_DIR/live/$DOMAIN/fullchain.pem" "$SSL_DIR/mhylle.com.crt"
    ln -sf "$SSL_DIR/live/$DOMAIN/privkey.pem" "$SSL_DIR/mhylle.com.key"

    # Generate DH parameters if they don't exist
    if [[ ! -f "$SSL_DIR/dhparam.pem" ]]; then
        echo "🔐 Generating DH parameters..."
        openssl dhparam -out "$SSL_DIR/dhparam.pem" 2048
    fi

    # Set permissions
    chmod 600 "$SSL_DIR"/*.key 2>/dev/null || true
    chmod 644 "$SSL_DIR"/*.crt 2>/dev/null || true
    chmod 644 "$SSL_DIR"/*.pem 2>/dev/null || true
    
    echo "✅ Certificates generated successfully"
fi

# Enable HTTPS configuration if not already enabled
if ! docker exec mhylle-nginx nginx -T 2>/dev/null | grep -q "listen 443 ssl"; then
    echo "🔧 Enabling HTTPS configuration..."
    
    # Navigate to project directory
    cd /home/mhylle.com 2>/dev/null || cd /tmp
    
    # Download current nginx config if we're not in project directory
    if [[ ! -f "infrastructure/nginx/nginx.conf" ]]; then
        echo "📥 Downloading current nginx configuration..."
        mkdir -p infrastructure/nginx
        docker exec mhylle-nginx cat /etc/nginx/nginx.conf > infrastructure/nginx/nginx.conf
        docker exec mhylle-nginx cat /etc/nginx/ssl.conf > infrastructure/nginx/ssl.conf
        mkdir -p infrastructure/nginx/apps
    fi
    
    # Enable HTTPS server block
    sed -i '/# Main HTTPS server block/,/# }/s/^# *//' infrastructure/nginx/nginx.conf
    sed -i 's|# return 301 https://\$host\$request_uri;|return 301 https://\$host\$request_uri;|' infrastructure/nginx/nginx.conf
    sed -i 's|return 404;|# return 404;|' infrastructure/nginx/nginx.conf

    # Rebuild nginx with SSL configuration
    echo "🔄 Updating nginx with SSL configuration..."
    docker build -t mhylle-nginx-ssl infrastructure/nginx/
    
    # Replace container
    docker stop mhylle-nginx
    docker rm mhylle-nginx
    
    docker run -d \
        --name mhylle-nginx \
        --restart unless-stopped \
        --network mhylle_app-network \
        -p 80:80 \
        -p 443:443 \
        -v /var/www/certbot:/var/www/certbot:ro \
        -v /opt/mhylle/ssl:/etc/nginx/ssl:ro \
        mhylle-nginx-ssl
    
    echo "✅ HTTPS configuration enabled"
fi

# Wait for nginx to be healthy
echo "⏳ Waiting for nginx to be healthy..."
for i in {1..15}; do
    if docker exec mhylle-nginx nginx -t >/dev/null 2>&1; then
        echo "✅ Nginx configuration is valid"
        break
    fi
    echo "Waiting... ($i/15)"
    sleep 2
done

# Verify HTTPS is working
echo "🔍 Verifying HTTPS setup..."
sleep 3

if curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" | grep -q "200\|301\|302\|404"; then
    echo "✅ HTTPS is working!"
    echo ""
    echo "📋 Certificate Information:"
    openssl x509 -in "$SSL_DIR/mhylle.com.crt" -noout -dates
    echo ""
    echo "🎉 SSL setup completed successfully!"
    
    # Set up renewal if not already configured
    if ! crontab -l 2>/dev/null | grep -q "/opt/mhylle/renew-ssl.sh"; then
        echo "📅 Setting up automatic renewal..."
        ./scripts/setup-ssl-renewal.sh >/dev/null 2>&1 || true
    fi
else
    echo "⚠️  HTTPS verification failed"
    echo "Nginx may still be starting up - please check manually"
fi