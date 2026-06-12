# Verified Tool Gating — policy gate + dashboard + PostgreSQL inside one TEE image.
# PostgreSQL is co-located so the decision log lives on the enclave's encrypted
# /data volume and never leaves the TEE.

# --- Stage 1: build the engine (TypeScript -> dist) ---
FROM --platform=linux/amd64 node:20-slim AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY policies ./policies
RUN npm run build

# --- Stage 2: build the dashboard (Vite -> demo-ui/dist) ---
FROM --platform=linux/amd64 node:20-slim AS ui
WORKDIR /ui
COPY demo-ui/package*.json ./
RUN npm ci
COPY demo-ui/ ./
RUN npm run build

# --- Stage 3: runtime (PostgreSQL base + Node) ---
FROM --platform=linux/amd64 postgres:16-bookworm
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=ui /ui/dist ./public
COPY policies ./policies
COPY scripts ./scripts

# The policy hash is computed from this file at build time (see `npm run seal`)
# and pinned here so it enters the TDX attestation measurement.
ARG POLICY_PATH=policies/demo-policy.yaml
ARG POLICY_HASH=unsealed
ENV POLICY_PATH=${POLICY_PATH} \
    POLICY_HASH=${POLICY_HASH} \
    PGDATA=/data/pgdata \
    DATA_DIR=/data \
    PORT=8080 \
    DATABASE_URL=postgresql://gate@127.0.0.1:5432/gate

EXPOSE 8080
VOLUME /data
ENTRYPOINT ["bash", "scripts/entrypoint.sh"]
