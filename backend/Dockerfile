# =============================================================================
# Party4R Backend — production Dockerfile
# Portable image runnable on any VPS / PaaS / Kubernetes cluster.
# =============================================================================

FROM python:3.11.9-slim AS runtime

# Set non-root user for security (Docker best practice)
RUN useradd --create-home --shell /bin/bash party && \
    mkdir -p /app && chown party:party /app

WORKDIR /app

# System deps for bcrypt + cryptography wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libffi-dev build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cache layer)
COPY --chown=party:party requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY --chown=party:party . /app

USER party

# Health check (used by docker-compose, k8s, Caddy, etc.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8001/api/health || exit 1

EXPOSE 8001

# Workers default to 2; tune via WEB_CONCURRENCY env var at deploy time.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port 8001 --workers ${WEB_CONCURRENCY:-2} --timeout-keep-alive 75"]
