FROM python:3.11-slim

# Install system packages: ffmpeg (for audio/video transcoding), curl, nodejs (JS runtime for yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip yt-dlp && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY backend/ backend/
COPY wsgi.py ./

# Create cache directory
RUN mkdir -p data/cache/analysis

ENV PYTHONPATH=/app
ENV PORT=10000
EXPOSE 10000

# Start Uvicorn bound to 0.0.0.0 and dynamic $PORT provided by Render
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
