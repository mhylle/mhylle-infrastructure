#!/bin/bash
set -e

# SSL Certificate Renewal Setup Script
# This script sets up automatic renewal of Let's Encrypt certificates

DOMAIN="mhylle.com"
SSL_DIR="/opt/mhylle/ssl"
WEBROOT="/var/www/certbot"

echo "🔄 SSL Certificate Renewal Setup for $DOMAIN"
echo "============================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   exit 1
fi

# Create renewal script
RENEWAL_SCRIPT="/opt/mhylle/renew-ssl.sh"
cat > "$RENEWAL_SCRIPT" << 'EOF'
#!/bin/bash
set -e

DOMAIN="mhylle.com"
SSL_DIR="/opt/mhylle/ssl"
WEBROOT="/var/www/certbot"

echo "[$(date)] Starting SSL renewal check..."

# Run certbot renewal
docker run --rm \
    -v "$WEBROOT:/var/www/certbot" \
    -v "$SSL_DIR:/etc/letsencrypt" \
    certbot/certbot renew \
    --webroot \
    --webroot-path /var/www/certbot \
    --quiet

# Check if renewal happened (certificates were updated)
if [[ "$?" -eq 0 ]]; then
    echo "[$(date)] Certificate renewal successful"
    
    # Update symlinks
    ln -sf "$SSL_DIR/live/$DOMAIN/fullchain.pem" "$SSL_DIR/mhylle.com.crt"
    ln -sf "$SSL_DIR/live/$DOMAIN/privkey.pem" "$SSL_DIR/mhylle.com.key"
    
    # Reload nginx if it's running
    if docker ps | grep -q mhylle-nginx; then
        docker exec mhylle-nginx nginx -s reload
        echo "[$(date)] Nginx reloaded"
    fi
else
    echo "[$(date)] No renewal needed"
fi
EOF

# Make renewal script executable
chmod +x "$RENEWAL_SCRIPT"

# Setup cron job for automatic renewal
CRON_JOB="0 0,12 * * * $RENEWAL_SCRIPT >> /var/log/ssl-renewal.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$RENEWAL_SCRIPT"; then
    echo "⚠️  Renewal cron job already exists"
else
    echo "📅 Setting up cron job for automatic renewal..."
    (crontab -l 2>/dev/null || true; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added (runs twice daily at midnight and noon)"
fi

# Create log file with proper permissions
touch /var/log/ssl-renewal.log
chmod 644 /var/log/ssl-renewal.log

# Test renewal (dry run)
echo "🧪 Testing renewal process (dry run)..."
docker run --rm \
    -v "$WEBROOT:/var/www/certbot" \
    -v "$SSL_DIR:/etc/letsencrypt" \
    certbot/certbot renew \
    --webroot \
    --webroot-path /var/www/certbot \
    --dry-run

if [[ "$?" -eq 0 ]]; then
    echo "✅ Renewal test successful!"
    echo ""
    echo "📋 Renewal Configuration:"
    echo "- Renewal script: $RENEWAL_SCRIPT"
    echo "- Log file: /var/log/ssl-renewal.log"
    echo "- Schedule: Twice daily (00:00 and 12:00)"
    echo ""
    echo "📌 To check renewal status:"
    echo "  tail -f /var/log/ssl-renewal.log"
    echo ""
    echo "📌 To manually run renewal:"
    echo "  $RENEWAL_SCRIPT"
else
    echo "⚠️  Renewal test failed. Please check your configuration."
fi