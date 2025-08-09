# System Architecture Documentation

## Overview

The mhylle.com infrastructure is designed to host multiple independent web applications on a single Scaleway server using containerized deployment with Docker Compose. The system provides zero-downtime deployments, automated SSL certificate management, and comprehensive monitoring.

## Core Technologies

### Host Environment
- **Operating System**: Ubuntu 24.04 LTS
- **Server Specifications**: 
  - RAM: 4GB
  - CPU: 3 cores
  - Public IP: 51.159.168.239
  - Domain: mhylle.com

### Containerization
- **Docker Engine**: 24.0+
- **Docker Compose**: v2.0+
- **Container Registry**: GitHub Container Registry (ghcr.io)

### Core Services
- **Reverse Proxy**: Nginx (latest)
- **Database**: PostgreSQL 15
- **Auto-updater**: Watchtower
- **SSL/TLS**: Let's Encrypt certificates

## Architecture Patterns

### 1. Reverse Proxy Pattern
The system uses Nginx as a reverse proxy to route traffic to different applications based on URL paths:

```
mhylle.com/app1/* → Application 1 (Frontend + Backend)
mhylle.com/app2/* → Application 2 (Frontend + Backend)
mhylle.com/api/app1/* → Application 1 API
mhylle.com/api/app2/* → Application 2 API
```

### 2. Shared Database Pattern
All applications share a single PostgreSQL instance but use separate databases:

```
PostgreSQL Instance
├── app1_db (Application 1 database)
├── app2_db (Application 2 database)
└── shared_db (Cross-application data if needed)
```

### 3. Container Orchestration
Each application runs in separate containers with dedicated networks:

```
Docker Networks:
├── mhylle-network (Core services)
├── app1-network (Application 1 services)
└── app2-network (Application 2 services)
```

## System Components

### Core Infrastructure (docker-compose.yml)

#### Nginx Reverse Proxy
- **Container**: `mhylle-nginx`
- **Ports**: 80, 443
- **Volumes**: 
  - Configuration: `./infrastructure/nginx`
  - SSL certificates: `./infrastructure/ssl`
  - Certbot data: `certbot-data`
- **Health Check**: HTTP check on port 80
- **Networks**: All application networks

#### PostgreSQL Database
- **Container**: `mhylle-postgres`
- **Port**: 5432 (internal only)
- **Volumes**: 
  - Data: `postgres-data`
  - Initialization: `./infrastructure/postgres/init`
- **Environment**: Credentials via `.env`
- **Health Check**: pg_isready command

#### Watchtower Auto-updater
- **Container**: `mhylle-watchtower`
- **Function**: Monitors and updates containers
- **Schedule**: Every 6 hours
- **Scope**: Only labeled containers

### Application Structure

Each application follows this standard structure:

```
application/
├── frontend/          # Angular frontend
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── backend/           # NestJS backend
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml # Application-specific services
├── .env.example       # Environment template
└── .github/workflows/ # CI/CD pipeline
```

## Network Architecture

### Network Segmentation

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Nginx Reverse Proxy                        │
│                 (Port 80/443)                              │
└─────┬─────────────────────────────────────────┬─────────────┘
      │                                         │
┌─────▼─────────────────┐                ┌─────▼─────────────────┐
│    Application 1      │                │    Application 2      │
│  ┌─────────────────┐  │                │  ┌─────────────────┐  │
│  │   Frontend      │  │                │  │   Frontend      │  │
│  │   (Angular)     │  │                │  │   (Angular)     │  │
│  └─────────────────┘  │                │  └─────────────────┘  │
│  ┌─────────────────┐  │                │  ┌─────────────────┐  │
│  │   Backend       │  │                │  │   Backend       │  │
│  │   (NestJS)      │  │                │  │   (NestJS)      │  │
│  └─────────────────┘  │                │  └─────────────────┘  │
└───────┬───────────────┘                └───────┬───────────────┘
        │                                        │
        └─────────────────┬──────────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │        PostgreSQL Database        │
        │     ┌─────────┐ ┌─────────┐      │
        │     │ app1_db │ │ app2_db │      │
        │     └─────────┘ └─────────┘      │
        └───────────────────────────────────┘
