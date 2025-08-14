#!/bin/bash

# Docker Cleanup Script
# This script safely cleans up unused Docker resources to free up disk space
# Must be run via GitHub Actions deployment, never directly on server

set -e

echo "🧹 Starting Docker cleanup..."

# Remove stopped containers
echo "Removing stopped containers..."
docker container prune -f

# Remove unused images (but keep current running ones)
echo "Removing unused images..."
docker image prune -f

# Remove unused networks
echo "Removing unused networks..."
docker network prune -f

# Remove unused volumes (be careful with this)
echo "Removing unused volumes..."
docker volume prune -f

# Remove build cache
echo "Removing build cache..."
docker buildx prune -f

# Show disk usage after cleanup
echo "📊 Disk usage after cleanup:"
df -h /var/lib/docker

echo "✅ Docker cleanup completed successfully!"
