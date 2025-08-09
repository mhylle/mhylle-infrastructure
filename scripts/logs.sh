#!/bin/bash

# Log Aggregation Script for mhylle.com Infrastructure
# Aggregates and displays logs from all containers
# Usage: ./logs.sh [--app APP_NAME] [--service SERVICE] [--tail N] [--follow]

set -e

# Configuration
TAIL_LINES=100
FOLLOW=false
SPECIFIC_APP=""
SPECIFIC_SERVICE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --app|-a)
                SPECIFIC_APP="$2"
                shift 2
                ;;
            --service|-s)
                SPECIFIC_SERVICE="$2"
                shift 2
                ;;
            --tail|-t)
                TAIL_LINES="$2"
                shift 2
                ;;
            --follow|-f)
                FOLLOW=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --app APP_NAME     Show logs for specific application"
                echo "  --service SERVICE  Show logs for specific service (nginx, postgres, etc.)"
                echo "  --tail N          Show last N lines (default: 100)"
                echo "  --follow          Follow log output"
                echo ""
                echo "Examples:"
                echo "  $0 --app app1 --follow"
                echo "  $0 --service nginx --tail 50"
                echo "  $0 --follow"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Get list of containers to monitor
get_containers() {
    local containers=()
    
    if [[ -n "$SPECIFIC_APP" ]]; then
        # Get containers for specific app
        mapfile -t containers < <(docker ps --format '{{.Names}}' | grep -E "^${SPECIFIC_APP}-(frontend|backend)$" || true)
    elif [[ -n "$SPECIFIC_SERVICE" ]]; then
        # Get specific service container
        case "$SPECIFIC_SERVICE" in
            nginx)
                containers=("mhylle-nginx")
                ;;
            postgres|db)
                containers=("mhylle-postgres")
                ;;
            watchtower)
                containers=("mhylle-watchtower")
                ;;
            *)
                # Try to find container by name
                if docker ps --format '{{.Names}}' | grep -q "^${SPECIFIC_SERVICE}$"; then
                    containers=("$SPECIFIC_SERVICE")
                else
                    error "Unknown service: $SPECIFIC_SERVICE"
                    exit 1
                fi
                ;;
        esac
    else
        # Get all containers
        mapfile -t containers < <(docker ps --format '{{.Names}}' | grep -E "^(mhylle-|.*-(frontend|backend))$" || true)
    fi
    
    echo "${containers[@]}"
}

# Show logs for a single container
show_container_logs() {
    local container="$1"
    local title_color=""
    
    # Determine color based on container type
    case "$container" in
        *-frontend)
            title_color="$CYAN"
            ;;
        *-backend)
            title_color="$BLUE"
            ;;
        mhylle-nginx)
            title_color="$GREEN"
            ;;
        mhylle-postgres)
            title_color="$YELLOW"
            ;;
        *)
            title_color="$NC"
            ;;
    esac
    
    echo -e "${title_color}========================================${NC}"
    echo -e "${title_color} Container: $container${NC}"
    echo -e "${title_color}========================================${NC}"
    
    local docker_args=()
    
    if [[ $FOLLOW == true ]]; then
        docker_args+=("--follow")
    fi
    
    docker_args+=("--tail" "$TAIL_LINES")
    docker_args+=("--timestamps")
    docker_args+=("$container")
    
    # Add container name to each log line for identification
    docker logs "${docker_args[@]}" 2>&1 | sed "s/^/${title_color}[$container]${NC} /"
    
    echo ""
}

# Show aggregated logs from multiple containers
show_aggregated_logs() {
    local containers=($1)
    
    if [[ ${#containers[@]} -eq 0 ]]; then
        warning "No containers found to show logs for"
        exit 0
    fi
    
    if [[ $FOLLOW == true ]]; then
        log "Following logs from ${#containers[@]} container(s)..."
        log "Press Ctrl+C to stop"
        echo ""
        
        # Use docker-compose logs if available, otherwise fall back to individual containers
        if command -v docker-compose &> /dev/null && [[ -f "docker-compose.yml" ]]; then
            # Try to use docker-compose for better log aggregation
            local compose_services=()
            for container in "${containers[@]}"; do
                case "$container" in
                    mhylle-nginx) compose_services+=("nginx") ;;
                    mhylle-postgres) compose_services+=("postgres") ;;
                    mhylle-watchtower) compose_services+=("watchtower") ;;
                esac
            done
            
            if [[ ${#compose_services[@]} -gt 0 ]]; then
                docker-compose logs --follow --tail="$TAIL_LINES" "${compose_services[@]}"
            else
                # Fallback to individual container logs
                for container in "${containers[@]}"; do
                    docker logs --follow --tail="$TAIL_LINES" --timestamps "$container" 2>&1 &
                done
                wait
            fi
        else
            # Run docker logs for each container in background
            for container in "${containers[@]}"; do
                (docker logs --follow --tail="$TAIL_LINES" --timestamps "$container" 2>&1 | sed "s/^/[$container] /") &
            done
            wait
        fi
    else
        # Show static logs from each container
        for container in "${containers[@]}"; do
            show_container_logs "$container"
        done
    fi
}

# Show log statistics
show_log_stats() {
    local containers=($1)
    
    echo "=================================================="
    echo "Log Statistics"
    echo "Generated: $(date)"
    echo "=================================================="
    echo ""
    
    for container in "${containers[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            local log_size=$(docker logs --timestamps "$container" 2>&1 | wc -l)
            local status=$(docker inspect --format='{{.State.Status}}' "$container")
            local uptime=$(docker inspect --format='{{.State.StartedAt}}' "$container")
            
            printf "%-20s: %8d lines (Status: %s, Started: %s)\n" "$container" "$log_size" "$status" "$uptime"
        else
            printf "%-20s: %8s (Container not found)\n" "$container" "N/A"
        fi
    done
    
    echo ""
}

# Search logs for specific pattern
search_logs() {
    local pattern="$1"
    local containers=($2)
    
    log "Searching for pattern: $pattern"
    echo ""
    
    for container in "${containers[@]}"; do
        echo -e "${CYAN}Searching in $container:${NC}"
        docker logs --timestamps "$container" 2>&1 | grep -i --color=always "$pattern" || echo "  No matches found"
        echo ""
    done
}

# Main function
main() {
    parse_args "$@"
    
    # Get containers to monitor
    local containers_array=($(get_containers))
    
    if [[ ${#containers_array[@]} -eq 0 ]]; then
        if [[ -n "$SPECIFIC_APP" ]]; then
            error "No containers found for app: $SPECIFIC_APP"
        elif [[ -n "$SPECIFIC_SERVICE" ]]; then
            error "No containers found for service: $SPECIFIC_SERVICE"
        else
            error "No containers found"
        fi
        exit 1
    fi
    
    # Show what we're monitoring
    if [[ -n "$SPECIFIC_APP" ]]; then
        log "Showing logs for app: $SPECIFIC_APP"
    elif [[ -n "$SPECIFIC_SERVICE" ]]; then
        log "Showing logs for service: $SPECIFIC_SERVICE"
    else
        log "Showing logs for all containers"
    fi
    
    info "Monitoring ${#containers_array[@]} container(s): ${containers_array[*]}"
    echo ""
    
    # Show statistics first if not following
    if [[ $FOLLOW == false ]]; then
        show_log_stats "${containers_array[*]}"
    fi
    
    # Show the logs
    show_aggregated_logs "${containers_array[*]}"
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Log monitoring stopped${NC}"; exit 0' INT

# Run main function
main "$@"
