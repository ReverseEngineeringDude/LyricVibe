import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query

from backend.services.audio_analysis import (
    estimate_word_timings,
    analyze_beats_and_energy,
    get_cached_analysis,
    save_analysis_cache,
)
from backend.services.lrclib_service import get_lyrics
from backend.services.ytdlp_service import get_track_info

router = APIRouter(prefix="/api", tags=["analysis"])

LRC_REGEX = re.compile(r"\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)")


def parse_lrc_lines(lrc_text: str) -> List[Dict[str, Any]]:
    lines: List[Dict[str, Any]] = []
    if not lrc_text:
        return lines

    for raw in lrc_text.splitlines():
        trimmed = raw.strip()
        if not trimmed:
            continue
        m = LRC_REGEX.match(trimmed)
        if m:
            mins = int(m.group(1))
            secs = float(m.group(2))
            text = m.group(3).strip()
            time = mins * 60.0 + secs
            if text:
                lines.append({"time": time, "text": text})

    lines.sort(key=lambda x: x["time"])
    return lines


@router.get("/analysis/{video_id}")
async def get_analysis_endpoint(
    video_id: str,
    track: Optional[str] = Query(None),
    artist: Optional[str] = Query(""),
    duration: Optional[float] = Query(None),
):
    """
    Returns audio analysis data including word-level timings, beats, downbeats,
    energy envelope sampled at ~30Hz, and tempo.
    """
    # 1. Check cache first
    cached = get_cached_analysis(video_id)
    if cached:
        return cached

    track_title = track
    track_artist = artist or ""
    track_duration = duration or 180.0

    # If track details not provided, fetch from ytdlp
    if not track_title and not video_id.startswith("upload_"):
        try:
            info = await get_track_info(video_id)
            track_title = info.get("track") or info.get("title") or "Unknown"
            track_artist = info.get("artist") or ""
            track_duration = float(info.get("duration") or 180.0)
        except Exception:
            track_title = "Unknown"

    # 2. Fetch lyrics to derive word timings
    synced_lines: List[Dict[str, Any]] = []
    if track_title and track_title != "Unknown":
        try:
            lyrics_resp = await get_lyrics(track=track_title, artist=track_artist, duration=int(track_duration))
            synced_text = lyrics_resp.get("syncedLyrics")
            if synced_text:
                synced_lines = parse_lrc_lines(synced_text)
        except Exception:
            pass

    # 3. Estimate word timings
    words = estimate_word_timings(synced_lines, track_duration=track_duration)

    # 4. Extract beats and 30Hz energy
    beats_data = analyze_beats_and_energy(duration=track_duration)

    result = {
        "video_id": video_id,
        "status": "ready",
        "tempo": beats_data["tempo"],
        "beats": beats_data["beats"],
        "downbeats": beats_data["downbeats"],
        "energy": beats_data["energy"],
        "words": words,
    }

    # 5. Cache result
    save_analysis_cache(video_id, result)
    return result


@router.get("/analysis/{video_id}/status")
async def get_analysis_status_endpoint(video_id: str):
    """
    Status poll endpoint for forced alignment / analysis jobs.
    """
    cached = get_cached_analysis(video_id)
    if cached:
        return {"video_id": video_id, "status": "ready", "aligned": True}
    return {"video_id": video_id, "status": "ready", "aligned": False}
