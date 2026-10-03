import time
from typing import Any, Optional, Dict
from cachetools import TTLCache
from backend.config import (
    STREAM_CACHE_TTL_SEC,
    LYRICS_CACHE_TTL_SEC,
    SEARCH_CACHE_TTL_SEC,
    TRACK_CACHE_TTL_SEC,
    RATE_LIMIT_PER_MINUTE,
)

# Caches
_stream_cache: TTLCache = TTLCache(maxsize=1000, ttl=STREAM_CACHE_TTL_SEC)
_lyrics_cache: TTLCache = TTLCache(maxsize=2000, ttl=LYRICS_CACHE_TTL_SEC)
_search_cache: TTLCache = TTLCache(maxsize=1000, ttl=SEARCH_CACHE_TTL_SEC)
_track_cache: TTLCache = TTLCache(maxsize=1000, ttl=TRACK_CACHE_TTL_SEC)

# Simple sliding window rate limiter cache: ip -> list of request timestamps
_rate_limit_cache: Dict[str, list] = {}


def get_cached_stream_url(video_id: str) -> Optional[str]:
    val = _stream_cache.get(video_id)
    if isinstance(val, dict):
        return val.get("stream_url")
    return val


def get_cached_stream_info(video_id: str) -> Optional[Dict[str, Any]]:
    val = _stream_cache.get(video_id)
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        return {"stream_url": val, "headers": {}}
    return None


def set_cached_stream_url(video_id: str, url: str) -> None:
    _stream_cache[video_id] = url


def set_cached_stream_info(video_id: str, data: Dict[str, Any]) -> None:
    _stream_cache[video_id] = data


def invalidate_cached_stream_url(video_id: str) -> None:
    _stream_cache.pop(video_id, None)


def get_cached_lyrics(cache_key: str) -> Optional[Dict[str, Any]]:
    return _lyrics_cache.get(cache_key)


def set_cached_lyrics(cache_key: str, data: Dict[str, Any]) -> None:
    _lyrics_cache[cache_key] = data


def get_cached_search(query: str) -> Optional[list]:
    return _search_cache.get(query.strip().lower())


def set_cached_search(query: str, results: list) -> None:
    _search_cache[query.strip().lower()] = results


def get_cached_track(video_id: str) -> Optional[Dict[str, Any]]:
    return _track_cache.get(video_id)


def set_cached_track(video_id: str, data: Dict[str, Any]) -> None:
    _track_cache[video_id] = data


def check_rate_limit(client_ip: str) -> bool:
    """
    Returns True if client IP is within rate limit, False if exceeded.
    Window is 60 seconds.
    """
    now = time.time()
    window_start = now - 60.0

    if client_ip not in _rate_limit_cache:
        _rate_limit_cache[client_ip] = [now]
        return True

    # Evict timestamps older than 60s
    timestamps = [t for t in _rate_limit_cache[client_ip] if t > window_start]
    if len(timestamps) >= RATE_LIMIT_PER_MINUTE:
        _rate_limit_cache[client_ip] = timestamps
        return False

    timestamps.append(now)
    _rate_limit_cache[client_ip] = timestamps
    return True
