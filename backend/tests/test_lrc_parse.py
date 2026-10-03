import re
import pytest


def parse_lrc_lines(lrc_text: str):
    """
    Parses LRC content with support for:
    - [mm:ss.xx] and [mm:ss.xxx]
    - [mm:ss]
    - Multiple timestamps per line: [00:12.00][00:24.00] Repeated line
    - Empty lines and instrumental gaps > 8 seconds
    """
    if not lrc_text or not lrc_text.strip():
        return []

    time_tag_regex = re.compile(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]")
    parsed_lines = []

    for line in lrc_text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue

        # Extract all time tags on this line
        matches = list(time_tag_regex.finditer(trimmed))
        if not matches:
            continue

        # Text is whatever remains after removing all timestamps
        text_content = time_tag_regex.sub("", trimmed).strip()

        for m in matches:
            mins = int(m.group(1))
            secs = int(m.group(2))
            millis_str = m.group(3) or "0"
            if len(millis_str) == 1:
                millis = int(millis_str) * 100
            elif len(millis_str) == 2:
                millis = int(millis_str) * 10
            else:
                millis = int(millis_str[:3])

            timestamp_seconds = mins * 60 + secs + (millis / 1000.0)
            parsed_lines.append(
                {
                    "time": round(timestamp_seconds, 2),
                    "text": text_content,
                    "isInstrumental": False,
                }
            )

    # Sort lines chronologically
    parsed_lines.sort(key=lambda x: x["time"])

    # Insert instrumental gaps if gap > 8.0 seconds
    final_lines = []
    for i, line in enumerate(parsed_lines):
        if i > 0:
            prev_time = parsed_lines[i - 1]["time"]
            curr_time = line["time"]
            gap = curr_time - prev_time
            if gap > 8.0:
                # Add an instrumental pause marker
                final_lines.append(
                    {
                        "time": round(prev_time + 1.0, 2),
                        "text": "• • •",
                        "isInstrumental": True,
                    }
                )
        final_lines.append(line)

    return final_lines


def test_parse_simple_lrc():
    lrc = """
    [00:05.50]Look at the stars
    [00:10.20]Look how they shine for you
    """
    lines = parse_lrc_lines(lrc)
    assert len(lines) == 2
    assert lines[0]["time"] == 5.50
    assert lines[0]["text"] == "Look at the stars"
    assert lines[1]["time"] == 10.20
    assert lines[1]["text"] == "Look how they shine for you"


def test_parse_multiple_timestamps_per_line():
    lrc = "[00:12.00][00:16.00]Chorus line repeated"
    lines = parse_lrc_lines(lrc)
    assert len(lines) == 2
    assert lines[0]["time"] == 12.00
    assert lines[0]["text"] == "Chorus line repeated"
    assert lines[1]["time"] == 16.00
    assert lines[1]["text"] == "Chorus line repeated"



def test_parse_two_digit_seconds():
    lrc = "[01:30]No fractional milliseconds"
    lines = parse_lrc_lines(lrc)
    assert len(lines) == 1
    assert lines[0]["time"] == 90.0
    assert lines[0]["text"] == "No fractional milliseconds"


def test_insert_instrumental_gap():
    lrc = """
    [00:04.00]Intro lyric
    [00:20.00]Lyric after long guitar solo
    """
    lines = parse_lrc_lines(lrc)
    # Between 4.00 and 20.00, gap is 16s > 8s, so an instrumental marker is inserted
    assert len(lines) == 3
    assert lines[0]["text"] == "Intro lyric"
    assert lines[1]["isInstrumental"] is True
    assert lines[1]["text"] == "• • •"
    assert lines[2]["text"] == "Lyric after long guitar solo"
