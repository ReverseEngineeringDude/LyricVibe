from fastapi import APIRouter, HTTPException, Query
from backend.services.ytdlp_service import search_tracks, TrackError
from backend.services.cache import get_cached_search, set_cached_search

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
async def search_endpoint(q: str = Query(..., min_length=1, description="Search query")):
    query = q.strip()
    if not query:
        return []

    # Check cache
    cached = get_cached_search(query)
    if cached is not None:
        return cached

    try:
        results = await search_tracks(query, limit=10)
        set_cached_search(query, results)
        return results
    except TrackError as e:
        raise HTTPException(status_code=e.status_code, detail={"error": e.code, "message": e.message})
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "SEARCH_ERROR", "message": f"Search failed: {str(e)}"},
        )
