# Adding New Applications Guide

## Overview

This guide provides step-by-step instructions for adding new web applications to the mhylle.com infrastructure. Each application will be deployed with its own subdirectory path (e.g., `/app2`, `/app3`) while sharing the core infrastructure.

## Prerequisites

Before adding a new application, ensure:
- Core infrastructure is running and healthy
- You have the application source code ready
- Application follows the expected structure (Angular frontend + NestJS backend)
- GitHub repository is set up for the application
- CI/CD pipeline requirements are understood

## Application Requirements

### Project Structure

Your application should follow this structure:

```
your-new-app/
├── frontend/                 # Angular frontend application
│   ├── src/
│   │   ├── app/
│   │   ├── assets/
│   │   └── environments/
│   ├── Dockerfile
│   ├── nginx.conf           # Nginx config for serving Angular
│   ├── package.json
│   └── angular.json
├── backend/                 # NestJS backend application
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── entities/
│   │   └── main.ts
│   ├── Dockerfile
│   ├── package.json
│   └── nest-cli.json
├── docker-compose.yml       # Application-specific services
├── .env.example            # Environment variables template
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD pipeline
└── README.md
```

### Code Requirements

#### Frontend (Angular) Configuration

**1. Base href configuration**

In `angular.json`, configure for subpath routing:
```json
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "options": {
            "baseHref": "/app2/"
          }
        }
      }
    }
  }
}
```

**2. Environment configuration**

In `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: '/api/app2',
  baseHref: '/app2/'
};
```

**3. Routing configuration**

Update `app-routing.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  // ... other routes
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { 
    useHash: false,
    enableTracing: false 
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

#### Backend (NestJS) Configuration

**1. Global prefix configuration**

In `src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Set global prefix for API routes
  app.setGlobalPrefix('api/app2');
  
  // Enable CORS for the specific domain
  app.enableCors({
    origin: ['https://mhylle.com', 'http://localhost:4200'],
    credentials: true,
  });
  
  await app.listen(3000);
}
bootstrap();
```

**2. Database configuration**

In your database module:
```typescript
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'app2_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class DatabaseModule {}
```

## Step-by-Step Addition Process

### Step 1: Prepare Application Code

#### 1.1 Configure Frontend Build

Create `frontend/Dockerfile`:
```dockerfile
# Multi-stage build for Angular
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build -- --prod --base-href=/app2/

# Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist/your-app /usr/share/nginx/html/app2
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle Angular routing for subpath
    location /app2/ {
        try_files $uri $uri/ /app2/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Cache static assets
    location ~* /app2/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

#### 1.2 Configure Backend Build

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/app2/health || exit 1

CMD ["node", "dist/main"]
```

### Step 2: Set Up Application Infrastructure

#### 2.1 Create Application Docker Compose

Create `docker-compose.yml` in your application root:
```yaml
version: '3.8'

services:
  app2-frontend:
    image: ghcr.io/your-username/app2-frontend:latest
    container_name: app2-frontend
    restart: unless-stopped
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    networks:
      - app2-network
      - mhylle-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  app2-backend:
    image: ghcr.io/your-username/app2-backend:latest
    container_name: app2-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=mhylle-postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DB=app2_db
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    networks:
      - app2-network
      - mhylle-network
    depends_on:
      - mhylle-postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/app2/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

networks:
  app2-network:
    driver: bridge
  mhylle-network:
    external: true

# External services referenced
external_links:
  - mhylle-postgres:postgres
```

#### 2.2 Create Environment Configuration

Create `.env.example`:
```bash
# Application Configuration
APP_NAME=app2
APP_VERSION=1.0.0

# Database Configuration
POSTGRES_HOST=mhylle-postgres
POSTGRES_PORT=5432
POSTGRES_DB=app2_db
POSTGRES_USER=mhylle_user
POSTGRES_PASSWORD=your_secure_password_here

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=7d

# External Services
REDIS_URL=redis://mhylle-redis:6379

# GitHub Container Registry
GHCR_USERNAME=your-github-username
GHCR_TOKEN=your-github-token
```

### Step 3: Configure Infrastructure Integration

#### 3.1 Create Nginx Configuration

On your server, create the nginx configuration for the new app:

```bash
# Connect to your server
ssh mhylle@your-server-ip
cd /home/mhylle/projects/mhylle.com

# Create app configuration
sudo nano infrastructure/nginx/apps/app2.conf
```

Add this configuration:
```nginx
# Application 2 Configuration
# Upstream definitions
upstream app2_frontend {
    server app2-frontend:80;
    keepalive 32;
}

upstream app2_backend {
    server app2-backend:3000;
    keepalive 32;
}

# Frontend application routing
location /app2/ {
    proxy_pass http://app2_frontend/app2/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Rate limiting
    limit_req zone=web burst=100 nodelay;
    
    # CORS headers for frontend
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Handle Angular routing
    location ~* /app2/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://app2_frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API routing
location /api/app2/ {
    proxy_pass http://app2_backend/api/app2/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Rate limiting for API
    limit_req zone=api burst=50 nodelay;
    
    # API-specific headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    
    # CORS headers
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin 'https://mhylle.com';
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'Authorization, Content-Type, Accept';
        add_header Access-Control-Max-Age 86400;
        return 204;
    }
}

# WebSocket support (if needed)
location /api/app2/socket.io/ {
    proxy_pass http://app2_backend/api/app2/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Application health check
location /api/app2/health {
    proxy_pass http://app2_backend/api/app2/health;
    access_log off;
}
```

#### 3.2 Set Up Database

Create the application database:

```bash
# Connect to PostgreSQL
docker exec -it mhylle-postgres psql -U mhylle_user -d mhylle_main

# Create database for the new application
CREATE DATABASE app2_db;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE app2_db TO mhylle_user;

# Exit PostgreSQL
\q
```

### Step 4: Set Up CI/CD Pipeline

#### 4.1 Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy App2 to Production

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME_FRONTEND: ${{ github.repository }}-frontend
  IMAGE_NAME_BACKEND: ${{ github.repository }}-backend

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: |
            frontend/package-lock.json
            backend/package-lock.json
      
      - name: Install Frontend Dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Install Backend Dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Test Frontend
        working-directory: ./frontend
        run: npm run test -- --watch=false --browsers=ChromeHeadless
      
      - name: Test Backend
        working-directory: ./backend
        run: npm run test
      
      - name: Lint Frontend
        working-directory: ./frontend
        run: npm run lint
      
      - name: Lint Backend
        working-directory: ./backend
        run: npm run lint

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for Frontend
        id: meta-frontend
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_FRONTEND }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Extract metadata for Backend
        id: meta-backend
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_BACKEND }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Frontend Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          push: true
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}

      - name: Build and push Backend Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: ${{ steps.meta-backend.outputs.tags }}
          labels: ${{ steps.meta-backend.outputs.labels }}

      - name: Deploy to Production Server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /home/mhylle/projects/mhylle.com
            ./scripts/deploy-app.sh app2 ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_FRONTEND }}:latest ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_BACKEND }}:latest

      - name: Health Check
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /home/mhylle/projects/mhylle.com
            ./scripts/health-check.sh app2
```

#### 4.2 Configure GitHub Secrets

In your application's GitHub repository, add these secrets:
- `SERVER_HOST`: Your server IP address
- `SERVER_USER`: `mhylle`
- `SERVER_SSH_KEY`: Private SSH key for server access

### Step 5: Deploy the Application

#### 5.1 Initial Deployment

```bash
# On your server, clone the application repository
cd /home/mhylle/projects
git clone https://github.com/your-username/your-app2.git
cd your-app2

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env

# Deploy the application
cd /home/mhylle/projects/mhylle.com
./scripts/deploy-app.sh app2 \
  ghcr.io/your-username/your-app2-frontend:latest \
  ghcr.io/your-username/your-app2-backend:latest
```

#### 5.2 Update Nginx Configuration

```bash
# Test nginx configuration
docker exec mhylle-nginx nginx -t

# If test passes, reload nginx
docker exec mhylle-nginx nginx -s reload
```

#### 5.3 Verify Deployment

```bash
# Run health check
./scripts/health-check.sh app2

# Test endpoints
curl -I https://mhylle.com/app2/
curl -I https://mhylle.com/api/app2/health

# Check application logs
./scripts/logs.sh app2
```

## Application-Specific Configurations

### Environment Variables

Each application should have its own set of environment variables in `.env`:

```bash
# Application-specific variables
APP_NAME=app2
APP_PORT_FRONTEND=3002
APP_PORT_BACKEND=3102

# Database configuration
POSTGRES_DB=app2_db

# Authentication
JWT_SECRET=app2_specific_jwt_secret
JWT_EXPIRATION=7d

# Feature flags
ENABLE_FEATURE_X=true
ENABLE_ANALYTICS=false

# External integrations
THIRD_PARTY_API_KEY=your_api_key
THIRD_PARTY_BASE_URL=https://api.example.com
```

### Database Migrations

For applications using TypeORM, set up migration scripts:

```bash
# In package.json
{
  "scripts": {
    "migration:generate": "typeorm migration:generate -n",
    "migration:run": "typeorm migration:run",
    "migration:revert": "typeorm migration:revert"
  }
}

# Run migrations during deployment
docker exec app2-backend npm run migration:run
```

### Custom Health Checks

Implement comprehensive health checks in your backend:

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      // Add other health indicators
    ]);
  }
}
```

## Monitoring and Maintenance

### Application-Specific Monitoring

```bash
# Add application to monitoring script
echo "app2" >> /home/mhylle/projects/mhylle.com/config/monitored-apps.txt

# Create application-specific log monitoring
tail -f /var/lib/docker/containers/$(docker ps -q --filter name=app2-backend)/*/json.log | jq -r .log
```

### Backup Considerations

```bash
# Add application data to backup script
# In scripts/backup-app-data.sh
docker exec app2-backend npm run backup:data
docker run --rm -v app2_uploads:/data -v $(pwd)/backups:/backup alpine tar czf /backup/app2_uploads_$(date +%Y%m%d_%H%M%S).tar.gz /data
```

## Common Pitfalls and Best Practices

### Frontend Configuration Pitfalls

1. **Base href mismatch**: Ensure base href matches nginx location
2. **Asset paths**: Use relative paths or configure asset prefix
3. **Router configuration**: Use `PathLocationStrategy` for subpath routing

### Backend Configuration Pitfalls

1. **CORS configuration**: Ensure origin matches your domain
2. **Global prefix**: Must match nginx proxy path
3. **Database connections**: Use connection pooling for performance

### Deployment Best Practices

1. **Test locally first**: Use docker-compose to test integration
2. **Staged deployment**: Test in staging environment before production
3. **Rollback plan**: Always have a rollback strategy ready
4. **Health checks**: Implement comprehensive health checks
5. **Monitoring**: Set up logging and monitoring from day one

### Security Considerations

1. **Environment variables**: Never commit secrets to Git
2. **Network isolation**: Use separate networks for applications
3. **Input validation**: Validate all inputs on backend
4. **Rate limiting**: Configure appropriate rate limits
5. **HTTPS only**: Ensure all traffic uses HTTPS

This guide provides a comprehensive approach to adding new applications to the infrastructure while maintaining consistency, security, and operational excellence.
