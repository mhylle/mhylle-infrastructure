# Deployment Guide

## Overview

This guide covers the complete deployment process for the mhylle.com infrastructure, from initial server setup to adding new applications.

## Prerequisites

### Server Requirements
- Ubuntu 24.04 LTS server
- Minimum 4GB RAM, 3 CPU cores
- 50GB+ storage
- Public IP address
- Domain name pointing to server

### Required Access
- Root access to server via SSH
- Domain DNS control
- GitHub account for CI/CD

## Initial Infrastructure Setup

### 1. Server Preparation

Connect to your server and clone the infrastructure repository:

```bash
# Connect to server
ssh root@your-server-ip

# Create user account
adduser mhylle
usermod -aG sudo mhylle
su - mhylle

# Clone infrastructure repository
git clone https://github.com/mhylle/mhylle.com.git
cd mhylle.com
```

### 2. DNS Configuration

Set up DNS records for your domain:

```
Type: A
Name: @
Value: your-server-ip
TTL: 300

Type: A  
Name: www
Value: your-server-ip
TTL: 300

Type: CNAME
Name: *
Value: mhylle.com
TTL: 300
```

### 3. Environment Configuration

Create the environment file:

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

Required environment variables:
```bash
# Database Configuration
POSTGRES_DB=mhylle_main
POSTGRES_USER=mhylle_user
POSTGRES_PASSWORD=secure_random_password_here

# Domain Configuration
DOMAIN=mhylle.com
EMAIL=your-email@domain.com

# GitHub Container Registry (for CI/CD)
GHCR_USERNAME=your-github-username
GHCR_TOKEN=your-github-token
```

### 4. Initial Infrastructure Deployment

Run the setup script:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run initial setup
sudo ./scripts/setup.sh
```

This script will:
- Install Docker and Docker Compose
- Configure firewall settings
- Set up SSL certificates with Let's Encrypt
- Start core infrastructure services
- Configure SSL certificate renewal

### 5. Verify Core Infrastructure

Check that all services are running:

```bash
# Check infrastructure status
./scripts/health-check.sh

# Check container status
docker ps

# Test endpoints
curl http://localhost/health
curl https://mhylle.com/health
```

## Application Deployment

### Deploying Your First Application

#### 1. Prepare Application Repository

Your application repository should have this structure:

```
your-app/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
├── backend/
│   ├── Dockerfile
│   └── src/
├── docker-compose.yml
├── .env.example
└── .github/workflows/deploy.yml
```

#### 2. Configure Application Environment

```bash
# In your application repository
cp .env.example .env

# Configure environment variables
nano .env
```

Example application `.env`:
```bash
# Application Configuration
APP_NAME=app1
APP_PORT_FRONTEND=3001
APP_PORT_BACKEND=3101

# Database Configuration (use same as infrastructure)
POSTGRES_HOST=mhylle-postgres
POSTGRES_PORT=5432
POSTGRES_DB=app1_db
POSTGRES_USER=mhylle_user
POSTGRES_PASSWORD=secure_random_password_here

# GitHub Container Registry
GHCR_USERNAME=your-github-username
GHCR_TOKEN=your-github-token
```

#### 3. Set Up CI/CD Pipeline

Configure GitHub Actions secrets in your application repository:
- `GHCR_USERNAME`: Your GitHub username
- `GHCR_TOKEN`: GitHub personal access token with package write permissions
- `SERVER_HOST`: Your server IP
- `SERVER_USER`: mhylle
- `SERVER_SSH_KEY`: Private SSH key for server access

#### 4. Deploy Application

```bash
# On your server, deploy the application
cd /home/mhylle/projects/mhylle.com
./scripts/deploy-app.sh app1 ghcr.io/your-username/your-app:latest
```

#### 5. Configure Nginx Routing

Create application-specific nginx configuration:

```bash
# Create app configuration
sudo nano infrastructure/nginx/apps/app1.conf
```

Example configuration:
```nginx
# Application 1 configuration
upstream app1_frontend {
    server app1-frontend:80;
}

upstream app1_backend {
    server app1-backend:3000;
}

# Frontend routing
location /app1/ {
    proxy_pass http://app1_frontend/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Handle Angular routing
    try_files $uri $uri/ /index.html;
}

