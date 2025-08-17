# 🚀 Local Development Guide

This guide helps you run both applications locally for development.

## ✅ Setup Complete

Your local development environment has been configured with:

- **PostgreSQL**: Running on port 5434 (Docker container)
- **App1 Database**: `app1_db` 
- **App2 Database**: `app2_db`
- **Environment Files**: Created with proper configuration

## 🏃‍♂️ Quick Start

### 1. Start PostgreSQL (if not running)
```bash
./start-local-dev.sh
```

### 2. Start Applications (4 Terminal Windows)

**Terminal 1 - App1 Backend:**
```bash
cd ~/projects/mhylle.com/example-app1/backend
npm run start:dev
```
- Runs on: http://localhost:3000
- Health check: http://localhost:3000/health

**Terminal 2 - App1 Frontend:**
```bash
cd ~/projects/mhylle.com/example-app1/frontend
npm start
```
- Runs on: http://localhost:4200

**Terminal 3 - App2 Backend:**
```bash
cd ~/projects/mhylle.com/example-app2/backend
npm run start:dev
```
- Runs on: http://localhost:3001
- Health check: http://localhost:3001/health

**Terminal 4 - App2 Frontend:**
```bash
cd ~/projects/mhylle.com/example-app2/frontend
npm start -- --port 4201
```
- Runs on: http://localhost:4201

## 🔧 Configuration Details

### Database Connection
- **Host**: localhost
- **Port**: 5434 (not 5432 - that's used by server)
- **User**: postgres
- **Password**: password
- **Databases**: app1_db, app2_db

### Environment Files Created
```bash
example-app1/backend/.env.local
example-app2/backend/.env.local
```

### Port Configuration
- App1 Backend: 3000
- App1 Frontend: 4200
- App2 Backend: 3001
- App2 Frontend: 4201
- PostgreSQL: 5434

### API Proxy Configuration (FOR LOCAL DEVELOPMENT ONLY)

**Problem Solved**: Frontend was trying to call APIs on same port as itself (4200) instead of backend ports.

**Solution**: Angular proxy configuration files created:
- `example-app1/frontend/proxy.conf.json` - Routes `/api/app1/*` to `localhost:3000`
- `example-app2/frontend/proxy.conf.json` - Routes `/api/app2/*` to `localhost:3001`

**How it works**:
- **Production**: `/api/app1/*` → nginx → backend (path rewriting)
- **Local Dev**: `/api/app1/*` → Angular proxy → localhost:3000 (path rewriting)

**⚠️ IMPORTANT**: This only affects local development. Production deployment is unchanged.

## 🧪 Testing Your Setup

### Health Checks
```bash
# Test backends directly
curl http://localhost:3000/health
curl http://localhost:3001/health

# Test backends via frontend proxy (this is what your frontend uses)
curl http://localhost:4200/api/app1/health
curl http://localhost:4201/api/app2/health

# Test frontends
open http://localhost:4200
open http://localhost:4201
```

### Proxy Testing (Verify Fix)
```bash
# This should now work from your Angular app
# Frontend calls /api/app1/messages → proxy routes to → localhost:3000/messages
curl http://localhost:4200/api/app1/messages

# Direct backend call (for comparison)
curl http://localhost:3000/messages
```

### Database Access
```bash
# Connect to PostgreSQL
docker exec -it local-postgres-dev psql -U postgres

# Check databases
\l

# Connect to app databases
\c app1_db
\c app2_db
```

## 🔄 Development Workflow

### Making Changes

**Backend Changes:**
- Edit files in `src/` directories
- NestJS will auto-reload with hot-reload
- Database schema changes auto-sync in development

**Frontend Changes:**  
- Edit files in `src/` directories
- Angular will auto-reload in browser
- Changes appear immediately

### Database Management

**Reset Database:**
```bash
# Stop and remove PostgreSQL container
docker stop local-postgres-dev
docker rm local-postgres-dev

# Run startup script to recreate
./start-local-dev.sh
```

**View Database:**
```bash
# Connect to PostgreSQL
docker exec -it local-postgres-dev psql -U postgres -d app1_db

# List tables
\dt

# View messages table (if exists)
SELECT * FROM messages;
```

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL container is running
docker ps | grep local-postgres-dev

# Check logs
docker logs local-postgres-dev

# Restart container
docker restart local-postgres-dev
```

### Port Conflicts
If ports are in use:
```bash
# Check what's using port 3000
lsof -i :3000

# Kill process if needed
kill -9 <PID>
```

### Dependencies Issues
```bash
# Reinstall dependencies
cd example-app1/frontend && npm install
cd example-app1/backend && npm install
cd example-app2/frontend && npm install  
cd example-app2/backend && npm install
```

## 🔥 Hot Tips

### CORS Configuration
- Backends are configured to allow localhost origins
- No CORS issues during development

### Database Auto-Sync
- TypeORM synchronize is enabled for development
- Tables auto-create based on entities
- Schema changes apply automatically

### Environment Variables
- `.env.local` files override defaults
- Committed to git for easy setup
- Production uses different values

### VS Code Setup
Recommended extensions:
- Angular Language Service
- NestJS Files
- PostgreSQL Explorer

## 📚 API Documentation

### App1 Endpoints
- `GET /` - Welcome message
- `GET /health` - Health check
- `POST /messages` - Create message
- `GET /messages` - Get all messages

### App2 Endpoints  
- `GET /` - Welcome message
- `GET /info` - App information
- `POST /messages` - Create message
- `GET /messages` - Get all messages

## 🎯 Next Steps

1. **Start Development**: Follow the Quick Start section
2. **Make Changes**: Edit code and see live updates
3. **Test APIs**: Use curl or frontend to test endpoints
4. **Debug**: Use browser dev tools and NestJS logs
5. **Commit Changes**: Git commit when ready

## 🐳 Alternative: Docker Development

If you prefer Docker, see `docker-compose.dev.yml` files in each app directory.

## 💡 Pro Tips

- Keep terminals organized with clear labels
- Use `npm run start:debug` for backend debugging
- Frontend dev tools are available in browser
- Database explorer extensions help visualize data