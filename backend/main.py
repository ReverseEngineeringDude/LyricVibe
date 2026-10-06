import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import FRONTEND_DIST
from backend.services.cache import check_rate_limit
from backend.routers import search, track, stream, lyrics, convert, analysis

app = FastAPI(
    title="LyricVibe API",
    description="Music Player + Lyrics Status/Story Generator Backend",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Content-Length", "Accept-Ranges"],
)


# Rate limiting & error shaping middleware
@app.middleware("http")
async def rate_limit_and_error_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Only apply rate limit to /api/ routes
    if request.url.path.startswith("/api/"):
        if not check_rate_limit(client_ip):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please slow down.",
                },
            )

    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": str(exc),
            },
        )


# Global HTTPException handler for standardized error shape: {error: code, message: text}
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "HTTP_ERROR", "message": str(exc.detail)},
    )


# Include API Routers
app.include_router(search.router)
app.include_router(track.router)
app.include_router(stream.router)
app.include_router(lyrics.router)
app.include_router(convert.router)
app.include_router(analysis.router)


@app.get("/health")
@app.get("/api/health")
async def health_check():
    import yt_dlp
    import shutil
    from backend.config import YTDLP_COOKIES_FILE
    has_cookies = bool(YTDLP_COOKIES_FILE and os.path.exists(YTDLP_COOKIES_FILE))
    return {
        "status": "ok",
        "service": "LyricVibe",
        "build_tag": "2026-10-04-v5-ejs-cookies",
        "ytdlp_version": getattr(yt_dlp, "__version__", None) or getattr(getattr(yt_dlp, "version", None), "__version__", "unknown"),
        "has_cookies": has_cookies,
        "has_deno": bool(shutil.which("deno")),
        "has_node": bool(shutil.which("node") or shutil.which("nodejs")),
    }


@app.get("/api/debug/test-extract/{video_id}")
async def debug_test_extract(video_id: str):
    from backend.config import YTDLP_COOKIES_FILE
    import yt_dlp
    from pathlib import Path

    cookies_info = "no cookies file"
    if YTDLP_COOKIES_FILE and os.path.exists(YTDLP_COOKIES_FILE):
        content = Path(YTDLP_COOKIES_FILE).read_text()
        lines = [l for l in content.splitlines() if l.strip() and not l.startswith("#")]
        cookies_info = f"size={len(content)}, valid_lines={len(lines)}"

    results = {}
    clients_to_test = [
        ("visionos", True),
        ("visionos", False),
        ("android", True),
        ("android", False),
        ("web_safari", True),
        ("web_embedded", True),
        ("web", True),
    ]
    for client, wants_cookies in clients_to_test:
        use_c = wants_cookies and bool(YTDLP_COOKIES_FILE and os.path.exists(YTDLP_COOKIES_FILE))
        key = f"{client}_cookies_{use_c}"
        opts = {
            "quiet": True,
            "skip_download": True,
            "format": "all",
            "remote_components": ["ejs:github"],
            "extractor_args": {"youtube": {"player_client": [client]}},
        }
        if use_c:
            opts["cookiefile"] = YTDLP_COOKIES_FILE
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                formats = info.get("formats", [])
                audio = [f for f in formats if f.get("acodec") != "none" and f.get("url")]
                results[key] = f"SUCCESS: {len(formats)} formats, {len(audio)} audio streams"
        except Exception as e:
            results[key] = f"ERROR: {str(e)[:180]}"

    return {
        "cookies_info": cookies_info,
        "results": results,
    }


# Serve custom language fonts from fonts/ directory
FONTS_DIR = Path(__file__).resolve().parent.parent / "fonts"
if not FONTS_DIR.exists():
    FONTS_DIR = FRONTEND_DIST / "fonts"

if FONTS_DIR.exists():
    app.mount("/fonts", StaticFiles(directory=FONTS_DIR), name="fonts")


@app.get("/api/fonts")
async def get_fonts():
    """
    Returns list of all available fonts inside fonts/ directory.
    Files follow pattern: [LANG_CODE]_[FontName].[ttf|otf|woff2|woff] (e.g. ML_Manjari.ttf).
    """
    if not FONTS_DIR.exists():
        return []
    valid_exts = {".ttf", ".otf", ".woff", ".woff2"}
    results = []
    try:
        for p in sorted(FONTS_DIR.iterdir()):
            if p.is_file() and p.suffix.lower() in valid_exts:
                filename = p.name
                parts = filename.split("_", 1)
                lang_code = parts[0].upper() if len(parts) > 1 else "OTHER"
                results.append({
                    "filename": filename,
                    "langCode": lang_code,
                    "url": f"/fonts/{filename}",
                })
    except Exception:
        pass
    return results



# Serve static frontend in production if built
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Do not serve index.html for unmatched /api/ routes
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse(
                status_code=404,
                content={"error": "NOT_FOUND", "message": f"API endpoint '/{full_path}' not found."},
            )
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
