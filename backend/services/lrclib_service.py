import httpx
from typing import Any, Dict, List, Optional
from backend.services.cache import get_cached_lyrics, set_cached_lyrics

LRCLIB_BASE_URL = "https://lrclib.net/api"
USER_AGENT = "LyricVibe/1.0 (https://github.com/lyricvibe/lyricvibe; contact: dev@lyricvibe.local)"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
}


def _make_cache_key(track: str, artist: str, duration: Optional[int]) -> str:
    dur_str = str(round(duration or 0))
    return f"lyrics:{artist.strip().lower()}:{track.strip().lower()}:{dur_str}"


async def get_lyrics(track: str, artist: str, duration: Optional[int] = None) -> Dict[str, Any]:
    """
    Fetch synced lyrics from lrclib.net.
    1. Try /api/get?track_name=&artist_name=&duration=
    2. If misses (404 or empty), try /api/search?q=<artist track> and rank candidates by duration closeness (+/- 3s).
    Caches results for 24h.
    """
    cache_key = _make_cache_key(track, artist, duration)
    cached = get_cached_lyrics(cache_key)
    if cached:
        return cached

    result: Dict[str, Any] = {
        "id": None,
        "trackName": track,
        "artistName": artist,
        "duration": duration or 0,
        "syncedLyrics": None,
        "plainLyrics": None,
        "instrumental": False,
        "candidates": [],
    }

    async with httpx.AsyncClient(headers=HEADERS, timeout=12.0) as client:
        # Step 1: Exact lookup
        params: Dict[str, Any] = {
            "track_name": track,
            "artist_name": artist,
        }
        if duration and duration > 0:
            params["duration"] = int(duration)

        try:
            resp = await client.get(f"{LRCLIB_BASE_URL}/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("syncedLyrics") or data.get("plainLyrics") or data.get("instrumental"):
                    result = {
                        "id": data.get("id"),
                        "trackName": data.get("trackName") or track,
                        "artistName": data.get("artistName") or artist,
                        "duration": data.get("duration") or duration or 0,
                        "syncedLyrics": data.get("syncedLyrics"),
                        "plainLyrics": data.get("plainLyrics"),
                        "instrumental": bool(data.get("instrumental")),
                        "candidates": [],
                    }
                    set_cached_lyrics(cache_key, result)
                    return result
        except httpx.HTTPError:
            pass

        # Step 2: Fallback search if exact lookup missed
        search_query = f"{artist} {track}".strip()
        try:
            search_resp = await client.get(
                f"{LRCLIB_BASE_URL}/search",
                params={"q": search_query},
            )
            if search_resp.status_code == 200:
                candidates: List[Dict[str, Any]] = search_resp.json()
                if candidates:
                    # Filter and rank candidates
                    def rank_key(cand: Dict[str, Any]) -> float:
                        cand_dur = cand.get("duration") or 0
                        diff = abs(cand_dur - (duration or cand_dur)) if duration else 0
                        # Prefer candidates with syncedLyrics
                        has_synced = 0 if cand.get("syncedLyrics") else 100
                        return diff + has_synced

                    sorted_candidates = sorted(candidates, key=rank_key)

                    # Top candidates for UI lyric picker
                    top_candidates = []
                    for c in sorted_candidates[:5]:
                        top_candidates.append(
                            {
                                "id": c.get("id"),
                                "trackName": c.get("trackName"),
                                "artistName": c.get("artistName"),
                                "albumName": c.get("albumName"),
                                "duration": c.get("duration"),
                                "hasSynced": bool(c.get("syncedLyrics")),
                                "instrumental": bool(c.get("instrumental")),
                            }
                        )

                    # Best match candidate
                    best = sorted_candidates[0]
                    # Check if duration is reasonably close or if we didn't have duration
                    cand_dur = best.get("duration") or 0
                    is_close = not duration or abs(cand_dur - duration) <= 8

                    if is_close or best.get("syncedLyrics"):
                        result = {
                            "id": best.get("id"),
                            "trackName": best.get("trackName") or track,
                            "artistName": best.get("artistName") or artist,
                            "duration": best.get("duration") or duration or 0,
                            "syncedLyrics": best.get("syncedLyrics"),
                            "plainLyrics": best.get("plainLyrics"),
                            "instrumental": bool(best.get("instrumental")),
                            "candidates": top_candidates,
                        }
                    else:
                        result["candidates"] = top_candidates
        except httpx.HTTPError:
            pass

    # Cache response (even empty/not-found) to avoid hammered APIs
    set_cached_lyrics(cache_key, result)
    return result


async def search_lrclib_candidates(query: str) -> List[Dict[str, Any]]:
    """Search lrclib candidates for manual lyric picking in the UI."""
    cache_key = f"lrclib_search:{query.strip().lower()}"
    cached = get_cached_lyrics(cache_key)
    if cached and isinstance(cached, list):
        return cached

    async with httpx.AsyncClient(headers=HEADERS, timeout=12.0) as client:
        try:
            resp = await client.get(f"{LRCLIB_BASE_URL}/search", params={"q": query})
            if resp.status_code == 200:
                data = resp.json()
                candidates = []
                for c in data[:10]:
                    candidates.append(
                        {
                            "id": c.get("id"),
                            "trackName": c.get("trackName"),
                            "artistName": c.get("artistName"),
                            "albumName": c.get("albumName"),
                            "duration": c.get("duration"),
                            "syncedLyrics": c.get("syncedLyrics"),
                            "plainLyrics": c.get("plainLyrics"),
                            "instrumental": bool(c.get("instrumental")),
                        }
                    )
                set_cached_lyrics(cache_key, candidates)
                return candidates
        except Exception:
            return []
    return []
