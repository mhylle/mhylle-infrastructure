# 🚀 Multi-Application Deployment Guide

Complete guide for deploying the mhylle.com infrastructure with multiple applications using the GitHub repositories.

## 📋 Repository Overview

The mhylle.com platform is split into three repositories for optimal organization and independent development:

| Repository | Purpose | URL |
|------------|---------|-----|
| **mhylle-infrastructure** | Core infrastructure, nginx, scripts, monitoring | https://github.com/mhylle/mhylle-infrastructure |
| **mhylle-app1** | User Management Application | https://github.com/mhylle/mhylle-app1 |
| **mhylle-app2** | Task Management Application | https://github.com/mhylle/mhylle-app2 |

## 🏗️ Infrastructure Setup

### 1. Clone and Deploy Infrastructure

```bash
# Clone infrastructure repository
git clone https://github.com/mhylle/mhylle-infrastructure.git
cd mhylle-infrastructure

# Copy environment configuration
cp .env.example .env
# Edit .env with your actual values

# Run initial setup
chmod +x scripts/*.sh
./scripts/setup.sh

# Setup SSL certificates
./scripts/setup-letsencrypt.sh mhylle.com

# Start core infrastructure
docker-compose up -d
```

### 2. Verify Infrastructure

```bash
# Check all services are running
docker ps

# Verify nginx configuration
docker exec mhylle-nginx nginx -t

# Check SSL certificates
./scripts/health-check.sh infrastructure
```

## 🎯 Application Deployment

### Option A: Automated Deployment (Recommended)

#### Setup GitHub Secrets

For each application repository (app1 and app2), configure these secrets:

```bash
SERVER_HOST=your-server-ip-address
SERVER_USER=mhylle
SERVER_SSH_KEY=your-private-ssh-key
SERVER_PORT=22
```

#### Deploy Applications

1. **Fork/Clone the application repositories**:
   ```bash
   gh repo fork mhylle/mhylle-app1
   gh repo fork mhylle/mhylle-app2
   ```

2. **Push to main branch** - GitHub Actions will automatically:
   - Run tests and linting
   - Build Docker images
   - Push to GitHub Container Registry
   - Deploy to your server
   - Run health checks

#### Deployment Process

```bash
# App1 deployment
git clone https://github.com/YOUR_USERNAME/mhylle-app1.git
cd mhylle-app1
# Make your changes
git add .
git commit -m "Deploy app1"
git push origin main
# GitHub Actions handles the rest

# App2 deployment  
git clone https://github.com/YOUR_USERNAME/mhylle-app2.git
cd mhylle-app2
# Make your changes
git add .
git commit -m "Deploy app2"
git push origin main
# GitHub Actions handles the rest
```

### Option B: Manual Deployment

```bash
# On your server, in the infrastructure directory
cd /path/to/mhylle-infrastructure

# Deploy app1
./scripts/deploy-app.sh app1 \
  ghcr.io/YOUR_USERNAME/mhylle-app1-frontend:latest \
  ghcr.io/YOUR_USERNAME/mhylle-app1-backend:latest

# Deploy app2
./scripts/deploy-app.sh app2 \
  ghcr.io/YOUR_USERNAME/mhylle-app2-frontend:latest \
  ghcr.io/YOUR_USERNAME/mhylle-app2-backend:latest

# Verify deployments
./scripts/health-check.sh app1
./scripts/health-check.sh app2
```

## 🗄️ Database Setup

### Create Application Databases

```bash
# Connect to PostgreSQL
docker exec -it mhylle-postgres psql -U mhylle_user -d mhylle_main

# Create databases for each application
CREATE DATABASE app1_db;
CREATE DATABASE app2_db;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE app1_db TO mhylle_user;
GRANT ALL PRIVILEGES ON DATABASE app2_db TO mhylle_user;

# Exit PostgreSQL
\q
```

### Run Database Migrations

```bash
# App1 migrations
docker exec app1-backend npm run migration:run

# App2 migrations  
docker exec app2-backend npm run migration:run
```

## 🔧 Configuration Management

### Environment Variables

Update the `.env` file in your infrastructure:

```bash
# Database Configuration
POSTGRES_USER=mhylle_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=mhylle_main

# SSL Configuration
SSL_EMAIL=your@email.com
DOMAIN=mhylle.com

# Application Configuration
APP1_DB_NAME=app1_db
APP2_DB_NAME=app2_db

# GitHub Container Registry (if using private repos)
GHCR_USERNAME=your_github_username
GHCR_TOKEN=your_github_token
```

### Application-Specific Configuration

Each application has its own `.env.example` file. Copy and configure:

```bash
# For app1
cp mhylle-app1/.env.example mhylle-app1/.env

# For app2  
cp mhylle-app2/.env.example mhylle-app2/.env
```

## 🌐 Access Applications

After successful deployment:

| Service | URL | Description |
|---------|-----|-------------|
| **App1 Frontend** | https://mhylle.com/app1/ | User Management Interface |
| **App1 API** | https://mhylle.com/api/app1/ | User Management API |
| **App1 API Docs** | https://mhylle.com/api/app1/docs | Swagger Documentation |
| **App2 Frontend** | https://mhylle.com/app2/ | Task Management Interface |
| **App2 API** | https://mhylle.com/api/app2/ | Task Management API |
| **App2 API Docs** | https://mhylle.com/api/app2/docs | Swagger Documentation |

## 🔍 Monitoring & Health Checks

### Automated Health Monitoring

