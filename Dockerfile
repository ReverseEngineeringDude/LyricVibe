FROM python:3.11-slim

# Install system packages: ffmpeg (for audio/video transcoding), curl, nodejs, git, unzip
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    nodejs \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (official preferred JavaScript runtime for yt-dlp signature solvers)
RUN curl -fsSL https://deno.land/install.sh | bash -s -- -y \
    && mv /root/.deno/bin/deno /usr/local/bin/deno \
    && rm -rf /root/.deno

WORKDIR /app

# Install Python requirements and latest upstream yt-dlp master
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir --upgrade --force-reinstall https://github.com/yt-dlp/yt-dlp/archive/master.tar.gz

# Copy application source
COPY backend/ backend/
COPY frontend/dist/ frontend/dist/
COPY wsgi.py ./

# Create cache directory
RUN mkdir -p data/cache/analysis

ENV PYTHONPATH=/app
ENV PORT=10000
EXPOSE 10000

# Start Uvicorn bound to 0.0.0.0 and dynamic $PORT provided by Render
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