# Backend API routing
location /api/app1/ {
    proxy_pass http://app1_backend/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

#### 6. Reload Nginx Configuration

```bash
# Test configuration
docker exec mhylle-nginx nginx -t

# Reload if test passes
docker exec mhylle-nginx nginx -s reload
```

### Automated Deployment via CI/CD

#### GitHub Actions Workflow

Your application's `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push Docker images
        run: |
          echo ${{ secrets.GHCR_TOKEN }} | docker login ghcr.io -u ${{ secrets.GHCR_USERNAME }} --password-stdin
          
          # Build and push frontend
          docker build -t ghcr.io/${{ secrets.GHCR_USERNAME }}/app1-frontend:${{ github.sha }} ./frontend
          docker push ghcr.io/${{ secrets.GHCR_USERNAME }}/app1-frontend:${{ github.sha }}
          
          # Build and push backend
          docker build -t ghcr.io/${{ secrets.GHCR_USERNAME }}/app1-backend:${{ github.sha }} ./backend
          docker push ghcr.io/${{ secrets.GHCR_USERNAME }}/app1-backend:${{ github.sha }}
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /home/mhylle/projects/mhylle.com
            ./scripts/deploy-app.sh app1 ghcr.io/${{ secrets.GHCR_USERNAME }}/app1:${{ github.sha }}
```

## Application Management

### Application Lifecycle

#### Starting Applications
```bash
# Start specific application
docker-compose -f applications/app1/docker-compose.yml up -d

# Start all applications
./scripts/start-all-apps.sh
```

#### Stopping Applications
```bash
# Stop specific application
docker-compose -f applications/app1/docker-compose.yml down

# Stop all applications (keeps infrastructure running)
./scripts/stop-all-apps.sh
```

#### Updating Applications
```bash
# Update to specific version
./scripts/deploy-app.sh app1 ghcr.io/username/app1:v2.1.0

# Update to latest
./scripts/deploy-app.sh app1 ghcr.io/username/app1:latest
```

### Database Management

#### Creating Application Database
```bash
# Connect to PostgreSQL
docker exec -it mhylle-postgres psql -U mhylle_user -d mhylle_main

# Create application database
CREATE DATABASE app1_db;
GRANT ALL PRIVILEGES ON DATABASE app1_db TO mhylle_user;
\q
```

#### Database Migrations
```bash
# Run migrations for specific app
docker exec app1-backend npm run migration:run

# Or connect and run manually
docker exec -it app1-backend /bin/bash
npm run migration:run
```

### Backup and Restore

#### Database Backup
```bash
# Manual backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh /path/to/backup.sql
```

#### Application Data Backup
```bash
# Backup application volumes
docker run --rm -v app1_data:/data -v $(pwd):/backup alpine tar czf /backup/app1_data.tar.gz /data
```

## Monitoring and Maintenance

### Health Monitoring

#### System Health Check
```bash
# Complete health check
./scripts/health-check.sh

# Check specific application
./scripts/health-check.sh app1
```

#### Log Monitoring
```bash
# View all logs
./scripts/logs.sh

# View specific application logs
./scripts/logs.sh app1

# Follow logs in real-time
./scripts/logs.sh app1 --follow
```

### SSL Certificate Management

#### Manual Certificate Renewal
```bash
# Check certificate status
./scripts/check-ssl.sh

# Force renewal
sudo ./scripts/renew-ssl.sh
```

#### Certificate Monitoring
```bash
# Check certificate expiration
openssl x509 -in infrastructure/ssl/mhylle.com.crt -noout -enddate

# Verify certificate chain
openssl verify -CAfile infrastructure/ssl/mhylle.com.crt infrastructure/ssl/mhylle.com.crt
```

## Troubleshooting

### Common Issues

#### Service Not Starting
```bash
# Check service status
docker ps -a

# Check service logs
docker logs container-name

# Check resource usage
docker stats
```

#### Nginx Configuration Issues
```bash
# Test nginx configuration
docker exec mhylle-nginx nginx -t

# Reload configuration
docker exec mhylle-nginx nginx -s reload

# Check nginx logs
docker logs mhylle-nginx
```

#### Database Connection Issues
```bash
# Test database connection
docker exec mhylle-postgres pg_isready -U mhylle_user

# Check database logs
docker logs mhylle-postgres

# Connect to database
docker exec -it mhylle-postgres psql -U mhylle_user -d mhylle_main
```

### Performance Issues

#### High Memory Usage
```bash
# Check container memory usage
docker stats --no-stream

# Check system memory
free -h

# Check for memory leaks
docker exec container-name ps aux
```

#### High CPU Usage
```bash
# Check container CPU usage
docker stats --no-stream

# Check system load
uptime

# Check nginx access patterns
tail -f logs/nginx/access.log
```

### Recovery Procedures

#### Application Recovery
```bash
# Rollback to previous version
./scripts/rollback-app.sh app1

# Restart application
docker-compose -f applications/app1/docker-compose.yml restart
```

#### Infrastructure Recovery
```bash
# Restart core services
docker-compose restart

# Full infrastructure rebuild
docker-compose down
docker-compose up -d
```

## Security Considerations

### Regular Security Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Docker images (handled by Watchtower)
# Update application dependencies in CI/CD
```

### Security Monitoring
```bash
# Check firewall status
sudo ufw status

# Check failed login attempts
sudo grep "Failed password" /var/log/auth.log

# Check Docker security
docker security scan image-name
```

### Access Control
```bash
# Review SSH access
sudo grep "ssh" /var/log/auth.log

# Update SSH keys
ssh-copy-id -i new-key.pub user@server

# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
```

## Scaling Considerations

### Vertical Scaling
```bash
# Increase container resources
# Edit docker-compose.yml:
services:
  app1-backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

### Horizontal Scaling
```bash
# Scale application instances
docker-compose -f applications/app1/docker-compose.yml up -d --scale backend=3

# Update nginx upstream configuration
# Add multiple backend servers
```

This deployment guide provides a comprehensive approach to managing the mhylle.com infrastructure, from initial setup to ongoing maintenance and scaling.
