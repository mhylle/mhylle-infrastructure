# Troubleshooting Guide

## Overview

This guide provides systematic troubleshooting approaches for common issues in the mhylle.com infrastructure.

## Quick Diagnostics

### Health Check Commands

```bash
# Complete system health check
./scripts/health-check.sh

# Check Docker containers
docker ps -a

# Check Docker networks
docker network ls

# Check system resources
df -h && free -h && uptime
```

### Log Access Commands

```bash
# View all infrastructure logs
./scripts/logs.sh

# View nginx logs
docker logs mhylle-nginx

# View database logs
docker logs mhylle-postgres

# View application logs
docker logs app1-frontend
docker logs app1-backend
```

## Common Issues and Solutions

### 1. Service Startup Issues

#### Symptoms
- Containers not starting
- Services exiting immediately
- Health checks failing

#### Diagnosis
```bash
# Check container status
docker ps -a

# Check exit codes
docker inspect container-name | grep ExitCode

# Check startup logs
docker logs container-name
```

#### Common Causes and Solutions

**Port conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# Solution: Change port in docker-compose.yml or stop conflicting service
sudo systemctl stop apache2  # If Apache is running
```

**Permission issues:**
```bash
# Check file permissions
ls -la infrastructure/nginx/
ls -la infrastructure/ssl/

