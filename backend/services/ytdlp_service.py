import asyncio
import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional
import yt_dlp

from backend.config import YTDLP_COOKIES_FILE
from backend.services.title_clean import parse_artist_title, clean_channel_name
from backend.services.cache import (
    get_cached_stream_url,
    get_cached_stream_info,
    set_cached_stream_url,
    set_cached_stream_info,
    invalidate_cached_stream_url,
    get_cached_track,
    set_cached_track,
)

# Dedicated thread pool executor for CPU/blocking yt-dlp extraction
_executor = ThreadPoolExecutor(max_workers=8)


class TrackError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _get_ydl_base_opts() -> dict:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 15,
        "extract_flat": False,
        "source_address": "0.0.0.0",  # Force IPv4 to prevent YouTube datacenter IPv6 blocks
        "geo_bypass": True,
        "geo_bypass_country": "SG",
        "extractor_args": {
            "youtube": {
                "player_client": ["visionos"],
            }
        },
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Mode": "navigate",
        },
    }

    # Automatically enable Node.js JS runtime if installed (for player response signature extraction)
    node_path = shutil.which("node") or shutil.which("nodejs")
    if node_path:
        opts["js_runtimes"] = {"node": {"path": node_path}}

    if YTDLP_COOKIES_FILE and os.path.exists(YTDLP_COOKIES_FILE):
        opts["cookiefile"] = YTDLP_COOKIES_FILE
        opts["extractor_args"]["youtube"]["player_client"] = ["visionos", "web"]
    return opts


def _classify_ytdlp_error(err_msg: str) -> TrackError:
    err_lower = err_msg.lower()
    if "requested format is not available" in err_lower or "no formats" in err_lower:
        return TrackError(
            code="FORMAT_UNAVAILABLE",
            message="The requested audio stream format is unavailable for this video.",
            status_code=404,
        )
    if "sign in to confirm you’re not a bot" in err_lower or "not a bot" in err_lower or "use --cookies" in err_lower:
        return TrackError(
            code="BOT_CHECK_BLOCKED",
            message="YouTube bot verification triggered. Set YTDLP_COOKIES_TEXT in Render environment variables to bypass.",
            status_code=403,
        )
    if "sign in to confirm your age" in err_lower or "age-restricted" in err_lower:
        return TrackError(
            code="AGE_RESTRICTED",
            message="This video is age-restricted and cannot be streamed directly.",
            status_code=403,
        )
    if "is not available in your country" in err_lower or "geo-restricted" in err_lower:
        return TrackError(
            code="GEO_BLOCKED",
            message="This video is not available in your region.",
            status_code=403,
        )
    if "video unavailable" in err_lower or "this video has been removed" in err_lower or "private video" in err_lower:
        return TrackError(
            code="VIDEO_UNAVAILABLE",
            message="This video is private, removed, or unavailable.",
            status_code=404,
        )
    if "live stream" in err_lower or "is a live event" in err_lower:
        return TrackError(
            code="LIVE_STREAM_UNSUPPORTED",
            message="Live streams are not supported for playback and lyric generation.",
            status_code=400,
        )
    return TrackError(
        code="EXTRACTION_FAILED",
        message=f"Failed to load video: {err_msg[:120]}",
        status_code=502,
    )


