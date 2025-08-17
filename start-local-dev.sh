#!/bin/bash

echo "🚀 Starting Local Development Environment"
echo "========================================"

# Check if PostgreSQL container is running
if ! docker ps | grep -q "local-postgres-dev"; then
    echo "❌ PostgreSQL container not running. Starting it..."
    docker start local-postgres-dev || {
        echo "❌ Failed to start PostgreSQL. Creating new container..."
        docker run -d \
          --name local-postgres-dev \
          -e POSTGRES_DB=postgres \
          -e POSTGRES_USER=postgres \
          -e POSTGRES_PASSWORD=password \
          -p 5434:5432 \
          postgres:15-alpine
        
        sleep 5
        docker exec local-postgres-dev psql -U postgres -c "CREATE DATABASE IF NOT EXISTS app1_db;"
        docker exec local-postgres-dev psql -U postgres -c "CREATE DATABASE IF NOT EXISTS app2_db;"
    }
else
    echo "✅ PostgreSQL container is running"
fi

echo ""
echo "📋 Next steps to start development:"
echo "1. Open 4 terminal windows"
echo "2. Run these commands in separate terminals:"
echo ""
echo "Terminal 1 - App1 Backend:"
echo "cd ~/projects/mhylle.com/example-app1/backend && npm run start:dev"
echo ""
echo "Terminal 2 - App1 Frontend (with API proxy):"
echo "cd ~/projects/mhylle.com/example-app1/frontend && npm start"
echo ""
echo "Terminal 3 - App2 Backend:"
echo "cd ~/projects/mhylle.com/example-app2/backend && npm run start:dev"
echo ""
echo "Terminal 4 - App2 Frontend (with API proxy):"
echo "cd ~/projects/mhylle.com/example-app2/frontend && npm start -- --port 4201"
echo ""
echo "🌐 Access URLs:"
echo "- App1 Frontend: http://localhost:4200"
echo "- App1 Backend: http://localhost:3000"
echo "- App2 Frontend: http://localhost:4201"
echo "- App2 Backend: http://localhost:3001"
echo "- PostgreSQL: localhost:5434"
echo ""
echo "🔍 Test URLs:"
echo "- App1 Health (direct): http://localhost:3000/health"
echo "- App1 Health (via proxy): http://localhost:4200/api/app1/health"
echo "- App2 Health (direct): http://localhost:3001/health"
echo "- App2 Health (via proxy): http://localhost:4201/api/app2/health"
echo ""
echo "⚠️  IMPORTANT: API calls from frontend now use proxy configuration"
echo "   - Production: /api/app1/* → nginx → backend"
echo "   - Development: /api/app1/* → Angular proxy → localhost:3000"