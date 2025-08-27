# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a multi-application hosting infrastructure based on Docker Compose, designed to host multiple Angular/NestJS applications on a single server with subpath routing via Nginx reverse proxy.

## Critical Deployment Rule

**All deployments MUST be done using GitHub Actions.** Direct server deployment or manual modifications are strictly prohibited. You may read server state for verification only.

## Common Development Commands

### Frontend (Angular 20) - example-app1/frontend, example-app2/frontend
```bash
# Development
npm start                    # Start dev server
npm run build               # Build for production with correct base-href
ng build --base-href=/app1/ # Build with subpath routing

# Testing
npm test                    # Run unit tests
ng test --no-watch --no-progress --browsers=ChromeHeadless # CI tests

# Linting
ng lint                     # Run ESLint
```

### Backend (NestJS 11) - example-app1/backend, example-app2/backend
```bash
# Development
npm run start:dev           # Start with hot-reload
npm run start:debug         # Start with debugging

# Testing
npm test                    # Run unit tests
npm run test:watch          # Watch mode
npm run test:e2e           # E2E tests

# Build & Production
npm run build              # Build TypeScript
npm run start:prod         # Start production server

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format with Prettier
```

### Infrastructure Management
```bash
# Deployment Scripts (from root)
./scripts/deploy-app.sh APP_NAME IMAGE_TAG        # Deploy application
./scripts/health-check.sh [--app APP_NAME]        # Check health
./scripts/logs.sh [--app APP_NAME] [--follow]     # View logs
./scripts/backup-db.sh                            # Backup database
./scripts/rollback-app.sh APP_NAME                # Rollback deployment
./scripts/setup-letsencrypt.sh                    # Setup SSL certificates

# Docker Commands
docker-compose up -d                              # Start infrastructure
docker-compose -f docker-compose.apps.yml up -d   # Start applications
docker ps | grep mhylle                          # Check containers
docker logs mhylle-nginx -f                      # View nginx logs
```

## Architecture Overview

### Core Infrastructure Pattern
The system uses a **shared infrastructure model** where:
- **Single Nginx** reverse proxy handles all routing
- **Single PostgreSQL** instance with per-app databases (app1_db, app2_db)
- **Independent application deployments** via separate docker-compose files
- **Subpath routing**: `/app1/*` → App1, `/api/app1/*` → App1 API

### Network Architecture
```
Internet → Nginx (ports 80/443) → Applications (internal network)
                                → PostgreSQL (internal, port 5432)
```

Network: `172.25.0.0/16` (app-network)

### Deployment Strategy
1. GitHub Actions builds Docker images on push to main
2. Images pushed to GitHub Container Registry (ghcr.io)
3. Deploy script pulls images and performs blue-green deployment
4. Zero-downtime achieved through container replacement

### Application Structure
Each application requires:
- **Frontend**: Angular 20 with `--base-href=/appname/` configuration
- **Backend**: NestJS 11 with TypeORM and PostgreSQL
- **Database**: Separate PostgreSQL database (e.g., app1_db)
- **Routing**: Nginx strips `/api/app1` prefix before forwarding to backend

### Critical Nginx Configuration
The nginx configuration (`infrastructure/nginx/apps/`) strips the API prefix:
```nginx
location /api/app1/ {
    rewrite ^/api/app1/(.*)$ /$1 break;  # Strips /api/app1 prefix
    proxy_pass http://app1-backend:3000;
}
```

### Environment Variables
Applications use these environment variables:
- `DB_HOST=mhylle-postgres` (container name, not localhost)
- `DB_PORT=5432`
- `DB_USERNAME=app_app1` (actual username from init script)
- `DB_PASSWORD` (from secrets)
- `DB_DATABASE=app1_db` (app-specific database)
- `AUTH_URL=http://mhylle-auth-service:3000/api/auth` (for auth service communication)
- `NODE_ENV=production` (affects TypeORM synchronization)

## Key Files to Understand

### Infrastructure
- `docker-compose.yml` - Core services (nginx, postgres, watchtower)
- `docker-compose.apps.yml` - Application orchestration
- `infrastructure/nginx/apps/*.conf` - Per-app routing rules
- `scripts/init-databases.sql` - Database initialization

