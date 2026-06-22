# syntax=docker/dockerfile:1

FROM python:3.14-slim AS base
# WeasyPrint (PDF reports) needs pango/cairo + harfbuzz/fontconfig/freetype
# native libs, or `import weasyprint` fails with "cannot load libgobject-2.0-0".
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libharfbuzz-subset0 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./

# ── Development ──
FROM base AS development
RUN uv sync --frozen
COPY . .
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", \
     "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Production ──
FROM base AS production
RUN uv sync --frozen --no-dev
COPY . .
RUN groupadd -r appgroup -g 1001 && \
    useradd -r -u 1001 -g appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser
EXPOSE 8000
ENV PATH="/app/.venv/bin:$PATH"
# 127.0.0.1, not localhost: uvicorn binds IPv4 0.0.0.0, so ::1 can be refused.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" \
  || exit 1
# Shell form + `exec` so ${WEB_CONCURRENCY} expands at runtime while uvicorn
# still becomes the process that receives signals (PID 1 is docker-init via the
# compose `init: true`). Defaults to 2 workers if WEB_CONCURRENCY is unset.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2}"]