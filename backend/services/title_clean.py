import re
from typing import Dict, Tuple

# Regex to detect and strip emoji characters
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # geometric shapes
    "\U0001F800-\U0001F8FF"  # supplemental arrows
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FA6F"  # chess symbols, symbols and pictographs extended-a
    "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-b
    "\U00002702-\U000027B0"  # dingbats
    "\U000024C2-\U0001F251"
    "]+",
    flags=re.UNICODE,
)

# Common bracketed or parenthesized noise phrases
NOISE_PARENS = [
    r"\(official\s+music\s+video\)",
    r"\[official\s+music\s+video\]",
    r"\(official\s+video\)",
    r"\[official\s+video\]",
    r"\(official\s+lyric\s+video\)",
    r"\[official\s+lyric\s+video\]",
    r"\(lyric\s+video\)",
    r"\[lyric\s+video\]",
    r"\(official\s+audio\)",
    r"\[official\s+audio\]",
    r"\(official\s+visualizer\)",
    r"\[official\s+visualizer\]",
    r"\(visualizer\)",
    r"\[visualizer\]",
    r"\(audio\)",
    r"\[audio\]",
    r"\(lyrics\)",
    r"\[lyrics\]",
    r"\(video\)",
    r"\[video\]",
    r"\(music\s+video\)",
    r"\[music\s+video\]",
    r"\(performance\s+video\)",
    r"\[performance\s+video\]",
    r"\(live\)",
    r"\[live\]",
    r"\(acoustic\)",
    r"\[acoustic\]",
    r"\(remastered\)",
    r"\[remastered\]",
    r"\(extended\s+mix\)",
    r"\[extended\s+mix\]",
    r"\(audio\s+visualizer\)",
    r"\[audio\s+visualizer\]",
]

# Noise keywords (like 4K, HD, etc.)
KEYWORD_PATTERNS = [
    r"\b(4k|hd|1080p|720p|hq|uhd)\b",
]

# Featuring patterns (e.g. ft., feat., featuring)
FEAT_PATTERNS = [
    r"[\(\[]?\b(?:feat|ft|featuring)\.?\s+[^)\]]+[\)\]]?",
]

# Suffixes like "| Channel Name" or "// Official"
SUFFIX_PATTERNS = [
    r"\|.*$",
    r"//.*$",
]


def clean_channel_name(channel: str) -> str:
    """Clean YouTube channel name by stripping common suffixes like - Topic, VEVO."""
    if not channel:
        return ""
    name = channel.strip()
    name = re.sub(r"\s*-\s*Topic$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"VEVO$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+Vevo$", "", name, flags=re.IGNORECASE)
    return name.strip()


def strip_noise(text: str) -> str:
    """Remove video noise tags, resolution markers, feat blocks, and emojis."""
    if not text:
        return ""

    cleaned = text

    # Strip emoji
    cleaned = EMOJI_PATTERN.sub("", cleaned)

    # Strip suffix after '|' or '//'
    for pat in SUFFIX_PATTERNS:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    # Strip noise parentheses/brackets
    for pat in NOISE_PARENS:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    # Strip feat / ft patterns
    for pat in FEAT_PATTERNS:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    # Strip resolution/quality tags
    for pat in KEYWORD_PATTERNS:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    # Clean empty parentheses or brackets left behind: e.g. "()", "[]"
    cleaned = re.sub(r"\(\s*\)", "", cleaned)
    cleaned = re.sub(r"\[\s*\]", "", cleaned)

    # Clean duplicate spaces and outer quotes/dashes
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip(" \t\n\r-\"'`“”)(")
    return cleaned.strip()


def parse_artist_title(raw_title: str, channel: str = "") -> Dict[str, str]:
    """
    Cleans raw YouTube title and extracts artist and track title.
    If 'Artist - Title' format is found, splits on hyphen/en-dash/em-dash.
    Otherwise falls back to channel name as artist and cleaned title as track.
    """
    cleaned = strip_noise(raw_title)
    cleaned_channel = clean_channel_name(channel)

    # Check for separator: hyphen, en-dash, em-dash, colon
    delimiters = [" - ", " – ", " — ", " : "]
    matched_delim = None
    for d in delimiters:
        if d in cleaned:
            matched_delim = d
            break

    if matched_delim:
        parts = cleaned.split(matched_delim, 1)
        artist = parts[0].strip(" \t\n\r-\"'`“”)(")
        track = parts[1].strip(" \t\n\r-\"'`“”)(")
        # If track has residual quotes, remove them
        track = re.sub(r'^["\']|["\']$', "", track).strip()
        # Fall back if artist became empty
        if not artist and cleaned_channel:
            artist = cleaned_channel
        return {
            "artist": artist or cleaned_channel or "Unknown Artist",
            "track": track or cleaned,
        }

    # If no delimiter, use channel as artist
    artist = cleaned_channel or "Unknown Artist"
    track = cleaned or raw_title
    return {
        "artist": artist,
        "track": track,
    }