### Application Configuration
- `example-app*/docker-compose.yml` - App-specific services
- `example-app*/frontend/nginx.conf` - Frontend serving config
- `example-app*/backend/src/main.ts` - NestJS bootstrap with prefix
- `.github/workflows/deploy.yml` - CI/CD pipeline

## Adding New Applications

When adding a new application:
1. Copy example-app1 structure
2. Update app name in all configurations
3. Add nginx routing config in `infrastructure/nginx/apps/`
4. Configure GitHub Actions workflow
5. Set correct `--base-href` in Angular build
6. Configure backend API prefix
7. Add database initialization in scripts

## Common Issues & Solutions

### Frontend Not Loading
- Check Angular base-href matches nginx location
- Verify nginx.conf in frontend container handles SPA routing
- Ensure static assets path is correct

### API 404 Errors
- Verify nginx strips `/api/appname` prefix correctly
- Check NestJS global prefix configuration
- Ensure backend health endpoint responds at `/health`

### Database Connection
- Container must be on `mhylle_app-network`
- Use hostname `mhylle-postgres` not localhost or postgres
- Database user is `app_app1` not `app1_user` (verify in init script)
- Check database exists (app1_db, app2_db)

### SSL/Certificate Issues
- Run `./scripts/setup-letsencrypt.sh` for initial setup
- Check certificate expiry with `openssl x509 -in infrastructure/ssl/mhylle.com.crt -noout -enddate`
- Renewal via `./scripts/renew-ssl.sh`

## Testing Strategy

### Local Testing
```bash
# Test infrastructure locally
docker-compose up -d
./scripts/health-check.sh

# Test specific app
curl http://localhost/app1/
curl http://localhost/api/app1/health
```

### Production Verification
```bash
# After deployment
./scripts/health-check.sh app1
curl -I https://mhylle.com/app1/
curl https://mhylle.com/api/app1/health
```

## Security Considerations

- All deployments via GitHub Actions (no direct server access)
- PostgreSQL only accessible within Docker network
- SSL/TLS enforced with Let's Encrypt
- Security headers configured in nginx
- Non-root containers where possible
- Secrets managed via GitHub Secrets
- Cookie-based authentication with HTTP-only, secure flags
- Single domain architecture: mhylle.com with subpath routing (/app1, /app2)

## Authentication Architecture

**CRITICAL: Single Domain with Subpaths (NOT Subdomains)**
- Domain: `mhylle.com` with subpaths `/app1`, `/app2`, etc.
- **NOT using subdomains** like `app1.mhylle.com` or `app2.mhylle.com`
- Cookie domain should be `mhylle.com` (no leading dot)

The system uses a **centralized authentication service** with cookie-based SSO:
- **Auth Service**: Standalone NestJS service handling login/registration/validation  
- **Cookie-based SSO**: HTTP-only cookies for `mhylle.com` domain
- **Application Integration**: Each app proxies auth requests through its backend to maintain consistent routing
- **Separation of Concerns**: ALL business logic in applications, auth service ONLY for authentication
- **Route Pattern**: Frontend → App Backend → Auth Service for all authentication operations

### Authentication Flow
```
Frontend (/app1/) → App1 Backend (/api/app1/auth/*) → Auth Service (/api/auth/*)
                                   ↓
                            Sets domain cookies (.mhylle.com)
                                   ↓
                            Validates requests via cookie headers
```

### Database Migration System

Each application uses an **automatic migration system** that runs on startup:
- **Migration Service**: `database-migrations.service.ts` runs automatically when backend starts
- **Migration Tracking**: Uses `migrations` table to track completed migrations
- **Idempotent**: Safe to run multiple times - uses `CREATE TABLE IF NOT EXISTS` patterns
- **Future-proof**: Easy to add new migrations by adding methods to the service
- **Deployment Compatible**: Works through GitHub Actions deployment without manual server commands

## Performance Notes

- Nginx caches static assets
- Gzip compression enabled
- Database connection pooling in NestJS
- Container resource limits set
- Health checks prevent unhealthy containers from receiving traffic
- System architecture uses single domain (mhylle.com) with subpath routing
- Applications accessible at mhylle.com/app1, mhylle.com/app2, etc.
- Repository structure: separate repos for infrastructure, app1, and app2