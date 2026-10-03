import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Optional cookies file for yt-dlp to bypass bot/sign-in challenges
YTDLP_COOKIES_FILE = os.getenv("YTDLP_COOKIES_FILE", None)

# Upload directory for fallback user audio
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Frontend build distribution directory
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

# Rate limiting (requests per client IP per minute)
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

# Caching TTL configurations (seconds)
STREAM_CACHE_TTL_SEC = int(os.getenv("STREAM_CACHE_TTL_SEC", "2400"))  # 40 minutes
LYRICS_CACHE_TTL_SEC = int(os.getenv("LYRICS_CACHE_TTL_SEC", "86400")) # 24 hours
SEARCH_CACHE_TTL_SEC = int(os.getenv("SEARCH_CACHE_TTL_SEC", "1800"))  # 30 minutes
TRACK_CACHE_TTL_SEC = int(os.getenv("TRACK_CACHE_TTL_SEC", "3600"))    # 60 minutes
