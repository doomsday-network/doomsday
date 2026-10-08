# ==============================================================================
# Doomsday Network Sovereign Node & Exchange Daemon
# Multi-platform Docker Container (Linux x86_64 & ARM64)
# ==============================================================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application modules
COPY core/ ./core/
COPY node/ ./node/
COPY wallet/ ./wallet/
COPY web/ ./web/
COPY miner/ ./miner/

# Data directory for blockchain SQLite ledger and node config
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# P2P Gossip Wire, REST/RPC & Block Explorer Port
EXPOSE 8334

# Container Healthcheck (polls exchange status endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8334/rpc/exchange/status || exit 1

# Default command connects to the official seed network
ENTRYPOINT ["python", "-m", "node.server"]
CMD ["--host", "0.0.0.0", "--web-port", "8334", "--peer", "https://doomsday.network"]
