import os
from pathlib import Path
from typing import AsyncGenerator, Optional
import httpx
from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from backend.config import UPLOAD_DIR
from backend.services.ytdlp_service import get_stream_url, get_stream_info, TrackError

router = APIRouter(prefix="/api", tags=["stream"])

CHUNK_SIZE = 64 * 1024  # 64 KB chunks for streaming


def _parse_range_header(range_header: str, file_size: int):
    """Parse HTTP Range header: 'bytes=start-end'."""
    if not range_header or not range_header.startswith("bytes="):
        return 0, file_size - 1

    ranges = range_header.replace("bytes=", "").split("-")
    start = int(ranges[0]) if ranges[0] else 0
    end = int(ranges[1]) if len(ranges) > 1 and ranges[1] else file_size - 1
    start = max(0, start)
    end = min(end, file_size - 1)
    return start, end


async def _stream_local_file(file_path: Path, start: int, end: int) -> AsyncGenerator[bytes, None]:
    """Stream chunks from local uploaded file slice."""
    with open(file_path, "rb") as f:
        f.seek(start)
        bytes_to_read = end - start + 1
        while bytes_to_read > 0:
            read_size = min(CHUNK_SIZE, bytes_to_read)
            data = f.read(read_size)
            if not data:
                break
            bytes_to_read -= len(data)
            yield data


def _serve_local_file(file_path: Path, range_header: Optional[str], is_head: bool = False) -> Response:
    file_size = file_path.stat().st_size
    suffix = file_path.suffix.lower()
    content_type_map = {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".opus": "audio/ogg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".weba": "audio/webm",
    }
    content_type = content_type_map.get(suffix, "audio/mpeg")

    if range_header:
        start, end = _parse_range_header(range_header, file_size)
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
            "Access-Control-Allow-Origin": "*",
        }
        if is_head:
            return Response(status_code=206, headers=headers)
        return StreamingResponse(
            _stream_local_file(file_path, start, end),
            status_code=206,
            headers=headers,
        )

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
        "Access-Control-Allow-Origin": "*",
    }
    if is_head:
        return Response(status_code=200, headers=headers)
    return StreamingResponse(
        _stream_local_file(file_path, 0, file_size - 1),
        status_code=200,
        headers=headers,
    )


@router.get("/stream/{video_id}")
@router.head("/stream/{video_id}")
async def stream_audio_endpoint(
    video_id: str,
    request: Request,
    range: Optional[str] = Header(None),
):
    """
    Proxies audio stream with HTTP Range support (206 Partial Content, Accept-Ranges, Content-Range).
    Ensures same-origin / CORS compatibility for Canvas & AudioContext recording.
    Handles expired URLs by re-extracting once on 403.
    """
    # 1. Handle uploaded local files
    if video_id.startswith("upload_"):
        matching = list(UPLOAD_DIR.glob(f"{video_id}.*"))
        if not matching:
            raise HTTPException(
                status_code=404,
                detail={"error": "FILE_NOT_FOUND", "message": "Uploaded audio file not found."},
            )
        return _serve_local_file(matching[0], range, request.method == "HEAD")

    # 2. Handle YouTube stream
    upstream_info = None
    try:
        upstream_info = await get_stream_info(video_id, force_refresh=False)
    except TrackError as e:
        raise HTTPException(status_code=e.status_code, detail={"error": e.code, "message": e.message})
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail={"error": "STREAM_EXTRACT_FAILED", "message": str(e)},
        )

    upstream_url = upstream_info["stream_url"]
    upstream_headers = upstream_info.get("headers", {})

    client_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        **upstream_headers,
    }
    if range:
        client_headers["Range"] = range

    client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=60.0))

    try:
        req = client.build_request("GET", upstream_url, headers=client_headers)
        upstream_resp = await client.send(req, stream=True)

        # If 403 Forbidden or expired URL, refresh stream URL and retry once
        if upstream_resp.status_code in (403, 410):
            await upstream_resp.aclose()
            upstream_info = await get_stream_info(video_id, force_refresh=True)
            upstream_url = upstream_info["stream_url"]
            client_headers.update(upstream_info.get("headers", {}))
            req = client.build_request("GET", upstream_url, headers=client_headers)
            upstream_resp = await client.send(req, stream=True)

        if upstream_resp.status_code not in (200, 206):
            await upstream_resp.aclose()
            await client.aclose()
            raise HTTPException(
                status_code=upstream_resp.status_code,
                detail={
                    "error": "UPSTREAM_STREAM_ERROR",
                    "message": f"Upstream audio returned status {upstream_resp.status_code}",
                },
            )

        # Forward crucial streaming headers
        response_headers = {
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
        }
        for h in ("content-type", "content-length", "content-range"):
            val = upstream_resp.headers.get(h)
            if val:
                response_headers[h] = val

        default_content_type = upstream_info.get("content_type", "audio/mp4")
        if "content-type" not in response_headers or not response_headers["content-type"] or "video" in response_headers["content-type"]:
            response_headers["content-type"] = default_content_type

        # Early return for HEAD requests (no body needed)
        if request.method == "HEAD":
            await upstream_resp.aclose()
            await client.aclose()
            return Response(status_code=upstream_resp.status_code, headers=response_headers)

        async def stream_generator():
            try:
                async for chunk in upstream_resp.aiter_bytes(chunk_size=CHUNK_SIZE):
                    yield chunk
            finally:
                await upstream_resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_generator(),
            status_code=upstream_resp.status_code,
            headers=response_headers,
        )

    except HTTPException:
        raise
    except Exception as e:
        await client.aclose()
        raise HTTPException(
            status_code=502,
            detail={"error": "STREAM_PROXY_ERROR", "message": f"Stream proxy error: {str(e)}"},
        )
