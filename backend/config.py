import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

def _convert_to_netscape(cookies_content: str) -> str:
    content = cookies_content.strip()
    # Unescape literal \n and \t if pasted via single-line env variable
    if "\\n" in content and "\n" not in content:
        content = content.replace("\\n", "\n").replace("\\t", "\t")

    # Check if JSON format (e.g. exported from Cookie-Editor extension)
    if content.startswith("[") and content.endswith("]"):
        try:
            import json
            items = json.loads(content)
            lines = ["# Netscape HTTP Cookie File\n"]
            for c in items:
                domain = c.get("domain", ".youtube.com")
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                path = c.get("path", "/")
                secure = "TRUE" if c.get("secure", True) else "FALSE"
                expiry = str(int(c.get("expirationDate") or c.get("expiry") or 2147483647))
                name = c.get("name", "")
                val = c.get("value", "")
                if name:
                    lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{expiry}\t{name}\t{val}\n")
            return "".join(lines)
        except Exception:
            pass

    # Check if raw Cookie header string (e.g. "key=val; key2=val2")
    if "=" in content and "\t" not in content and not content.startswith("#"):
        lines = ["# Netscape HTTP Cookie File\n"]
        pairs = [p.strip() for p in content.split(";") if p.strip()]
        for pair in pairs:
            if "=" in pair:
                k, v = pair.split("=", 1)
                lines.append(f".youtube.com\tTRUE\t/\tTRUE\t2147483647\t{k.strip()}\t{v.strip()}\n")
        return "".join(lines)

    # Ensure Netscape file header exists
    if not content.startswith("# Netscape") and not content.startswith("# HTTP"):
        content = "# Netscape HTTP Cookie File\n" + content

    return content


# Optional cookies file or cookies text for yt-dlp to bypass bot/sign-in challenges
YTDLP_COOKIES_FILE = os.getenv("YTDLP_COOKIES_FILE", None)
if not YTDLP_COOKIES_FILE:
    cookies_content = os.getenv("YTDLP_COOKIES_TEXT") or os.getenv("YTDLP_COOKIES_CONTENT")
    if cookies_content and cookies_content.strip():
        cookie_path = Path("/tmp/yt_cookies.txt")
        try:
            formatted = _convert_to_netscape(cookies_content)
            cookie_path.write_text(formatted)
            YTDLP_COOKIES_FILE = str(cookie_path)
        except Exception:
            pass


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
