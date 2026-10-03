import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api", tags=["convert"])


def _remove_files(*paths: Path):
    for p in paths:
        try:
            if p and p.exists():
                p.unlink(missing_ok=True)
        except Exception:
            pass


@router.post("/convert")
async def convert_to_mp4_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Converts uploaded WebM recording from browser MediaRecorder into H.264/AAC MP4
    optimized with faststart for WhatsApp, Instagram, iOS, and Android story sharing.
    Deletes temporary files after the response is sent.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail={"error": "NO_FILE", "message": "No file uploaded."})

    temp_id = uuid.uuid4().hex
    temp_dir = Path(tempfile.gettempdir())
    input_ext = Path(file.filename).suffix or ".webm"
    input_path = temp_dir / f"lyricvibe_in_{temp_id}{input_ext}"
    output_path = temp_dir / f"lyricvibe_out_{temp_id}.mp4"

    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "SAVE_TEMP_FAILED", "message": f"Could not save temp file: {str(e)}"},
        )
    finally:
        await file.close()

    # ffmpeg transcoding command
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(output_path),
    ]

    try:
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=180,
        )
        if process.returncode != 0:
            _remove_files(input_path, output_path)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "CONVERSION_FAILED",
                    "message": f"FFmpeg error: {process.stderr[-200:] if process.stderr else 'Unknown'}",
                },
            )
    except subprocess.TimeoutExpired:
        _remove_files(input_path, output_path)
        raise HTTPException(
            status_code=504,
            detail={"error": "TIMEOUT", "message": "Video conversion timed out."},
        )
    except HTTPException:
        raise
    except Exception as e:
        _remove_files(input_path, output_path)
        raise HTTPException(
            status_code=500,
            detail={"error": "PROCESS_ERROR", "message": f"Conversion process error: {str(e)}"},
        )

    # Clean input file right away
    _remove_files(input_path)

    # Schedule output file deletion after FileResponse finishes
    background_tasks.add_task(_remove_files, output_path)

    return FileResponse(
        path=output_path,
        media_type="video/mp4",
        filename="lyricvibe_story.mp4",
        headers={"Content-Disposition": 'attachment; filename="lyricvibe_story.mp4"'},
    )
