# SSL/HTTPS Setup Documentation

## Overview
This document describes how SSL/HTTPS is configured for mhylle.com using Let's Encrypt certificates and nginx.

## Architecture

### Certificate Storage
- **Host Location**: `/opt/mhylle/ssl/`
- **Container Mount**: `/etc/nginx/ssl/` (read-only)
- **Certificate Files**:
  - `mhylle.com.crt` - Full certificate chain
  - `mhylle.com.key` - Private key
  - `dhparam.pem` - Diffie-Hellman parameters

### Volume Mounts
The nginx container mounts two volumes for SSL:
1. `/var/www/certbot` - For ACME challenge verification (HTTP-01)
2. `/opt/mhylle/ssl` - SSL certificates directory

## Initial Setup

### Prerequisites
1. Domain must be pointing to server IP (51.159.168.239)
2. Nginx container must be running
3. Port 80 must be accessible for ACME challenges

### Generate Certificates
Run the setup script on the server:
```bash
ssh root@51.159.168.239
cd /home/mhylle.com
./scripts/setup-ssl.sh
```

This script will:
1. Generate Let's Encrypt certificates for mhylle.com and www.mhylle.com
2. Create DH parameters for perfect forward secrecy
3. Set up proper symlinks and permissions
4. Reload nginx configuration

### Set Up Automatic Renewal
After initial setup, configure automatic renewal:
```bash
./scripts/setup-ssl-renewal.sh
```

This will:
- Create a renewal script at `/opt/mhylle/renew-ssl.sh`
- Set up a cron job to check renewal twice daily
- Log renewal attempts to `/var/log/ssl-renewal.log`

## Deployment Integration

### GitHub Actions Workflow
The deployment workflow (`deploy-infrastructure.yml`) automatically:
1. Creates the SSL directory if it doesn't exist
2. Mounts the SSL certificates as a read-only volume
3. Enables HTTPS in nginx configuration

### Key Configuration
```yaml
docker run -d \
  --name mhylle-nginx \
  -v /opt/mhylle/ssl:/etc/nginx/ssl:ro \
  -v /var/www/certbot:/var/www/certbot:ro \
  ...
```

## Certificate Renewal

### Automatic Renewal
Certificates are automatically renewed via cron job:
- Runs twice daily (00:00 and 12:00)
- Only renews if certificates are within 30 days of expiry
- Automatically reloads nginx after successful renewal

### Manual Renewal
To manually renew certificates:
```bash
/opt/mhylle/renew-ssl.sh
```

### Check Renewal Status
```bash
# View renewal logs
tail -f /var/log/ssl-renewal.log

# Check certificate expiry
openssl x509 -in /opt/mhylle/ssl/mhylle.com.crt -noout -enddate
```

## Nginx Configuration

### HTTPS Server Block
The HTTPS configuration is in `infrastructure/nginx/nginx.conf`:
```nginx
server {
    listen 443 ssl http2;
    server_name mhylle.com www.mhylle.com;
    
    ssl_certificate /etc/nginx/ssl/mhylle.com.crt;
    ssl_certificate_key /etc/nginx/ssl/mhylle.com.key;
    
    include /etc/nginx/ssl.conf;
    ...
}
```

### SSL Configuration
SSL settings are in `infrastructure/nginx/ssl.conf`:
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS enabled
- OCSP stapling
- Security headers

### HTTP to HTTPS Redirect
All HTTP traffic is automatically redirected to HTTPS:
```nginx
server {
    listen 80;
    location / {
        return 301 https://$host$request_uri;
    }
}
```

## Troubleshooting

### Certificate Not Found
If nginx fails with certificate not found:
1. Check certificates exist: `ls -la /opt/mhylle/ssl/`
2. Verify symlinks: `ls -la /opt/mhylle/ssl/*.crt`
3. Run setup script: `./scripts/setup-ssl.sh`

### HTTPS Not Working After Deployment
1. Ensure SSL directory is mounted in container
2. Check nginx logs: `docker logs mhylle-nginx`
3. Verify certificate paths in nginx.conf

### Renewal Failures
1. Check ACME challenge directory is accessible
2. Verify domain DNS is correct
3. Check renewal logs: `/var/log/ssl-renewal.log`
4. Test with dry run: `certbot renew --dry-run`

## Security Considerations

1. **Private Key Protection**: Key file has 600 permissions
2. **Certificate Chain**: Full chain is used for compatibility
3. **DH Parameters**: 2048-bit for perfect forward secrecy
4. **HSTS**: Strict Transport Security enforced
5. **TLS Versions**: Only TLS 1.2 and 1.3 supported
6. **Cipher Suites**: Strong ciphers only, no weak algorithms

## Important Notes

1. **Do NOT** delete `/opt/mhylle/ssl/` directory on the server
2. **Do NOT** modify certificate files manually
3. **Always** test configuration before deploying
4. Certificates persist across deployments
5. Renewal is handled separately from deployments