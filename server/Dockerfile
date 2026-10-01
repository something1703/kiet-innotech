# InnoTech'26 API. Runs migrations separately: `docker run <image> alembic upgrade head`.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app

# Run as an unprivileged user.
RUN useradd --create-home --uid 10001 api
USER api

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
# Workers: WEB_CONCURRENCY (uvicorn reads it). --proxy-headers trusts X-Forwarded-* from Caddy; that is safe only
# because port 8000 is never published outside the Docker network (see deploy/compose.yml).
# --timeout-keep-alive must exceed the proxy's idle timeout (Caddy keeps upstream connections for 2 minutes), or a
# request can reach a connection uvicorn is just closing and fail with a connection reset.
ENV WEB_CONCURRENCY=3
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--timeout-keep-alive", "130"]
