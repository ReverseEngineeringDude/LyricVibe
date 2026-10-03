import json
import os
import shutil
import subprocess
import uuid
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile
from backend.config import UPLOAD_DIR
from backend.services.title_clean import parse_artist_title
from backend.services.ytdlp_service import get_track_info, TrackError
from backend.services.cache import get_cached_track, set_cached_track

router = APIRouter(prefix="/api", tags=["track"])


def _probe_audio_file(file_path: Path) -> dict:
    """Probe an audio file with ffprobe to get duration and metadata tags."""
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(file_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(proc.stdout)
    except Exception:
        return {}


@router.get("/track/{video_id}")
async def track_endpoint(video_id: str):
    if not video_id:
        raise HTTPException(status_code=400, detail={"error": "INVALID_ID", "message": "Missing video ID"})

    # Check if this is an uploaded audio file
    if video_id.startswith("upload_"):
        cached = get_cached_track(video_id)
        if cached:
            return cached

        # Check in uploads directory
        for f in UPLOAD_DIR.glob(f"{video_id}.*"):
            info = _probe_audio_file(f)
            format_info = info.get("format", {})
            tags = format_info.get("tags", {})
            duration = int(float(format_info.get("duration", 0)))
            raw_title = tags.get("title") or f.stem.replace(f"{video_id}_", "")
            artist = tags.get("artist") or "Local Upload"
            track = tags.get("title") or raw_title

            data = {
                "id": video_id,
                "title": f"{artist} - {track}" if artist and track else raw_title,
                "artist": artist,
                "track": track,
                "uploader": "Local Upload",
                "duration": duration,
                "thumbnail": "",
                "is_upload": True,
            }
            set_cached_track(video_id, data)
            return data

        raise HTTPException(
            status_code=404,
            detail={"error": "UPLOAD_NOT_FOUND", "message": "Uploaded audio not found."},
        )

    try:
        return await get_track_info(video_id)
    except TrackError as e:
        raise HTTPException(status_code=e.status_code, detail={"error": e.code, "message": e.message})
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "TRACK_ERROR", "message": f"Failed to retrieve track: {str(e)}"},
        )


@router.post("/track/upload")
async def upload_audio_endpoint(file: UploadFile = File(...)):
    """Allow user to drag-and-drop their own audio file as fallback playback source."""
    if not file.filename:
        raise HTTPException(status_code=400, detail={"error": "EMPTY_FILE", "message": "Filename is missing."})

    ext = Path(file.filename).suffix.lower()
    allowed_exts = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac", ".weba"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_FORMAT",
                "message": f"Unsupported audio format '{ext}'. Allowed: {', '.join(allowed_exts)}",
            },
        )

    unique_id = f"upload_{uuid.uuid4().hex[:12]}"
    saved_filename = f"{unique_id}{ext}"
    dest_path = UPLOAD_DIR / saved_filename

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "SAVE_FAILED", "message": f"Could not save uploaded audio: {str(e)}"},
        )
    finally:
        await file.close()

    # Extract metadata using ffprobe
    probe_data = _probe_audio_file(dest_path)
    format_info = probe_data.get("format", {})
    tags = format_info.get("tags", {})
    duration = int(float(format_info.get("duration", 0)))

    raw_filename = Path(file.filename).stem
    tags_title = tags.get("title") or tags.get("TITLE")
    tags_artist = tags.get("artist") or tags.get("ARTIST")

    if tags_title and tags_artist:
        artist = tags_artist
        track = tags_title
    else:
        parsed = parse_artist_title(raw_filename, channel="Local Upload")
        artist = parsed["artist"]
        track = parsed["track"]

    title = f"{artist} - {track}" if artist != "Unknown Artist" and artist != "Local Upload" else track

    track_data = {
        "id": unique_id,
        "title": title,
        "artist": artist if artist != "Unknown Artist" else "Local Upload",
        "track": track,
        "uploader": "Local Upload",
        "duration": duration,
        "thumbnail": "",
        "is_upload": True,
        "filename": saved_filename,
    }

    set_cached_track(unique_id, track_data)
    return track_data
