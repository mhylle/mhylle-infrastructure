#!/bin/bash

# SSL Certificate Renewal Automation Script
# Runs via cron to renew Let's Encrypt certificates
# Usage: ./renew-ssl.sh

set -e

# Configuration
DOMAIN="mhylle.com"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
INFRA_SSL_DIR="/home/mhylle/infrastructure/ssl"
LOG_FILE="/var/log/certbot-renewal.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"; }

# Function to check certificate expiration
check_certificate_expiry() {
    if [[ ! -f "$INFRA_SSL_DIR/$DOMAIN.crt" ]]; then
        echo "30" # Force renewal if cert doesn't exist
        return
    fi
    
    local expiry_date=$(openssl x509 -in "$INFRA_SSL_DIR/$DOMAIN.crt" -noout -enddate | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "$days_until_expiry"
}

# Function to backup current certificates
backup_certificates() {
    log "Backing up current certificates..."
    
    local backup_dir="/home/mhylle/infrastructure/ssl/backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    if [[ -f "$INFRA_SSL_DIR/$DOMAIN.crt" ]]; then
        cp "$INFRA_SSL_DIR/$DOMAIN.crt" "$backup_dir/"
        cp "$INFRA_SSL_DIR/$DOMAIN.key" "$backup_dir/"
        log "Certificates backed up to $backup_dir"
    fi
}

# Function to renew certificates
renew_certificates() {
    log "Attempting to renew SSL certificates..."
    
    # Run certbot renewal
    if certbot renew --quiet --no-self-upgrade; then
        log "Certificate renewal successful"
        return 0
    else
        error "Certificate renewal failed"
        return 1
    fi
}

# Function to update infrastructure certificates
update_infrastructure_certificates() {
    log "Updating infrastructure certificates..."
    
    if [[ -d "$CERT_DIR" ]]; then
        # Copy new certificates
        cp "$CERT_DIR/fullchain.pem" "$INFRA_SSL_DIR/$DOMAIN.crt"
        cp "$CERT_DIR/privkey.pem" "$INFRA_SSL_DIR/$DOMAIN.key"
        
        # Set proper permissions
        chown mhylle:mhylle "$INFRA_SSL_DIR"/*
        chmod 644 "$INFRA_SSL_DIR/$DOMAIN.crt"
        chmod 600 "$INFRA_SSL_DIR/$DOMAIN.key"
        
        log "Infrastructure certificates updated"
        return 0
    else
        error "Certificate directory not found: $CERT_DIR"
        return 1
    fi
}

# Function to reload nginx
reload_nginx() {
    log "Reloading Nginx configuration..."
    
    # Test configuration first
    if docker exec mhylle-nginx nginx -t; then
        docker exec mhylle-nginx nginx -s reload
        log "Nginx reloaded successfully"
        return 0
    else
        error "Nginx configuration test failed"
        return 1
    fi
}

# Function to verify new certificates
verify_certificates() {
    log "Verifying new certificates..."
    
    # Check certificate validity
    local expiry_date=$(openssl x509 -in "$INFRA_SSL_DIR/$DOMAIN.crt" -noout -enddate | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [[ $days_until_expiry -gt 30 ]]; then
        log "Certificate verification successful (expires in $days_until_expiry days)"
        return 0
    else
        error "Certificate verification failed (expires in $days_until_expiry days)"
        return 1
    fi
}

# Function to send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Log to system
    if [[ "$status" == "success" ]]; then
        log "Renewal notification: $message"
    else
        error "Renewal notification: $message"
    fi
    
    # Could be extended to send email/slack notifications
    # Example: curl -X POST "$WEBHOOK_URL" -d "{'text': '$message'}"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old certificate backups..."
    
    local backup_base="/home/mhylle/infrastructure/ssl/backup"
    
    if [[ -d "$backup_base" ]]; then
        # Keep only last 10 backups
        find "$backup_base" -type d -name "20*" | sort | head -n -10 | xargs -r rm -rf
        log "Old backups cleaned up"
    fi
}

# Main renewal function
main() {
    log "Starting SSL certificate renewal check..."
    
    # Check if renewal is needed
    local days_until_expiry=$(check_certificate_expiry)
    
    if [[ $days_until_expiry -gt 30 ]]; then
        log "Certificate is still valid for $days_until_expiry days, no renewal needed"
        exit 0
    fi
    
    log "Certificate expires in $days_until_expiry days, attempting renewal..."
    
    # Backup current certificates
    backup_certificates
    
    # Attempt renewal
    if renew_certificates; then
        # Update infrastructure certificates
        if update_infrastructure_certificates; then
            # Reload nginx
            if reload_nginx; then
                # Verify new certificates
                if verify_certificates; then
                    send_notification "success" "SSL certificates renewed successfully for $DOMAIN"
                    cleanup_old_backups
                    log "SSL certificate renewal completed successfully"
                else
                    error "Certificate verification failed after renewal"
                    send_notification "error" "SSL certificate verification failed for $DOMAIN"
                    exit 1
                fi
            else
                error "Failed to reload Nginx after certificate renewal"
                send_notification "error" "Failed to reload Nginx for $DOMAIN"
                exit 1
            fi
        else
            error "Failed to update infrastructure certificates"
            send_notification "error" "Failed to update infrastructure certificates for $DOMAIN"
            exit 1
        fi
    else
        error "Certificate renewal failed"
        send_notification "error" "SSL certificate renewal failed for $DOMAIN"
        exit 1
    fi
}

# Ensure log file exists
touch "$LOG_FILE"

# Run main function
main "$@"
