#!/bin/bash
set -e

# n8n Installation Script for Ubuntu 24.04
# This script installs n8n using Docker to avoid conflicts with existing services

echo "======================================"
echo "n8n Installation Script"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "Please run as root (use sudo)"
   exit 1
fi

# Update system packages
echo "Updating system packages..."
apt-get update

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get install -y ca-certificates curl gnupg lsb-release

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    echo "Docker installed successfully!"
else
    echo "Docker is already installed."
fi

# Create n8n data directory
echo "Creating n8n data directory..."
mkdir -p /opt/n8n
chmod 755 /opt/n8n

# Create docker-compose file for n8n
echo "Creating docker-compose configuration..."
cat > /opt/n8n/docker-compose.yml <<'EOF'
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - GENERIC_TIMEZONE=Asia/Seoul
      - TZ=Asia/Seoul
      - WEBHOOK_URL=http://168.107.21.4:5678/
    volumes:
      - /opt/n8n/data:/home/node/.n8n
    networks:
      - n8n-network

networks:
  n8n-network:
    driver: bridge
EOF

# Start n8n container
echo "Starting n8n container..."
cd /opt/n8n
docker compose up -d

# Wait for n8n to start
echo "Waiting for n8n to start..."
sleep 10

# Check if n8n is running
if docker ps | grep -q n8n; then
    echo ""
    echo "======================================"
    echo "✓ n8n installed successfully!"
    echo "======================================"
    echo ""
    echo "Access n8n at: http://168.107.21.4:5678"
    echo ""
    echo "Important: Configure Oracle Cloud firewall to allow port 5678"
    echo ""
    echo "Useful commands:"
    echo "  - Check status:  docker ps"
    echo "  - View logs:     docker logs n8n"
    echo "  - Stop n8n:      cd /opt/n8n && docker compose down"
    echo "  - Start n8n:     cd /opt/n8n && docker compose up -d"
    echo "  - Restart n8n:   docker restart n8n"
    echo ""
else
    echo "Error: n8n container failed to start"
    echo "Check logs with: docker logs n8n"
    exit 1
fi
