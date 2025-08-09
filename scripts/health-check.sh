#!/bin/bash

# Health Check Script for mhylle.com Infrastructure
# Monitors all containers and services
# Usage: ./health-check.sh [--verbose] [--app APP_NAME]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
VERBOSE=false
SPECIFIC_APP=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --app|-a)
                SPECIFIC_APP="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [--verbose] [--app APP_NAME]"
                echo "  --verbose    Show detailed output"
                echo "  --app        Check specific application only"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Check Docker daemon
check_docker() {
    if [[ $VERBOSE == true ]]; then
        log "Checking Docker daemon..."
    fi
    
    if ! docker info > /dev/null 2>&1; then
        error "Docker daemon is not running"
        return 1
    fi
    
    if [[ $VERBOSE == true ]]; then
        info "Docker daemon is running"
    fi
    return 0
}

# Check core infrastructure
check_core_infrastructure() {
    if [[ $VERBOSE == true ]]; then
        log "Checking core infrastructure..."
    fi
    
    local core_services=("mhylle-nginx" "mhylle-postgres")
    local failed_services=()
    
    for service in "${core_services[@]}"; do
        local status=$(docker inspect --format='{{.State.Status}}' "$service" 2>/dev/null || echo "not_found")
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "no_health_check")
        
        if [[ "$status" != "running" ]]; then
            failed_services+=("$service (status: $status)")
        elif [[ "$health" == "unhealthy" ]]; then
            failed_services+=("$service (unhealthy)")
        elif [[ $VERBOSE == true ]]; then
            info "$service: running ($health)"
        fi
    done
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        error "Core infrastructure issues:"
        for service in "${failed_services[@]}"; do
            error "  - $service"
        done
        return 1
    fi
    
    if [[ $VERBOSE == true ]]; then
        info "Core infrastructure is healthy"
    fi
    return 0
}