def _sync_search_tracks(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    opts = _get_ydl_base_opts()
    opts["extract_flat"] = True
    opts["default_search"] = f"ytsearch{limit}"

    search_query = f"ytsearch{limit}:{query}"
    results: List[Dict[str, Any]] = []

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(search_query, download=False)
            if not data or "entries" not in data:
                return []

            for entry in data.get("entries", []):
                if not entry:
                    continue
                video_id = entry.get("id")
                if not video_id:
                    continue

                raw_title = entry.get("title") or "Unknown Title"
                channel = clean_channel_name(entry.get("uploader") or entry.get("channel") or "")
                parsed = parse_artist_title(raw_title, channel)

                # Thumbnail resolution
                thumbnails = entry.get("thumbnails") or []
                thumbnail_url = ""
                if thumbnails:
                    thumbnail_url = thumbnails[-1].get("url", "")
                elif entry.get("thumbnail"):
                    thumbnail_url = entry.get("thumbnail")
                if not thumbnail_url and video_id:
                    thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                duration = entry.get("duration") or 0

                results.append(
                    {
                        "id": video_id,
                        "title": raw_title,
                        "artist": parsed["artist"],
                        "track": parsed["track"],
                        "channel": channel,
                        "duration": int(duration),
                        "thumbnail": thumbnail_url,
                    }
                )
    except Exception as e:
        raise _classify_ytdlp_error(str(e))

    return results


def _sync_get_track_metadata(video_id: str) -> Dict[str, Any]:
    url = f"https://www.youtube.com/watch?v={video_id}"
    base_opts = _get_ydl_base_opts()
    base_opts["skip_download"] = True

    client_candidates = [
        ["visionos"],
        ["android_vr"],
        ["android"],
        ["web"],
    ]

    last_error: Optional[Exception] = None

    for clients in client_candidates:
        opts = dict(base_opts)
        opts["extractor_args"] = {
            "youtube": {
                "player_client": clients,
            }
        }

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    continue

                if info.get("is_live"):
                    raise TrackError(
                        code="LIVE_STREAM_UNSUPPORTED",
                        message="Live stream audio is not supported.",
                        status_code=400,
                    )

                raw_title = info.get("title") or "Unknown Title"
                channel = clean_channel_name(info.get("uploader") or info.get("channel") or "")
                parsed = parse_artist_title(raw_title, channel)
                duration = int(info.get("duration") or 0)

                # Best thumbnail
                thumbnail_url = info.get("thumbnail") or ""
                if not thumbnail_url and video_id:
                    thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                return {
                    "id": video_id,
                    "title": raw_title,
                    "artist": parsed["artist"],
                    "track": parsed["track"],
                    "uploader": channel,
                    "duration": duration,
                    "thumbnail": thumbnail_url,
                }
        except TrackError:
            raise
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise _classify_ytdlp_error(str(last_error))

    raise TrackError(code="TRACK_NOT_FOUND", message="Video not found.", status_code=404)


def _sync_extract_stream_url(video_id: str) -> Dict[str, Any]:
    url = f"https://www.youtube.com/watch?v={video_id}"
    base_opts = _get_ydl_base_opts()
    base_opts["skip_download"] = True

    # Sequential client candidates to bypass bot challenges and extract progressive audio
    client_candidates = [
        ["visionos"],
        ["android_vr"],
        ["android"],
        ["web"],
    ]

    last_error: Optional[Exception] = None

    for clients in client_candidates:
        opts = dict(base_opts)
        opts["extractor_args"] = {
            "youtube": {
                "player_client": clients,
            }
        }

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    continue

                if info.get("is_live"):
                    raise TrackError(
                        code="LIVE_STREAM_UNSUPPORTED",
                        message="Live stream audio is not supported.",
                        status_code=400,
                    )

                formats = info.get("formats", [])
                if not formats:
                    continue

                # 1. Look for true audio-only progressive formats (m4a, webm/opus)
                audio_formats = [
                    f for f in formats
                    if f.get("acodec") != "none"
                    and (not f.get("vcodec") or f.get("vcodec") == "none")
                    and f.get("url")
                    and not f.get("url", "").endswith(".m3u8")
                    and "manifest.googlevideo.com" not in f.get("url", "")
                ]

                # 2. Fallback to combined video+audio formats (e.g. format 18 mp4 360p)
                if not audio_formats:
                    audio_formats = [
                        f for f in formats
                        if f.get("acodec") != "none"
                        and f.get("url")
                        and not f.get("url", "").endswith(".m3u8")
                        and "manifest.googlevideo.com" not in f.get("url", "")
                    ]

                if not audio_formats:
                    continue

                # Sort by audio bitrate (abr or tbr)
                audio_formats.sort(key=lambda x: (x.get("abr") or x.get("tbr") or 0), reverse=True)
                best_audio = audio_formats[0]
                stream_url = best_audio.get("url")
                if not stream_url:
                    continue

                ext = (best_audio.get("ext") or "m4a").lower()
                content_type = "audio/mp4" if ext in ("m4a", "mp4") else "audio/webm"
                format_headers = best_audio.get("http_headers") or info.get("http_headers") or {}

                return {
                    "stream_url": stream_url,
                    "headers": format_headers,
                    "content_type": content_type,
                    "duration": int(info.get("duration") or 0),
                }

        except TrackError:
            raise
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise _classify_ytdlp_error(str(last_error))

    raise TrackError(code="NO_AUDIO_STREAM", message="No playable audio stream found.", status_code=502)


async def search_tracks(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _sync_search_tracks, query, limit)


async def get_track_info(video_id: str) -> Dict[str, Any]:
    cached = get_cached_track(video_id)
    if cached:
        return cached

    loop = asyncio.get_running_loop()
    metadata = await loop.run_in_executor(_executor, _sync_get_track_metadata, video_id)
    set_cached_track(video_id, metadata)
    return metadata


async def get_stream_info(video_id: str, force_refresh: bool = False) -> Dict[str, Any]:
    if not force_refresh:
        cached = get_cached_stream_info(video_id)
        if cached:
            return cached

    invalidate_cached_stream_url(video_id)
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(_executor, _sync_extract_stream_url, video_id)
    set_cached_stream_info(video_id, data)
    return data


async def get_stream_url(video_id: str, force_refresh: bool = False) -> str:
    data = await get_stream_info(video_id, force_refresh)
    return data["stream_url"]