```

### Security Boundaries

1. **External Traffic**: Only HTTP/HTTPS allowed through firewall
2. **Container Isolation**: Applications run in separate networks
3. **Database Access**: Only backend containers can access PostgreSQL
4. **SSL/TLS**: All external traffic encrypted with Let's Encrypt

## Deployment Architecture

### Blue-Green Deployment Strategy

Each application deployment follows a blue-green pattern:

1. **Pull new image** from GitHub Container Registry
2. **Start new container** alongside existing one
3. **Health check** new container endpoints
4. **Update Nginx** configuration to point to new container
5. **Stop old container** after successful verification

### CI/CD Pipeline

```
GitHub Push → GitHub Actions → Build Image → Push to GHCR → Deploy Script → Health Check
```

## Monitoring and Observability

### Health Monitoring
- **Nginx**: `/health` endpoint
- **Applications**: Custom health endpoints
- **Database**: Connection monitoring
- **SSL**: Certificate expiration tracking

### Logging Strategy
- **Nginx**: Access and error logs with structured format
- **Applications**: Container stdout/stderr captured by Docker
- **System**: Centralized in `/var/log/`

### Metrics Collection
- **Resource Usage**: Docker stats
- **Response Times**: Nginx request timing
- **Error Rates**: HTTP status code tracking

## Data Architecture

### Database Design
- **Shared Instance**: Single PostgreSQL server
- **Separate Databases**: One per application
- **Connection Pooling**: Handled at application level
- **Backup Strategy**: Automated daily backups

### Data Flow
```
Frontend (Angular) → Backend (NestJS) → PostgreSQL
      ↑                    ↑
   Static Files        API Endpoints
      ↑                    ↑
  Nginx Proxy        Nginx Proxy
```

## Security Architecture

### SSL/TLS Configuration
- **Certificates**: Let's Encrypt with automated renewal
- **Protocols**: TLS 1.2, TLS 1.3 only
- **Ciphers**: Modern cipher suites
- **HSTS**: Enabled with preload

### Security Headers
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Content-Security-Policy**: Restrictive CSP

### Access Control
- **Firewall**: UFW with minimal open ports
- **Container Security**: Non-root users, read-only filesystems
- **Database**: Internal network only

## Scalability Considerations

### Horizontal Scaling Options
1. **Multi-server**: Add additional servers behind load balancer
2. **Database Scaling**: Read replicas for read-heavy workloads
3. **CDN Integration**: Static asset delivery optimization

### Vertical Scaling
- **Memory**: Increase container memory limits
- **CPU**: Adjust worker processes/threads
- **Storage**: Expand volumes as needed

### Performance Optimization
- **Nginx**: Caching, compression, connection pooling
- **Database**: Query optimization, indexing
- **Applications**: Code splitting, lazy loading

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups with retention
- **Configurations**: Version controlled in Git
- **SSL Certificates**: Automated backup before renewal

### Recovery Procedures
1. **Application Failure**: Automatic restart via Docker
2. **Database Corruption**: Restore from latest backup
3. **Complete Server Failure**: Redeploy on new server from Git

## Maintenance Windows

### Regular Maintenance
- **Security Updates**: Automated via Watchtower
- **SSL Renewal**: Automated via cron job
- **Log Rotation**: System-managed rotation
- **Backup Cleanup**: Automated retention policies

### Planned Maintenance
- **Database Maintenance**: Monthly optimization
- **Security Audits**: Quarterly reviews
- **Performance Reviews**: Bi-annual assessments

## Future Architecture Considerations

### Microservices Evolution
- **Service Mesh**: Consider Istio/Linkerd for complex routing
- **Message Queues**: Redis/RabbitMQ for async processing
- **Event Sourcing**: Event-driven architecture patterns

### Cloud-Native Features
- **Kubernetes**: Migration path for container orchestration
- **Service Discovery**: Consul/etcd for dynamic service registration
- **Configuration Management**: External config services

### Observability Enhancement
- **Distributed Tracing**: Jaeger/Zipkin integration
- **Metrics Platform**: Prometheus + Grafana
- **Log Aggregation**: ELK stack or similar

This architecture provides a solid foundation for hosting multiple web applications with growth potential and operational reliability.
