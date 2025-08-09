#!/bin/bash

# mhylle.com Infrastructure Setup Script
# Sets up the complete infrastructure on Ubuntu 24.04
# Usage: ./setup.sh

set -e

# Configuration
DOMAIN="mhylle.com"
SERVER_IP="51.159.168.239"
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}
GITHUB_USERNAME=${GITHUB_USERNAME:-"mhylle"}
GITHUB_TOKEN=${GITHUB_TOKEN:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    sudo apt update
    sudo apt upgrade -y
    sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Remove old Docker versions
    sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install Docker using the convenience script
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    log "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Create docker-compose symlink
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    info "Docker installation completed. You may need to log out and back in for group changes to take effect."
}

# Install Certbot for SSL certificates
install_certbot() {
    log "Installing Certbot for SSL certificates..."
    sudo apt install -y certbot python3-certbot-nginx
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    # Infrastructure directories
    mkdir -p /home/$USER/infrastructure/logs/{nginx,postgres}
    mkdir -p /home/$USER/infrastructure/ssl
    mkdir -p /var/www/certbot
    
    # Docker volumes directory
    sudo mkdir -p /var/lib/docker/volumes/mhylle_postgres_data
    sudo chown -R $USER:$USER /home/$USER/infrastructure/
    
    # Set proper permissions
    chmod 755 /home/$USER/infrastructure/scripts/*.sh 2>/dev/null || true
}

# Configure firewall
configure_firewall() {
    log "Configuring UFW firewall..."
    
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow Docker daemon (local only)
    sudo ufw allow from 172.17.0.0/16 to any port 2376
    
    sudo ufw reload
    info "Firewall configured successfully"
}

# Setup GitHub Container Registry authentication
setup_github_auth() {
    log "Setting up GitHub Container Registry authentication..."
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        warning "GITHUB_TOKEN not provided. You'll need to authenticate manually later."
        warning "Generate a personal access token with 'read:packages' scope at:"
        warning "https://github.com/settings/tokens"
        return
    fi
    
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
    info "GitHub Container Registry authentication configured"
}

# Generate SSL certificates
generate_ssl_certificates() {
    log "Generating SSL certificates..."
    
    # Create self-signed certificates for initial setup
    # These will be replaced by Let's Encrypt certificates later
    
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /home/$USER/infrastructure/ssl/${DOMAIN}.key \
        -out /home/$USER/infrastructure/ssl/${DOMAIN}.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=${DOMAIN}"
    
    sudo chown $USER:$USER /home/$USER/infrastructure/ssl/*
    sudo chmod 600 /home/$USER/infrastructure/ssl/${DOMAIN}.key
    sudo chmod 644 /home/$USER/infrastructure/ssl/${DOMAIN}.crt
    
    info "Self-signed SSL certificates generated"
    info "Run './scripts/setup-letsencrypt.sh' after DNS is configured to get Let's Encrypt certificates"
}

# Create environment file
create_env_file() {
    log "Creating environment configuration..."
    
    cat > /home/$USER/infrastructure/.env << EOF
# PostgreSQL Configuration
POSTGRES_DB=mhylle_main
POSTGRES_USER=mhylle_admin
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Server Configuration
DOMAIN=${DOMAIN}
SERVER_IP=${SERVER_IP}

# GitHub Configuration
GITHUB_USERNAME=${GITHUB_USERNAME}

# Application Configuration
NODE_ENV=production
EOF

    chmod 600 /home/$USER/infrastructure/.env
    info "Environment file created at /home/$USER/infrastructure/.env"
    info "PostgreSQL password: ${POSTGRES_PASSWORD}"
}

# Start core services
start_core_services() {
    log "Starting core infrastructure services..."
    
    cd /home/$USER/infrastructure
    
    # Pull latest images
    docker-compose pull
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
    
    # Check service status
    docker-compose ps
    
    info "Core services started successfully"
}

# Create useful aliases
create_aliases() {
    log "Creating useful aliases..."
    
    cat >> ~/.bashrc << 'EOF'

# mhylle.com Infrastructure Aliases
alias infra-logs='cd ~/infrastructure && docker-compose logs -f'
alias infra-status='cd ~/infrastructure && docker-compose ps'
alias infra-restart='cd ~/infrastructure && docker-compose restart'
alias infra-stop='cd ~/infrastructure && docker-compose stop'
alias infra-start='cd ~/infrastructure && docker-compose start'
alias app-deploy='~/infrastructure/scripts/deploy-app.sh'
alias app-logs='docker logs -f'
alias app-list='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
EOF

    info "Aliases added to ~/.bashrc"
}

# Main setup function
main() {
    log "Starting mhylle.com infrastructure setup..."
    
    check_root
    update_system
    install_docker
    install_certbot
    create_directories
    configure_firewall
    setup_github_auth
    generate_ssl_certificates
    create_env_file
    start_core_services
    create_aliases
    
    log "Infrastructure setup completed successfully!"
    echo ""
    info "Next steps:"
    info "1. Configure DNS to point ${DOMAIN} to ${SERVER_IP}"
    info "2. Run './scripts/setup-letsencrypt.sh' to get SSL certificates"
    info "3. Update GitHub secrets with deployment credentials"
    info "4. Deploy your first application"
    echo ""
    warning "Please log out and back in to apply Docker group changes"
    warning "Save your PostgreSQL password: ${POSTGRES_PASSWORD}"
}

# Run main function
main "$@"
