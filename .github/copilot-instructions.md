# AI Agent Instructions for mhylle.com Infrastructure

## 🚨 CRITICAL DEPLOYMENT RULES
**NEVER modify anything directly on the server.** All deployments MUST use GitHub Actions and Docker images ONLY.

### ✅ ALLOWED: Read-only server access
- View logs: `docker logs appN-frontend` 
- Check status: `docker ps`, `./scripts/health-check.sh`
- Read files: `cat`, `ls`, monitoring commands

### ❌ FORBIDDEN: Direct server modifications
- No file editing on server
- No manual container restarts
- No direct docker run/build commands
- No configuration changes outside GitHub Actions

**ALL changes → GitHub repo → GitHub Actions → Docker images → Automated deployment**

## Architecture Overview
This is a **multi-application hosting platform** using:
- **Single Nginx** reverse proxy with subpath routing (`/app1/`, `/app2/`, `/api/app1/`, `/api/app2/`)
- **Shared PostgreSQL** instance with isolated databases (`app1_db`, `app2_db`)
- **Independent Docker containers** for each application (frontend + backend)
- **Zero-downtime deployments** via GitHub Actions → GHCR → SSH deployment scripts

## Application Structure Pattern
Each application follows this exact structure:
```
example-appN/
├── frontend/               # Angular 19+ with standalone components
│   ├── Dockerfile         # Multi-stage: Node build → Nginx serve
│   ├── angular.json       # CRITICAL: baseHref="/appN/"
│   └── nginx.conf         # SPA routing with try_files
├── backend/               # NestJS 11+ with TypeORM
│   ├── Dockerfile         # Multi-stage: Node build → Production
│   └── src/main.ts        # CRITICAL: Health endpoint at /health
└── .github/workflows/     # CI/CD with build → push → deploy
```

## Critical Configuration Patterns

### Frontend (Angular 19+) Requirements
- **Standalone components**: All components MUST use `standalone: true` (default in Angular 19+)
- **Signals**: Use Angular signals for reactive state management instead of traditional observables
- **Component structure**: Move from `declarations` to `imports` array in modules
- **Base href**: Angular builds MUST use `--base-href="/appN/"` (matches nginx routing)
- **Docker output**: Check `angular.json` outputPath - Angular 19+ uses `dist/appN-frontend/` (no `/browser` subfolder)
- **Routing**: Use `RouterModule.forRoot()` with proper routing config for subpaths

### Angular 19 Patterns
```typescript
// Standalone component with signals
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `<div>{{count()}} - {{message()}}</div>`
})
export class ExampleComponent {
  count = signal(0);
  message = signal('Hello');
  
  increment() {
    this.count.update(value => value + 1);
  }
}

// In app.module.ts - import standalone components, don't declare them
@NgModule({
  imports: [
    ExampleComponent,  // ✅ Import standalone components
    OtherStandaloneComponent
  ],
  declarations: [
    // ❌ Don't declare standalone components here
  ]
})
```

### Backend (NestJS) Requirements  
- **Health endpoint**: MUST have `/health` endpoint returning JSON with status/timestamp
- **CORS**: Configure for production domain `https://mhylle.com` and localhost for dev
- **Database**: Use environment variables (`DB_HOST=postgres`, `DB_DATABASE=appN_db`)
- **Container user**: Run as non-root user `nestjs:nodejs` (security)

### Nginx Routing (infrastructure/nginx/conf.d/apps.conf)
```nginx
# Frontend: Serve Angular SPA
location /appN/ {
    rewrite ^/appN/(.*)$ /$1 break;
    proxy_pass http://appN-frontend:80/;
}

# Backend: Strip API prefix before forwarding
location /api/appN/ {
    rewrite ^/api/appN/(.*)$ /$1 break;
    proxy_pass http://appN-backend:3000/;
}
```

## Debugging Workflows

### Build Failures
1. **Angular build issues**: Check `tsconfig.app.json` exists, standalone component imports
2. **Docker copy issues**: Verify build output path matches COPY statement in Dockerfile  
3. **Base href mismatch**: Ensure Angular build base-href matches nginx location

### Deployment Failures
```bash
# Check deployment status
./scripts/health-check.sh appN
docker logs appN-frontend
docker logs appN-backend

# Common fixes
docker exec mhylle-nginx nginx -t  # Test nginx config
curl http://localhost/api/appN/health  # Test backend health
```

### Database Issues
- Each app gets dedicated database: `appN_db` with user `app_appN`
- Connection via Docker network: `host=postgres, port=5432`
- Check database exists: `docker exec mhylle-postgres psql -U mhylle_admin -l`

## Development Commands

### Local Testing
```bash
# Test infrastructure
docker-compose up -d
./scripts/health-check.sh

# Test specific app
cd example-appN
docker-compose up --build  # Local testing
```

### Deployment Pipeline
```bash
# Trigger deployment (from app repo)
git push origin main  # → GitHub Actions → Auto deployment

# Manual deployment (emergency only)
./scripts/deploy-app.sh appN ghcr.io/user/appN:tag
```

## Common Gotchas
- **Angular 19+**: Components are standalone by default - move from `declarations` to `imports`
- **Nginx rewrite**: Must strip subpath (`/appN/`) before proxying to container
- **Docker output**: Angular 19 changed output structure - no `/browser` subfolder in many cases
- **Health checks**: Backend `/health` endpoint is required for container health monitoring
- **Base href**: Frontend build base-href must exactly match nginx location path

## File Patterns to Follow
- Copy `example-app1/` structure for new applications
- Use `infrastructure/nginx/apps/` for routing configs  
- Follow `.github/workflows/deploy.yml` pattern for CI/CD
- Environment variables in `.env` files, secrets in GitHub Secrets