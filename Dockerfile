# DR Agent — Multi-stage build
# Stage 1: Node.js for contract compilation
# Stage 2: Python for API server

# --- Stage 1: Build contracts ---
FROM node:20-slim AS contracts-builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install

COPY hardhat.config.ts tsconfig.json ./
COPY contracts/ contracts/
RUN npx hardhat compile

# --- Stage 2: Python API server ---
FROM python:3.11-slim AS api

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt* ./
RUN pip install --no-cache-dir \
    fastapi uvicorn[standard] pydantic \
    pandas \
    psycopg2-binary \
    2>/dev/null; \
    if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Copy contract artifacts from builder
COPY --from=contracts-builder /app/artifacts/ artifacts/

# Copy application code
COPY services/ services/
COPY asgi_client.py* ./
COPY scripts/*.py scripts/
COPY scripts/*.js scripts/

# Create cache dir
RUN mkdir -p cache

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# Default env
ENV DR_CHAIN_MODE=simulated
ENV DR_DB_BACKEND=sqlite
ENV DR_AGENT_DB=cache/dr_agent.db

EXPOSE 8000

CMD ["uvicorn", "services.api:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
