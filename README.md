# mhylle.com Infrastructure

A complete Docker-based infrastructure solution for hosting multiple independent web applications on a single server with zero-downtime deployments, automated SSL management, and comprehensive monitoring.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/mhylle/mhylle.com.git
cd mhylle.com

# Configure environment
cp .env.example .env
nano .env

# Deploy infrastructure
chmod +x scripts/*.sh
sudo ./scripts/setup.sh

# Verify deployment
./scripts/health-check.sh
```

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Core Services](#core-services)
- [Application Management](#application-management)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This infrastructure provides a production-ready platform for hosting multiple web applications on a single server using:

- **Docker Compose** for container orchestration
- **Nginx** as a reverse proxy with subpath routing
- **PostgreSQL** as a shared database with per-app databases
- **Let's Encrypt** for automated SSL certificate management
- **GitHub Actions** for CI/CD deployment
- **Watchtower** for automated container updates

### Supported Application Stack
- **Frontend**: Angular 19+ with subpath routing
- **Backend**: NestJS 11+ with TypeScript
- **Database**: PostgreSQL 15 with shared instance
- **Deployment**: GitHub Container Registry (GHCR)

## ✨ Features

### Infrastructure Features
- 🔄 **Zero-downtime deployments** with blue-green deployment strategy
- 🔒 **Automated SSL/TLS** certificate management with Let's Encrypt
- 🌐 **Subpath routing** (e.g., `/app1`, `/app2`) for multiple applications
- 📊 **Health monitoring** with comprehensive health checks
- 🔧 **Automated backups** with configurable retention policies
- 🚨 **Error monitoring** and centralized logging
- 🛡️ **Security hardening** with proper headers and rate limiting

### Application Features
- 🏗️ **Standardized structure** for consistent development
- 🚀 **CI/CD pipeline** with GitHub Actions
- 📱 **Multi-container support** (frontend + backend per app)
- 🗄️ **Database isolation** (separate database per application)
- 📈 **Performance optimization** with caching and compression
- 🔍 **Observability** with logging and monitoring

### Operational Features
- 🛠️ **Management scripts** for common operations
- 📚 **Comprehensive documentation** with troubleshooting guides
- 🔄 **Rollback capabilities** for quick recovery
- 📦 **Container auto-updates** with Watchtower
- 🕒 **Scheduled maintenance** with automated tasks

## 💻 System Requirements

### Server Specifications
- **OS**: Ubuntu 24.04 LTS
- **RAM**: Minimum 4GB (8GB recommended)
- **CPU**: 3+ cores
- **Storage**: 50GB+ SSD
- **Network**: Public IP with domain name

### Software Dependencies
- Docker Engine 24.0+
- Docker Compose v2.0+
- Git
- Nginx (containerized)
- PostgreSQL 15 (containerized)

### External Services
- GitHub account for CI/CD and container registry
- Domain name with DNS control
- Email address for Let's Encrypt certificates
## 🏗️ Architecture

The infrastructure uses a microservices architecture with shared core services:

```
┌─────────────────────────────────────────────────────────┐
│                     Internet (HTTPS)                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               Nginx Reverse Proxy                       │
│           (SSL Termination, Rate Limiting)              │
└─┬───────────────────┬───────────────────┬──────────────┘
  │                   │                   │
  ▼                   ▼                   ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│    App 1    │ │    App 2    │ │    App N...     │
│ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────────┐ │
│ │Frontend │ │ │ │Frontend │ │ │ │ Frontend    │ │
│ │(Angular)│ │ │ │(Angular)│ │ │ │ (Angular)   │ │
│ └─────────┘ │ │ └─────────┘ │ │ └─────────────┘ │
│ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────────┐ │
│ │Backend  │ │ │ │Backend  │ │ │ │ Backend     │ │
│ │(NestJS) │ │ │ │(NestJS) │ │ │ │ (NestJS)    │ │
│ └─────────┘ │ │ └─────────┘ │ │ └─────────────┘ │
└─┬───────────┘ └─┬───────────┘ └─┬───────────────┘
  │               │               │
  └───────────────┼───────────────┘
                  │
    ┌─────────────▼─────────────┐
    │     PostgreSQL Server     │
    │   ┌─────┐ ┌─────┐ ┌─────┐ │
    │   │app1 │ │app2 │ │appN │ │
    │   │ _db │ │ _db │ │ _db │ │
    │   └─────┘ └─────┘ └─────┘ │
    └───────────────────────────┘
```

### Routing Strategy
- **Frontend**: `https://mhylle.com/app1/` → Application 1 Frontend
- **Backend**: `https://mhylle.com/api/app1/` → Application 1 API
- **Database**: Shared PostgreSQL with isolated databases per app

## 📁 Directory Structure

```
mhylle.com/
├── 📁 docs/                     # Documentation
│   ├── 📄 ARCHITECTURE.md       # System architecture overview
│   ├── 📄 DEPLOYMENT.md         # Deployment guide
│   ├── 📄 TROUBLESHOOTING.md    # Troubleshooting guide
│   └── 📄 ADDING-NEW-APP.md     # Guide for adding applications
├── 📁 infrastructure/           # Core infrastructure configuration
│   ├── 📁 nginx/               # Nginx reverse proxy configuration
│   │   ├── 📄 nginx.conf       # Main nginx configuration
│   │   ├── 📄 ssl.conf         # SSL/TLS configuration
│   │   └── 📁 apps/            # Application-specific configurations
│   │       └── 📄 app1.conf    # App1 routing configuration
│   ├── 📁 postgres/            # PostgreSQL configuration
│   │   └── 📁 init/           # Database initialization scripts
│   └── 📁 ssl/                # SSL certificates storage
├── 📁 scripts/                 # Management and deployment scripts
│   ├── 📄 setup.sh            # Initial server setup
│   ├── 📄 deploy-app.sh       # Application deployment
│   ├── 📄 health-check.sh     # Health monitoring
│   ├── 📄 backup-db.sh        # Database backup
│   ├── 📄 rollback-app.sh     # Application rollback
│   ├── 📄 logs.sh             # Log management
│   ├── 📄 setup-letsencrypt.sh # SSL certificate setup
│   └── 📄 renew-ssl.sh        # SSL certificate renewal
├── 📁 example-app1/            # Example application template
│   ├── 📁 frontend/           # Angular frontend
│   ├── 📁 backend/            # NestJS backend
│   ├── 📄 docker-compose.yml  # Application services
│   └── 📄 .github/workflows/  # CI/CD pipeline
├── 📁 logs/                   # Application and system logs
├── 📄 docker-compose.yml      # Core infrastructure services
├── 📄 .env.example           # Environment variables template
└── 📄 README.md              # This file
```

## � Core Services

### Nginx Reverse Proxy
- **Port**: 80 (HTTP), 443 (HTTPS)
- **Function**: SSL termination, routing, rate limiting
- **Health Check**: HTTP endpoint monitoring
- **Configuration**: `/infrastructure/nginx/`

### PostgreSQL Database
- **Port**: 5432 (internal only)
- **Function**: Shared database server with app-specific databases
- **Backup**: Automated daily backups with 30-day retention
- **Configuration**: `/infrastructure/postgres/`

### Watchtower Auto-updater
- **Function**: Monitors and updates container images
- **Schedule**: Every 6 hours
- **Scope**: Only labeled containers
- **Safety**: Respects deployment windows

## 📱 Application Management

### Adding a New Application

1. **Create application** following the template structure
2. **Configure routing** in nginx
3. **Set up database** for the application
4. **Deploy** using the deployment script

```bash
# Quick application deployment
./scripts/deploy-app.sh app2 ghcr.io/username/app2:latest
```

See [ADDING-NEW-APP.md](docs/ADDING-NEW-APP.md) for detailed instructions.

### Application Structure

Each application follows this pattern:
```
your-app/
├── frontend/          # Angular application
├── backend/           # NestJS application
├── docker-compose.yml # Application services
└── .github/workflows/ # CI/CD pipeline
```

### Deployment Process

1. **Push code** to GitHub repository
2. **GitHub Actions** builds and pushes Docker images
3. **Deployment script** pulls images and updates containers
4. **Health checks** verify successful deployment
5. **Nginx** routes traffic to new containers

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# System-wide health check
./scripts/health-check.sh

# Application-specific health check
./scripts/health-check.sh app1

# Real-time monitoring
watch -n 30 './scripts/health-check.sh'
```

### Log Management

```bash
# View all logs
./scripts/logs.sh

# Application-specific logs
./scripts/logs.sh app1

# Follow logs in real-time
./scripts/logs.sh app1 --follow
```

### Backup Management

```bash
# Manual database backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backup_file.sql

# List available backups
ls -la backups/database/
```

### SSL Certificate Management

```bash
# Check certificate status
openssl x509 -in infrastructure/ssl/mhylle.com.crt -noout -enddate

# Force certificate renewal
sudo ./scripts/renew-ssl.sh

# Test SSL configuration
curl -I https://mhylle.com/health
```

## 📚 Documentation

### Comprehensive Guides
- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and components
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment instructions
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Adding Applications](docs/ADDING-NEW-APP.md)** - Step-by-step app integration

### Quick Reference
```bash
# Essential commands
./scripts/health-check.sh        # Check system health
./scripts/deploy-app.sh app1 image:tag  # Deploy application
./scripts/logs.sh app1           # View application logs
./scripts/backup-db.sh           # Backup database
./scripts/rollback-app.sh app1   # Rollback application
```

## 🛠️ Management Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup.sh` | Initial server setup | `sudo ./scripts/setup.sh` |
| `deploy-app.sh` | Deploy/update applications | `./scripts/deploy-app.sh app1 image:tag` |
| `health-check.sh` | Monitor system health | `./scripts/health-check.sh [app]` |
| `backup-db.sh` | Database backup | `./scripts/backup-db.sh` |
| `rollback-app.sh` | Rollback deployment | `./scripts/rollback-app.sh app1` |
| `logs.sh` | Log management | `./scripts/logs.sh [app] [options]` |
| `renew-ssl.sh` | SSL certificate renewal | `sudo ./scripts/renew-ssl.sh` |

## 🚨 Common Operations

### Deploy New Application
```bash
# Add application to infrastructure
./scripts/deploy-app.sh myapp ghcr.io/username/myapp:latest

# Verify deployment
./scripts/health-check.sh myapp
curl -I https://mhylle.com/myapp/
```

### Update Existing Application
```bash
# Deploy new version
./scripts/deploy-app.sh myapp ghcr.io/username/myapp:v2.0.0

# Rollback if needed
./scripts/rollback-app.sh myapp
```

### Maintenance Tasks
```bash
# System health check
./scripts/health-check.sh

# View system logs
./scripts/logs.sh

# Backup database
./scripts/backup-db.sh

# Check SSL certificate
openssl x509 -in infrastructure/ssl/mhylle.com.crt -noout -enddate
```

## 🔒 Security Features

- **SSL/TLS encryption** with automated Let's Encrypt certificates
- **Security headers** (HSTS, CSP, X-Frame-Options, etc.)
- **Rate limiting** to prevent abuse
- **Firewall configuration** with minimal open ports
- **Container isolation** with dedicated networks
- **Non-root containers** for enhanced security
- **Input validation** and SQL injection protection

## 📈 Performance Optimizations

- **Nginx caching** for static assets
- **Gzip compression** for reduced bandwidth
- **Connection keepalive** for better performance
- **Database connection pooling** for efficiency
- **Container resource limits** for stability
- **CDN-ready** static asset serving

## 🔄 High Availability Features

- **Zero-downtime deployments** with blue-green strategy
- **Health check monitoring** with automatic restarts
- **Database backup** with point-in-time recovery
- **Rollback capabilities** for quick recovery
- **Load balancing** ready for horizontal scaling
- **Container auto-restart** on failure

## 🧪 Testing

### Local Development
```bash
# Test infrastructure locally
docker-compose up -d

# Run health checks
./scripts/health-check.sh

# Test nginx configuration
docker exec mhylle-nginx nginx -t
```

### Production Validation
```bash
# Validate deployment
curl -I https://mhylle.com/health
curl -I https://mhylle.com/app1/

# Check SSL certificate
echo | openssl s_client -servername mhylle.com -connect mhylle.com:443 2>/dev/null | openssl x509 -noout -dates
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code structure
- Update documentation for new features
- Test changes thoroughly before submitting
- Include appropriate error handling
- Follow security best practices

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs/](docs/) directory for detailed guides
- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Join the conversation in GitHub Discussions

## 🔮 Roadmap

### Planned Features
- [ ] Kubernetes migration path
- [ ] Multi-server deployment support
- [ ] Enhanced monitoring with Prometheus/Grafana
- [ ] Automated performance optimization
- [ ] Additional application frameworks support
- [ ] Advanced backup strategies

### Current Version: 1.0.0
- ✅ Complete Docker-based infrastructure
- ✅ Zero-downtime deployments
- ✅ Automated SSL management
- ✅ Comprehensive monitoring
- ✅ Production-ready security
- ✅ Full documentation suite

---

**Made with ❤️ for scalable web application hosting**

For detailed setup instructions, see [DEPLOYMENT.md](docs/DEPLOYMENT.md).
For troubleshooting help, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
For adding new applications, see [ADDING-NEW-APP.md](docs/ADDING-NEW-APP.md).
- Routes requests to applications via subpaths
- Handles SSL termination
- Implements rate limiting and security headers
- Serves static assets with caching

### PostgreSQL (Database)
- Shared PostgreSQL 15 instance
- Separate database per application
- Automated backup system
- Connection pooling and optimization

### Watchtower (Updates)
- Monitors core infrastructure images
- Automatic updates for base images
- Configurable update policies

## 📱 Application Integration

Applications are deployed as Docker containers with specific requirements:

### Frontend (Angular)
- Must be built with correct `base-href` for subpath routing
- Nginx configuration for SPA routing
- Static asset optimization

### Backend (NestJS)
- Must respect API prefix configuration
- Database connection via environment variables
- Health check endpoint at `/health`

## 🛠️ Management Scripts

### Setup and Deployment
```bash
# Initial server setup
./scripts/setup.sh

# Deploy an application
./scripts/deploy-app.sh APP_NAME FRONTEND_IMAGE BACKEND_IMAGE [VERSION]

# Setup SSL certificates
./scripts/setup-letsencrypt.sh
```

### Monitoring and Maintenance
```bash
# Check system health
./scripts/health-check.sh [--verbose] [--app APP_NAME]

# View logs
./scripts/logs.sh [--app APP_NAME] [--follow] [--tail 100]

# Backup databases
./scripts/backup-db.sh [--app APP_NAME] [--retention 30]
```

### Troubleshooting
```bash
# Rollback an application
./scripts/rollback-app.sh APP_NAME [VERSION]

# Check specific app logs
./scripts/logs.sh --app app1 --follow

# Health check for specific app
./scripts/health-check.sh --app app1 --verbose
```

## 🔐 Security Features

- **SSL/TLS**: Let's Encrypt certificates with auto-renewal
- **Rate Limiting**: API and web request throttling
- **Security Headers**: CORS, XSS protection, content security policy
- **Network Isolation**: Docker networks with controlled access
- **Minimal Privileges**: Non-root containers where possible
- **Firewall**: UFW configuration with minimal open ports

## 📊 Monitoring

### Health Checks
- Container health monitoring
- Application endpoint testing
- Database connectivity verification
- SSL certificate expiration tracking

### Logging
- Centralized log collection
- Application-specific log filtering
- Error tracking and alerting
- Log rotation and cleanup

### Backups
- Automated database backups
- Configurable retention periods
- Backup integrity verification
- Restoration procedures

## 🔄 Deployment Process

1. **Build Phase** (GitHub Actions):
   - Build Docker images
   - Push to GitHub Container Registry
   - Tag with version and 'latest'

2. **Deploy Phase** (On Server):
   - Pull new images
   - Stop old containers
   - Start new containers
   - Update Nginx configuration
   - Verify deployment

3. **Verification**:
   - Health check endpoints
   - Container status monitoring
   - Rollback on failure

## 🌐 Network Architecture

```
Internet → Nginx (80/443) → Applications (Internal Network)
                          → PostgreSQL (Internal Network)
```

- **External**: Nginx proxy on ports 80/443
- **Internal**: Docker bridge network (172.20.0.0/16)
- **Database**: PostgreSQL accessible only from application containers

## 📝 Environment Variables

Key environment variables in `.env`:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# Domain and SSL
DOMAIN=mhylle.com
SSL_EMAIL=your_email@example.com

# GitHub (for image pulling)
GITHUB_USERNAME=your_username
GITHUB_TOKEN=your_personal_access_token

# Application limits
MAX_CONTAINER_MEMORY=512m
MAX_CONTAINER_CPU=0.5
```

## 🎯 Best Practices

### Application Development
- Build images in CI/CD, not on server
- Use health check endpoints
- Implement graceful shutdown
- Log to stdout/stderr
- Use environment variables for configuration

### Infrastructure Management
- Regular backup testing
- Monitor resource usage
- Keep images updated
- Use semantic versioning
- Test deployments in staging

### Security
- Rotate passwords regularly
- Monitor access logs
- Keep SSL certificates current
- Review security headers
- Audit container permissions

## 🐛 Troubleshooting

### Common Issues

**Container won't start**:
```bash
# Check logs
./scripts/logs.sh --app APP_NAME

# Check container status
docker ps -a | grep APP_NAME

# Check resource usage
docker stats
```

**Database connection issues**:
```bash
# Check PostgreSQL logs


---

**Infrastructure Version**: 1.0.0  
**Last Updated**: $(date)  
**Maintained By**: Infrastructure Team