# Fix permissions
sudo chown -R mhylle:mhylle infrastructure/
chmod +x scripts/*.sh
```

**Configuration errors:**
```bash
# Test nginx configuration
docker exec mhylle-nginx nginx -t

# Validate docker-compose syntax
docker-compose config

# Check environment variables
docker-compose config | grep -A 10 -B 10 environment
```

### 2. Network Connectivity Issues

#### Symptoms
- Cannot reach applications
- Intermittent connectivity
- DNS resolution failures

#### Diagnosis
```bash
# Test connectivity from server
curl -I http://localhost/health
curl -I https://mhylle.com/health

# Test DNS resolution
nslookup mhylle.com
dig mhylle.com

# Check firewall
sudo ufw status
```

#### Solutions

**Firewall blocking traffic:**
```bash
# Check current rules
sudo ufw status numbered

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Reload firewall
sudo ufw reload
```

**Docker network issues:**
```bash
# Recreate networks
docker network prune
docker-compose down
docker-compose up -d

# Check network connectivity between containers
docker exec mhylle-nginx ping mhylle-postgres
docker exec app1-backend ping mhylle-postgres
```

**DNS configuration:**
```bash
# Check domain DNS settings
dig mhylle.com
dig www.mhylle.com

# Test from external location
curl -I https://mhylle.com/health
```

### 3. SSL/TLS Certificate Issues

#### Symptoms
- SSL certificate warnings
- Mixed content errors
- Certificate expiration notices

#### Diagnosis
```bash
# Check certificate details
openssl x509 -in infrastructure/ssl/mhylle.com.crt -text -noout

# Check certificate expiration
openssl x509 -in infrastructure/ssl/mhylle.com.crt -noout -enddate

# Test SSL connection
openssl s_client -connect mhylle.com:443 -servername mhylle.com
```

#### Solutions

**Certificate expired:**
```bash
# Force certificate renewal
sudo ./scripts/renew-ssl.sh

# Check renewal status
sudo certbot certificates
```

**Certificate path issues:**
```bash
# Verify certificate files exist
ls -la infrastructure/ssl/
ls -la /etc/letsencrypt/live/mhylle.com/

# Update certificate paths in nginx configuration
sudo nano infrastructure/nginx/nginx.conf
```

**Let's Encrypt challenges failing:**
```bash
# Check webroot permissions
ls -la /var/www/certbot/

# Create webroot directory
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot

# Test challenge manually
sudo certbot certonly --webroot -w /var/www/certbot -d mhylle.com --dry-run
```

### 4. Database Connection Issues

#### Symptoms
- Applications cannot connect to database
- Database queries failing
- Connection timeouts

#### Diagnosis
```bash
# Test database connection
docker exec mhylle-postgres pg_isready -U mhylle_user

# Check database logs
docker logs mhylle-postgres

# Test connection from application
docker exec app1-backend psql -h mhylle-postgres -U mhylle_user -d app1_db -c "SELECT 1;"
```

#### Solutions

**Database not responding:**
```bash
# Restart database
docker restart mhylle-postgres

# Check database process
docker exec mhylle-postgres ps aux | grep postgres
```

**Connection limit reached:**
```bash
# Check current connections
docker exec mhylle-postgres psql -U mhylle_user -d mhylle_main -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker exec mhylle-postgres psql -U mhylle_user -d mhylle_main -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '5 minutes';"
```

**Database corruption:**
```bash
# Check database integrity
docker exec mhylle-postgres pg_dump -U mhylle_user app1_db > /dev/null

# Restore from backup if needed
./scripts/restore-db.sh /path/to/backup.sql
```

### 5. Application-Specific Issues

#### Frontend Issues

**Symptoms:**
- White screen/blank page
- 404 errors on refresh
- Static assets not loading

**Diagnosis:**
```bash
# Check frontend container logs
docker logs app1-frontend

# Test static file serving
curl -I https://mhylle.com/app1/

# Check nginx configuration
docker exec mhylle-nginx nginx -t
```

**Solutions:**
```bash
# Rebuild frontend with correct base href
# In frontend Dockerfile:
RUN ng build --prod --base-href=/app1/

# Fix nginx configuration for Angular routing
# In apps/app1.conf:
location /app1/ {
    try_files $uri $uri/ /app1/index.html;
}
```

#### Backend API Issues

**Symptoms:**
- API endpoints returning 502/503
- Database connection errors
- Authentication failures

**Diagnosis:**
```bash
# Check backend container logs
docker logs app1-backend

# Test API endpoints
curl -I https://mhylle.com/api/app1/health

# Check environment variables
docker exec app1-backend env | grep -E "(DATABASE|JWT|API)"
```

**Solutions:**
```bash
# Update backend configuration for subpath
# In NestJS main.ts:
app.setGlobalPrefix('api/app1');

# Fix CORS configuration
app.enableCors({
  origin: 'https://mhylle.com',
  credentials: true,
});
```

### 6. Performance Issues

#### High Memory Usage

**Diagnosis:**
```bash
# Check container memory usage
docker stats --no-stream

# Check system memory
free -h
cat /proc/meminfo

# Check for memory leaks
docker exec container-name ps aux --sort=-%mem
```

**Solutions:**
```bash
# Limit container memory
# In docker-compose.yml:
services:
  app1-backend:
    deploy:
      resources:
        limits:
          memory: 512M

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### High CPU Usage

**Diagnosis:**
```bash
# Check container CPU usage
docker stats --no-stream

# Check system load
uptime
top -c

# Check nginx access patterns
tail -f logs/nginx/access.log | grep -v "GET /health"
```

**Solutions:**
```bash
# Optimize nginx worker processes
# In nginx.conf:
worker_processes auto;
worker_connections 1024;

# Enable nginx caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### Slow Response Times

**Diagnosis:**
```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://mhylle.com/app1/

# Create curl-format.txt:
echo 'time_namelookup:    %{time_namelookup}\ntime_connect:       %{time_connect}\ntime_appconnect:    %{time_appconnect}\ntime_pretransfer:   %{time_pretransfer}\ntime_redirect:      %{time_redirect}\ntime_starttransfer: %{time_starttransfer}\ntime_total:         %{time_total}\n' > curl-format.txt

# Check database query performance
docker exec mhylle-postgres psql -U mhylle_user -d app1_db -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Solutions:**
```bash
# Enable nginx compression
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# Optimize database queries
# Add indexes for frequently queried columns
docker exec mhylle-postgres psql -U mhylle_user -d app1_db -c "CREATE INDEX CONCURRENTLY idx_user_email ON users(email);"
```

## Recovery Procedures

### Application Recovery

#### Rolling Back Deployments
```bash
# Rollback to previous version
./scripts/rollback-app.sh app1

# Or manually:
docker tag app1-backend:current app1-backend:rollback
docker tag app1-backend:previous app1-backend:current
docker-compose -f applications/app1/docker-compose.yml up -d backend
```

#### Restarting Services
```bash
# Restart specific application
docker-compose -f applications/app1/docker-compose.yml restart

# Restart with fresh containers
docker-compose -f applications/app1/docker-compose.yml down
docker-compose -f applications/app1/docker-compose.yml up -d
```

### Infrastructure Recovery

#### Complete Infrastructure Restart
```bash
# Stop all services
docker-compose down

# Remove problematic containers
docker container prune

# Restart infrastructure
docker-compose up -d

# Verify services
./scripts/health-check.sh
```

#### Database Recovery
```bash
# Stop applications using database
./scripts/stop-all-apps.sh

# Backup current database
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh /path/to/backup.sql

# Restart applications
./scripts/start-all-apps.sh
```

### Data Recovery

#### Recovering Lost Data
```bash
# Check available backups
ls -la backups/database/
ls -la backups/applications/

# Restore from specific backup
./scripts/restore-db.sh backups/database/backup_2023-12-25_03-00-01.sql

# Verify data integrity
docker exec mhylle-postgres psql -U mhylle_user -d app1_db -c "SELECT COUNT(*) FROM users;"
```

## Monitoring and Alerting

### Setting Up Monitoring

#### Basic Health Monitoring
```bash
# Create monitoring script
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash
while true; do
    if ! ./scripts/health-check.sh >/dev/null 2>&1; then
        echo "Health check failed at $(date)" | tee -a logs/monitoring.log
        # Add notification logic here
    fi
    sleep 300  # Check every 5 minutes
done
EOF

chmod +x scripts/monitor.sh
```

#### Log Monitoring
```bash
# Monitor error logs
tail -f logs/nginx/error.log | grep -i error

# Monitor application errors
docker logs -f app1-backend | grep -i error

# Set up log rotation
sudo nano /etc/logrotate.d/docker-containers
```

### Performance Monitoring

#### Resource Usage Tracking
```bash
# Create resource monitoring script
cat > scripts/resource-monitor.sh << 'EOF'
#!/bin/bash
echo "$(date): $(free -m | grep Mem | awk '{print "Memory: " $3"/"$2"MB"}'), $(uptime | awk '{print "Load: " $10 $11 $12}')" >> logs/resources.log
EOF

# Run via cron every minute
echo "* * * * * /home/mhylle/projects/mhylle.com/scripts/resource-monitor.sh" | crontab -
```

## Prevention Strategies

### Regular Maintenance

#### Automated Cleanup
```bash
# Add to crontab for weekly cleanup
0 2 * * 0 docker system prune -f
0 3 * * 0 find /var/log -name "*.log" -mtime +30 -delete
```

#### Security Updates
```bash
# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Configuration Validation

#### Pre-deployment Checks
```bash
# Create validation script
cat > scripts/validate-config.sh << 'EOF'
#!/bin/bash
set -e

echo "Validating configuration..."

# Test nginx configuration
docker run --rm -v $(pwd)/infrastructure/nginx:/etc/nginx:ro nginx nginx -t

# Validate docker-compose files
docker-compose config >/dev/null

# Test database connection
# Add other validation checks...

echo "Configuration validation passed!"
EOF
```

This troubleshooting guide provides systematic approaches to diagnosing and resolving common issues in the infrastructure, helping maintain system reliability and performance.
