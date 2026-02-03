FROM python:3.12-slim

WORKDIR /app

# Install build deps for chromadb (needs sqlite3, gcc for hnswlib)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remove build deps to shrink image
RUN apt-get purge -y --auto-remove build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY server.py .

# Persistent memory storage
VOLUME /data/memu

ENV MEMU_PORT=8230
ENV MEMU_DATA_DIR=/data/memu

EXPOSE 8230

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8230/health')" || exit 1

CMD ["python", "server.py"]
