System Architecture
┌────────────────────────────────────────────────────────────────────┐
│                         Internet / Users                           │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Scaleway Server (Ubuntu 24.04)                 │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Nginx Reverse Proxy                      │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ /app1/* → app1-frontend:80                          │  │   │
│  │  │ /api/app1/* → app1-backend:3000                     │  │   │
│  │  │ /app2/* → app2-frontend:80                          │  │   │
│  │  │ /api/app2/* → app2-backend:3000                     │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                               │                                    │
│                    Docker Network (app-network)                    │
│                               │                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     Application Containers                    │ │
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│ │
│  │ │   App1     │ │   App1     │ │   App2     │ │   App2     ││ │
│  │ │  Frontend  │ │  Backend   │ │  Frontend  │ │  Backend   ││ │
│  │ │  (Angular) │ │  (NestJS)  │ │  (Angular) │ │  (NestJS)  ││ │
│  │ └────────────┘ └────────────┘ └────────────┘ └────────────┘│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                               │                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL Container                       │ │
│  │  ┌────────────────────────────────────────────────────────┐  │ │
│  │  │ Databases: app1_db | app2_db | app3_db                │  │ │
│  │  │ Users: app_app1 | app_app2 | app_app3                 │  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
CI/CD Architecture
┌─────────────────────┐         ┌─────────────────────┐
│   Developer Push    │         │   GitHub Actions    │
│   to Main Branch    │────────▶│                     │
└─────────────────────┘         │  1. Build Frontend  │
                                │  2. Build Backend   │
                                │  3. Push to GHCR    │
                                │  4. SSH to Server   │
                                │  5. Run Deploy      │
                                └──────────┬──────────┘
                                           │
                                           ▼
┌─────────────────────┐         ┌─────────────────────┐
│  GitHub Container   │◀────────│  Scaleway Server    │
│     Registry        │         │                     │
│                     │────────▶│  1. Pull Images     │
│  - Frontend Image   │         │  2. Stop Old        │
│  - Backend Image    │         │  3. Start New       │
└─────────────────────┘         └─────────────────────┘
Component Interaction
mermaidsequenceDiagram
    participant User
    participant Nginx
    participant Frontend
    participant Backend
    participant PostgreSQL

    User->>Nginx: GET https://mhylle.com/app1
    Nginx->>Frontend: Proxy to app1-frontend:80
    Frontend-->>User: Return Angular App
    
    User->>Nginx: GET https://mhylle.com/api/app1/data
    Nginx->>Backend: Proxy to app1-backend:3000
    Backend->>PostgreSQL: Query app1_db
    PostgreSQL-->>Backend: Return data
    Backend-->>User: Return JSON response
Repository Structure
Infrastructure Repository:
infrastructure/
├── docker-compose.yml          # Core services
├── nginx/
│   ├── nginx.conf             # Main nginx config
│   └── apps/                  # Per-app configs
│       ├── app1.conf
│       └── app2.conf
├── scripts/
│   ├── setup.sh               # Initial setup
│   ├── deploy-app.sh          # App deployment
│   └── init-databases.sql     # DB initialization
├── ssl/                       # SSL certificates
└── .env                       # Environment variables

Application Repository:
app1/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── angular.json
│   └── src/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
└── .github/
    └── workflows/
        └── deploy.yml