```bash
# Check all applications
./scripts/health-check.sh all

# Check specific application
./scripts/health-check.sh app1
./scripts/health-check.sh app2

# Check infrastructure
./scripts/health-check.sh infrastructure
```

### Manual Health Checks

```bash
# Test application endpoints
curl -I https://mhylle.com/app1/
curl -I https://mhylle.com/app2/

# Test API endpoints
curl -I https://mhylle.com/api/app1/health
curl -I https://mhylle.com/api/app2/health

# Check container status
docker ps | grep -E "(app1|app2)"

# View application logs
./scripts/logs.sh app1
./scripts/logs.sh app2
```

## 🔄 Development Workflow

### Local Development

1. **Clone application repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mhylle-app1.git
   cd mhylle-app1
   ```

2. **Setup local environment**:
   ```bash
   cp .env.example .env
   # Edit .env for local development
   
   # Install dependencies
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. **Run locally**:
   ```bash
   # Start frontend (http://localhost:4200/app1/)
   cd frontend && npm run start
   
   # Start backend (http://localhost:3000/api/app1/)
   cd backend && npm run start:dev
   ```

4. **Test with Docker**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

### Production Deployment

1. **Commit changes**:
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin main
   ```

2. **Monitor deployment**:
   - Check GitHub Actions workflow
   - Monitor application logs
   - Verify health endpoints

## 🚨 Troubleshooting

### Common Issues

#### Application Not Starting
```bash
# Check container logs
docker logs app1-frontend
docker logs app1-backend
docker logs app2-frontend  
docker logs app2-backend

# Check container status
docker ps -a | grep -E "(app1|app2)"

# Restart applications
./scripts/deploy-app.sh app1 \
  ghcr.io/YOUR_USERNAME/mhylle-app1-frontend:latest \
  ghcr.io/YOUR_USERNAME/mhylle-app1-backend:latest
```

#### Database Connection Issues
```bash
# Test database connectivity
docker exec app1-backend npm run typeorm query "SELECT NOW()"
docker exec app2-backend npm run typeorm query "SELECT NOW()"

# Check database exists
docker exec -it mhylle-postgres psql -U mhylle_user -c "\l"
```

#### SSL Certificate Issues
```bash
# Renew certificates
./scripts/renew-ssl.sh

# Check certificate status
docker exec mhylle-nginx nginx -t
```

#### GitHub Actions Failures
1. Check repository secrets are set correctly
2. Verify SSH key has proper permissions
3. Check server accessibility
4. Review workflow logs in GitHub

### Recovery Procedures

#### Rollback Application
```bash
# Rollback to previous version
./scripts/rollback-app.sh app1
./scripts/rollback-app.sh app2
```

#### Reset Application
```bash
# Stop and remove containers
docker-compose down

# Remove application containers specifically
docker rm -f app1-frontend app1-backend
docker rm -f app2-frontend app2-backend

# Redeploy
./scripts/deploy-app.sh app1 [images...]
./scripts/deploy-app.sh app2 [images...]
```

## 📊 Performance Optimization

### Docker Image Optimization
- Multi-stage builds reduce image size
- Layer caching improves build times
- Health checks ensure container readiness

### Application Performance
- Angular lazy loading for frontend modules
- NestJS caching for backend responses
- Database indexing for query optimization
- Nginx compression and caching

### Infrastructure Performance
- HTTP/2 enabled by default
- Static asset caching
- Connection pooling
- Resource limits configured

## 🔒 Security Considerations

### Application Security
- JWT authentication with secure secrets
- CORS configuration for API access
- Input validation and sanitization
- SQL injection prevention with TypeORM

### Infrastructure Security
- HTTPS-only communication
- Security headers via nginx
- Container isolation
- Non-root user execution
- Regular security updates

### GitHub Security
- Repository secrets for sensitive data
- GHCR for private container images
- Workflow permissions minimization
- Signed commits (recommended)

## 📈 Scaling Applications

### Adding New Applications

1. **Create new repository** following the app1/app2 pattern
2. **Configure nginx routing** in infrastructure
3. **Setup database** for new application
4. **Configure GitHub Actions** for deployment
5. **Update monitoring scripts**

### Horizontal Scaling

```bash
# Scale application containers
docker-compose up -d --scale app1-backend=3 --scale app2-backend=2

# Update nginx load balancing configuration
# Edit infrastructure/nginx/apps/app*.conf
```

## 🎯 Best Practices

### Repository Management
- Keep infrastructure separate from applications
- Use semantic versioning for releases
- Maintain comprehensive documentation
- Regular dependency updates

### Deployment Practices
- Always test locally before deploying
- Use feature branches for development
- Monitor deployment health
- Maintain rollback procedures

### Security Practices
- Regular security audits
- Keep dependencies updated
- Use environment variables for secrets
- Enable monitoring and alerting

---

## 🆘 Support Resources

- **Infrastructure Documentation**: https://github.com/mhylle/mhylle-infrastructure
- **App1 Documentation**: https://github.com/mhylle/mhylle-app1
- **App2 Documentation**: https://github.com/mhylle/mhylle-app2
- **Health Check Endpoints**: 
  - https://mhylle.com/api/app1/health
  - https://mhylle.com/api/app2/health

For issues:
1. Check application logs: `./scripts/logs.sh [app_name]`
2. Run health checks: `./scripts/health-check.sh [app_name]`
3. Review GitHub Actions workflows
4. Check repository documentation

---

**🎉 Your multi-application platform is ready for production!**
