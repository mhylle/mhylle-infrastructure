#!/bin/bash

# Database Backup Script for mhylle.com Infrastructure
# Backs up PostgreSQL databases with rotation
# Usage: ./backup-db.sh [--app APP_NAME] [--retention DAYS]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="/home/$USER/backups/database"
RETENTION_DAYS=30
SPECIFIC_APP=""
POSTGRES_CONTAINER="mhylle-postgres"

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
            --app|-a)
                SPECIFIC_APP="$2"
                shift 2
                ;;
            --retention|-r)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [--app APP_NAME] [--retention DAYS]"
                echo "  --app        Backup specific application database only"
                echo "  --retention  Number of days to keep backups (default: 30)"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Load environment variables
load_environment() {
    if [[ -f "$INFRA_DIR/.env" ]]; then
        source "$INFRA_DIR/.env"
    else
        error "Environment file not found: $INFRA_DIR/.env"
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log "Backup directory: $BACKUP_DIR"
}

# Check prerequisites
check_prerequisites() {
    # Check if PostgreSQL container is running
    if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
        error "PostgreSQL container is not running: $POSTGRES_CONTAINER"
        exit 1
    fi
    
    # Check if pg_dump is available in container
    if ! docker exec "$POSTGRES_CONTAINER" which pg_dump > /dev/null; then
        error "pg_dump not found in PostgreSQL container"
        exit 1
    fi
}

# Get list of databases to backup
get_databases() {
    local databases=()
    
    if [[ -n "$SPECIFIC_APP" ]]; then
        databases=("${SPECIFIC_APP}_db")
    else
        # Get all application databases
        mapfile -t databases < <(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT datname FROM pg_database WHERE datname LIKE '%_db';" | grep -v "^\s*$" | tr -d ' ')
        
        # Add main database
        databases+=("$POSTGRES_DB")
    fi
    
    echo "${databases[@]}"
}

# Backup single database
backup_database() {
    local db_name="$1"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/${db_name}_${timestamp}.sql"
    local compressed_file="${backup_file}.gz"
    
    log "Backing up database: $db_name"
    
    # Create database dump
    if docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$db_name" --verbose --clean --if-exists --create > "$backup_file" 2>/dev/null; then
        # Compress the backup
        gzip "$backup_file"
        
        # Get file size
        local size=$(du -h "$compressed_file" | cut -f1)
        
        log "Backup completed: $compressed_file ($size)"
        
        # Create metadata file
        cat > "${compressed_file}.meta" << EOF
database: $db_name
timestamp: $timestamp
size: $size
hostname: $(hostname)
postgres_version: $(docker exec "$POSTGRES_CONTAINER" postgres --version)
backup_command: pg_dump -U $POSTGRES_USER -d $db_name --verbose --clean --if-exists --create
EOF
        
        return 0
    else
        error "Failed to backup database: $db_name"
        rm -f "$backup_file"
        return 1
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    while IFS= read -r -d '' file; do
        rm -f "$file" "${file%.gz}.meta"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log "Deleted $deleted_count old backup files"
    else
        info "No old backups to clean up"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        return 1
    fi
    
    # Check if file is a valid gzip file
    if ! gzip -t "$backup_file" 2>/dev/null; then
        return 1
    fi
    
    # Check if SQL content looks valid
    if ! zcat "$backup_file" | head -20 | grep -q "PostgreSQL database dump"; then
        return 1
    fi
    
    return 0
}

# Generate backup report
generate_report() {
    local databases=($1)
    local total_size=0
    local successful_backups=0
    local failed_backups=0
    
    echo ""
    echo "=================================================="
    echo "Database Backup Report"
    echo "Generated: $(date)"
    echo "Retention: $RETENTION_DAYS days"
    echo "=================================================="
    echo ""
    
    # Check recent backups
    for db in "${databases[@]}"; do
        local latest_backup=$(find "$BACKUP_DIR" -name "${db}_*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)
        
        if [[ -n "$latest_backup" && -f "$latest_backup" ]]; then
            local size=$(du -h "$latest_backup" | cut -f1)
            local date=$(date -r "$latest_backup" "+%Y-%m-%d %H:%M:%S")
            
            if verify_backup "$latest_backup"; then
                echo "✓ $db: $size ($date)"
                ((successful_backups++))
            else
                echo "✗ $db: CORRUPTED ($date)"
                ((failed_backups++))
            fi
            
            # Add to total size (convert to bytes for calculation)
            local size_bytes=$(du -b "$latest_backup" | cut -f1)
            total_size=$((total_size + size_bytes))
        else
            echo "✗ $db: NO BACKUP FOUND"
            ((failed_backups++))
        fi
    done
    
    echo ""
    echo "Summary:"
    echo "  Successful: $successful_backups"
    echo "  Failed: $failed_backups"
    echo "  Total size: $(numfmt --to=iec-i --suffix=B $total_size)"
    echo "  Backup directory: $BACKUP_DIR"
    
    # Disk usage
    local disk_usage=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "Unknown")
    echo "  Disk usage: $disk_usage"
    
    # Available space
    local available=$(df -h "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    echo "  Available space: $available"
    
    return $failed_backups
}

# Main backup function
main() {
    parse_args "$@"
    load_environment
    create_backup_dir
    check_prerequisites
    
    log "Starting database backup process..."
    if [[ -n "$SPECIFIC_APP" ]]; then
        log "Backing up specific app: $SPECIFIC_APP"
    fi
    
    # Get databases to backup
    local databases_array=($(get_databases))
    
    if [[ ${#databases_array[@]} -eq 0 ]]; then
        warning "No databases found to backup"
        exit 0
    fi
    
    log "Found ${#databases_array[@]} database(s) to backup"
    
    # Backup each database
    local failed_count=0
    for db in "${databases_array[@]}"; do
        if ! backup_database "$db"; then
            ((failed_count++))
        fi
    done
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    if generate_report "${databases_array[*]}"; then
        log "Backup process completed successfully!"
    else
        error "Backup process completed with $failed_count failures"
        exit 1
    fi
}

# Run main function
main "$@"
