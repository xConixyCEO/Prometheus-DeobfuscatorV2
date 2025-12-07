# ============================================================
# Dockerfile for Prometheus-DeobfuscatorV2
# ============================================================

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# ------------------------------------------------------------
# Install system deps
# ------------------------------------------------------------
RUN apt-get update && apt-get install -y \
    git curl build-essential unzip \
    lua5.1 lua5.1-dev luarocks \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# Install Node.js (Render supports 18 LTS normally)
# ------------------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# ------------------------------------------------------------
# Copy project files
# ------------------------------------------------------------
COPY . .

# ------------------------------------------------------------
# Install backend deps
# ------------------------------------------------------------
RUN npm install --production

# ------------------------------------------------------------
# Configure service
# ------------------------------------------------------------
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
