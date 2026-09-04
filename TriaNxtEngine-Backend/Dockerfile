# Multi-stage build for TriaNXT CTMS FastAPI Engine
# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for psycopg2 and argon2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libffi-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY tria_engine/requirements/prod.txt /tmp/requirements.txt
COPY tria_engine/requirements/base.txt /tmp/base.txt
# Also copy base requirements since prod.txt references it
RUN pip install --no-cache-dir --prefix=/install -r /tmp/requirements.txt

# Stage 2: Production image
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r trianxt && useradd -r -g trianxt -d /app -s /sbin/nologin trianxt

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libffi8 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code (FastAPI entrypoint + migrations)
COPY alembic.ini /app/
COPY gunicorn_config.py /app/
COPY tria_engine/ /app/tria_engine/

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs && \
    chown -R trianxt:trianxt /app

# Switch to non-root user
USER trianxt

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/')" || exit 1

# Run with Gunicorn + Uvicorn workers
CMD ["gunicorn", "tria_engine.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--config", "gunicorn_config.py"]
