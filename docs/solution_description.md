Solution DescriptionExecutive Summary
This solution provides a containerized infrastructure for deploying multiple independent web applications on a single Scaleway server. Each application consists of an Angular frontend and NestJS backend, deployed through GitHub Actions CI/CD pipelines. The architecture ensures complete deployment independence while sharing core infrastructure resources efficiently.Business Context
The solution addresses the need for a small-to-medium scale deployment infrastructure that can host multiple web applications under a single domain (mhylle.com) using subpath routing. This approach is cost-effective for projects that don't require the complexity of Kubernetes but need more sophistication than basic shared hosting.Core Problem Statement
Deploy multiple full-stack web applications independently on a single server with the following constraints:

Limited server resources (4GB RAM, 3 cores)
Each application must be independently deployable without affecting others
Applications must be accessible via subpaths (not subdomains)
Shared database infrastructure for resource efficiency
Automated deployment through GitHub Actions
No build processes on the production server
Solution Approach
The infrastructure uses Docker containers orchestrated through docker-compose for core services (Nginx, PostgreSQL), while individual applications are deployed as standalone containers. GitHub Actions builds optimized Docker images and deploys them to the server, ensuring the production environment only runs pre-built, tested images.