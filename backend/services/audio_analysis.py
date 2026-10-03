import json
import logging
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("lyricvibe.analysis")

CACHE_DIR = Path("data/cache/analysis")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def count_syllables(word: str) -> int:
    """Estimates syllable count using vowel cluster heuristics."""
    clean = re.sub(r"[^a-zA-Z]", "", word).lower()
    if not clean:
        return 1
    if len(clean) <= 3:
        return 1
    # Count vowel groups
    vowels = len(re.findall(r"[aeiouy]+", clean))
    # Adjust for silent 'e' at end
    if clean.endswith("e") and not clean.endswith("le") and len(clean) > 2:
        vowels = max(1, vowels - 1)
    return max(1, vowels)


def estimate_word_timings(
    synced_lines: List[Dict[str, Any]], track_duration: float = 180.0
) -> List[Dict[str, Any]]:
    """
    Distributes each line's time window across its words using syllable and char weights.
    Returns: [{ text, start, end, line }]
    """
    words_result: List[Dict[str, Any]] = []

    for idx, line in enumerate(synced_lines):
        line_text = (line.get("text") or "").strip()
        if not line_text or line.get("isInstrumental"):
            continue

        raw_words = line_text.split()
        if not raw_words:
            continue

        line_start = float(line.get("time", 0.0))

        # Determine line end time
        if idx + 1 < len(synced_lines):
            next_start = float(synced_lines[idx + 1].get("time", line_start + 4.0))
            raw_duration = next_start - line_start
            line_duration = max(0.8, min(raw_duration, 8.0))
        else:
            line_duration = max(1.5, min(track_duration - line_start, 6.0))

        # Leave a small natural breath pause before the next line
        breath_pause = 0.2 if line_duration > 1.5 else 0.05
        active_speech_duration = max(0.5, line_duration - breath_pause)

        # Calculate word weights: 60% syllables + 40% length
        weights = []
        for w in raw_words:
            syl = count_syllables(w)
            char_len = max(1, len(w))
            weight = 0.6 * syl + 0.4 * (char_len / 3.0)
            weights.append(weight)

        total_weight = sum(weights) or 1.0
        current_time = line_start

        for w_idx, (word, weight) in enumerate(zip(raw_words, weights)):
            word_dur = (weight / total_weight) * active_speech_duration
            word_dur = max(0.12, word_dur)
            word_end = current_time + word_dur

            words_result.append(
                {
                    "text": word,
                    "start": round(current_time, 3),
                    "end": round(word_end, 3),
                    "line": idx,
                }
            )
            # Add small 20ms inter-word gap
            current_time = word_end + 0.02

    return words_result


def analyze_beats_and_energy(
    audio_path: Optional[str] = None, duration: float = 180.0
) -> Dict[str, Any]:
    """
    Extracts beat frames, downbeats, tempo, and 30Hz energy envelope using librosa.
    Falls back gracefully to harmonic grid if audio file or librosa is not yet loaded.
    """
    try:
        import librosa
        import numpy as np

        if audio_path and Path(audio_path).exists():
            y, sr = librosa.load(audio_path, sr=22050, mono=True)
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            tempo_val = float(np.atleast_1d(tempo)[0]) if tempo is not None else 120.0
            beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

            # Downbeats: roughly every 4 beats
            downbeats = [beat_times[i] for i in range(0, len(beat_times), 4)]

            # Energy sampled at ~30Hz (hop_length=735 at 22050Hz is 30Hz)
            hop_length = 735
            rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
            max_rms = float(np.max(rms)) if len(rms) > 0 and np.max(rms) > 0 else 1.0
            normalized = (rms / max_rms).tolist()

            times = librosa.frames_to_time(range(len(normalized)), sr=sr, hop_length=hop_length)
            energy = [
                {"t": round(float(t), 3), "v": round(float(v), 3)}
                for t, v in zip(times, normalized)
            ]

            return {
                "tempo": round(tempo_val, 1),
                "beats": [round(t, 3) for t in beat_times],
                "downbeats": [round(t, 3) for t in downbeats],
                "energy": energy,
            }
    except Exception as e:
        logger.warning(f"Librosa analysis note: {e}, using mathematical beat grid fallback.")

    # High-quality deterministic fallback: 120 BPM beat grid + sampled energy curve
    tempo = 120.0
    beat_interval = 60.0 / tempo  # 0.5s
    num_beats = int(duration / beat_interval)
    beats = [round(i * beat_interval, 3) for i in range(num_beats)]
    downbeats = [round(i * beat_interval, 3) for i in range(0, num_beats, 4)]

    # 30Hz energy sample curve
    fps = 30
    total_frames = int(duration * fps)
    energy = []
    for f in range(total_frames):
        t = f / fps
        # Natural rhythmic pulse modulation
        beat_phase = (t % beat_interval) / beat_interval
        decay = math.exp(-beat_phase * 4.0)
        v = 0.2 + 0.6 * decay + 0.15 * math.sin(t * 0.4)
        energy.append({"t": round(t, 3), "v": round(min(1.0, max(0.05, v)), 3)})

    return {
        "tempo": tempo,
        "beats": beats,
        "downbeats": downbeats,
        "energy": energy,
    }


def get_cached_analysis(video_id: str) -> Optional[Dict[str, Any]]:
    path = CACHE_DIR / f"{video_id}.json"
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def save_analysis_cache(video_id: str, data: Dict[str, Any]) -> None:
    path = CACHE_DIR / f"{video_id}.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not write analysis cache: {e}")
