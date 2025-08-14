Functional Requirements
FR1: Application Independence

FR1.1: Each application shall reside in its own Git repository
FR1.2: Deployment of one application shall not require rebuilding or restarting other applications
FR1.3: Each application shall have its own isolated database within the shared PostgreSQL instance
FR1.4: Application failures shall not cascade to other applications

FR2: Deployment Pipeline

FR2.1: Applications shall be deployed automatically upon push to the main branch
FR2.2: Docker images shall be built in GitHub Actions, not on the production server
FR2.3: Images shall be versioned with both 'latest' tag and commit SHA
FR2.4: Deployment shall support rollback to previous versions

FR3: Routing and Access

FR3.1: Applications shall be accessible via subpaths (e.g., https://mhylle.com/app1)
FR3.2: Backend APIs shall be accessible via /api/appname paths
FR3.3: Static assets shall be served correctly with proper base paths
FR3.4: WebSocket connections shall be properly proxied if needed

FR4: Infrastructure Management

FR4.1: Core infrastructure (Nginx, PostgreSQL) shall be managed separately from applications
FR4.2: New applications shall be registerable with minimal infrastructure changes
FR4.3: SSL/TLS certificates shall be manageable for the main domain

Non-Functional Requirements
NFR1: Performance

NFR1.1: System shall efficiently utilize available server resources (4GB RAM, 3 cores)
NFR1.2: Container startup time shall be under 30 seconds
NFR1.3: Nginx shall handle at least 1000 concurrent connections

NFR2: Security

NFR2.1: Database passwords shall be stored as environment variables
NFR2.2: Containers shall run with minimal privileges
NFR2.3: Network isolation shall be enforced between containers
NFR2.4: GitHub Container Registry authentication shall be required for private images

NFR3: Reliability

NFR3.1: Containers shall automatically restart on failure
NFR3.2: PostgreSQL data shall be persisted in Docker volumes
NFR3.3: System shall survive server reboots

NFR4: Maintainability

NFR4.1: Logs shall be accessible for each application
NFR4.2: Deployment scripts shall be idempotent
NFR4.3: Old Docker images shall be automatically pruned

Technical Constraints

TC1: Ubuntu 24.04 as the host operating system
TC2: Docker and Docker Compose for containerization
TC3: GitHub Actions for CI/CD
TC4: GitHub Container Registry for image storage
TC5: PostgreSQL 15 for database
TC6: Nginx for reverse proxy
TC7: Angular 19+ for frontend
TC8: NestJS 11+ for backend