# Check application containers
check_applications() {
    if [[ $VERBOSE == true ]]; then
        log "Checking application containers..."
    fi
    
    local app_containers=()
    local failed_containers=()
    
    # Get all app containers
    if [[ -n "$SPECIFIC_APP" ]]; then
        app_containers=("${SPECIFIC_APP}-frontend" "${SPECIFIC_APP}-backend")
    else
        mapfile -t app_containers < <(docker ps --format '{{.Names}}' | grep -E '.*-(frontend|backend)$' || true)
    fi
    
    if [[ ${#app_containers[@]} -eq 0 ]]; then
        if [[ -n "$SPECIFIC_APP" ]]; then
            warning "No containers found for app: $SPECIFIC_APP"
        else
            warning "No application containers found"
        fi
        return 0
    fi
    
    for container in "${app_containers[@]}"; do
        local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no_health_check")
        local uptime=$(docker inspect --format='{{.State.StartedAt}}' "$container" 2>/dev/null || echo "unknown")
        
        if [[ "$status" != "running" ]]; then
            failed_containers+=("$container (status: $status)")
        elif [[ "$health" == "unhealthy" ]]; then
            failed_containers+=("$container (unhealthy)")
        elif [[ $VERBOSE == true ]]; then
            info "$container: running ($health) since $uptime"
        fi
    done
    
    if [[ ${#failed_containers[@]} -gt 0 ]]; then
        error "Application container issues:"
        for container in "${failed_containers[@]}"; do
            error "  - $container"
        done
        return 1
    fi
    
    if [[ $VERBOSE == true ]]; then
        info "All application containers are healthy"
    fi
    return 0
}

# Check network connectivity
check_network() {
    if [[ $VERBOSE == true ]]; then
        log "Checking network connectivity..."
    fi
    
    # Check if Docker network exists
    if ! docker network inspect mhylle_app-network > /dev/null 2>&1; then
        error "Docker network 'mhylle_app-network' not found"
        return 1
    fi
    
    # Check internet connectivity from nginx container
    if ! docker exec mhylle-nginx ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        warning "Internet connectivity issue from nginx container"
    fi
    
    if [[ $VERBOSE == true ]]; then
        info "Network connectivity is good"
    fi
    return 0
}

# Check disk space
check_disk_space() {
    if [[ $VERBOSE == true ]]; then
        log "Checking disk space..."
    fi
    
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -gt 90 ]]; then
        error "Disk usage is critical: ${usage}%"
        return 1
    elif [[ $usage -gt 80 ]]; then
        warning "Disk usage is high: ${usage}%"
    elif [[ $VERBOSE == true ]]; then
        info "Disk usage: ${usage}%"
    fi
    
    # Check Docker system usage
    local docker_usage=$(docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" | tail -n +2)
    if [[ $VERBOSE == true ]]; then
        info "Docker system usage:"
        echo "$docker_usage"
    fi
    
    return 0
}

# Check memory usage
check_memory() {
    if [[ $VERBOSE == true ]]; then
        log "Checking memory usage..."
    fi
    
    local memory_info=$(free | grep Mem)
    local total=$(echo $memory_info | awk '{print $2}')
    local used=$(echo $memory_info | awk '{print $3}')
    local usage=$((used * 100 / total))
    
    if [[ $usage -gt 90 ]]; then
        error "Memory usage is critical: ${usage}%"
        return 1
    elif [[ $usage -gt 80 ]]; then
        warning "Memory usage is high: ${usage}%"
    elif [[ $VERBOSE == true ]]; then
        info "Memory usage: ${usage}%"
    fi
    
    return 0
}

# Check SSL certificates
check_ssl() {
    if [[ $VERBOSE == true ]]; then
        log "Checking SSL certificates..."
    fi
    
    local cert_file="$INFRA_DIR/ssl/mhylle.com.crt"
    
    if [[ ! -f "$cert_file" ]]; then
        warning "SSL certificate not found: $cert_file"
        return 1
    fi
    
    # Check certificate expiration
    local expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [[ $days_until_expiry -lt 7 ]]; then
        error "SSL certificate expires in $days_until_expiry days"
        return 1
    elif [[ $days_until_expiry -lt 30 ]]; then
        warning "SSL certificate expires in $days_until_expiry days"
    elif [[ $VERBOSE == true ]]; then
        info "SSL certificate expires in $days_until_expiry days"
    fi
    
    return 0
}

# Check application endpoints
check_endpoints() {
    if [[ $VERBOSE == true ]]; then
        log "Checking application endpoints..."
    fi
    
    local failed_endpoints=()
    
    # Check main health endpoint
    if ! curl -f -s "https://mhylle.com/health" > /dev/null 2>&1; then
        failed_endpoints+=("https://mhylle.com/health")
    fi
    
    # Check application-specific endpoints
    local apps=()
    if [[ -n "$SPECIFIC_APP" ]]; then
        apps=("$SPECIFIC_APP")
    else
        mapfile -t apps < <(docker ps --format '{{.Names}}' | grep -E '.*-backend$' | sed 's/-backend$//' || true)
    fi
    
    for app in "${apps[@]}"; do
        local health_url="https://mhylle.com/health/$app"
        local app_url="https://mhylle.com/$app"
        
        if ! curl -f -s "$health_url" > /dev/null 2>&1; then
            failed_endpoints+=("$health_url")
        fi
        
        if ! curl -f -s "$app_url" > /dev/null 2>&1; then
            failed_endpoints+=("$app_url")
        fi
    done
    
    if [[ ${#failed_endpoints[@]} -gt 0 ]]; then
        error "Endpoint check failures:"
        for endpoint in "${failed_endpoints[@]}"; do
            error "  - $endpoint"
        done
        return 1
    fi
    
    if [[ $VERBOSE == true ]]; then
        info "All endpoints are responding"
    fi
    return 0
}

# Generate health report
generate_report() {
    local overall_status="HEALTHY"
    local issues=()
    
    echo "=================================================="
    echo "mhylle.com Infrastructure Health Report"
    echo "Generated: $(date)"
    echo "=================================================="
    echo ""
    
    # Run all checks
    local checks=(
        "check_docker:Docker Daemon"
        "check_core_infrastructure:Core Infrastructure"
        "check_applications:Applications"
        "check_network:Network"
        "check_disk_space:Disk Space"
        "check_memory:Memory"
        "check_ssl:SSL Certificates"
        "check_endpoints:Endpoints"
    )
    
    for check in "${checks[@]}"; do
        local func=$(echo $check | cut -d: -f1)
        local name=$(echo $check | cut -d: -f2)
        
        printf "%-20s: " "$name"
        if $func; then
            echo -e "${GREEN}PASS${NC}"
        else
            echo -e "${RED}FAIL${NC}"
            overall_status="UNHEALTHY"
            issues+=("$name")
        fi
    done
    
    echo ""
    echo "Overall Status: $overall_status"
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "Issues found:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        return 1
    fi
    
    return 0
}

# Main function
main() {
    parse_args "$@"
    
    if [[ $VERBOSE == true ]]; then
        log "Starting health check..."
        if [[ -n "$SPECIFIC_APP" ]]; then
            log "Checking specific app: $SPECIFIC_APP"
        fi
    fi
    
    generate_report
}

# Run main function
main "$@"
