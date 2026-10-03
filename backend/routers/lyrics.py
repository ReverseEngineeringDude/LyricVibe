from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.services.lrclib_service import get_lyrics, search_lrclib_candidates

router = APIRouter(prefix="/api", tags=["lyrics"])


@router.get("/lyrics")
async def lyrics_endpoint(
    track: str = Query(..., description="Track title"),
    artist: str = Query("", description="Artist name"),
    duration: Optional[float] = Query(None, description="Track duration in seconds"),
):
    try:
        dur_int = int(duration) if duration is not None and duration > 0 else None
        data = await get_lyrics(track=track, artist=artist, duration=dur_int)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "LYRICS_FETCH_FAILED", "message": f"Failed to retrieve lyrics: {str(e)}"},
        )


@router.get("/lyrics/search")
async def lyrics_search_endpoint(
    q: str = Query(..., min_length=1, description="Lyric search query"),
):
    try:
        candidates = await search_lrclib_candidates(q.strip())
        return candidates
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "LYRICS_SEARCH_FAILED", "message": f"Failed to search lyrics: {str(e)}"},
        )
