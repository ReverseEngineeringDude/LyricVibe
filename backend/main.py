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
        "build_tag": "2026-10-04-v3-resilient-clients",
        "ytdlp_version": getattr(yt_dlp, "__version__", None) or getattr(getattr(yt_dlp, "version", None), "__version__", "unknown"),
        "has_cookies": has_cookies,
        "has_deno": bool(shutil.which("deno")),
        "has_node": bool(shutil.which("node") or shutil.which("nodejs")),
    }


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
