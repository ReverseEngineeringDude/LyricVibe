import pytest
from backend.services.title_clean import clean_channel_name, strip_noise, parse_artist_title


def test_clean_channel_name():
    assert clean_channel_name("The Weeknd - Topic") == "The Weeknd"
    assert clean_channel_name("TaylorSwiftVEVO") == "TaylorSwift"
    assert clean_channel_name("Billie Eilish Vevo") == "Billie Eilish"
    assert clean_channel_name("Dua Lipa") == "Dua Lipa"
    assert clean_channel_name("") == ""


def test_strip_noise_official_tags():
    raw = "Coldplay - Yellow (Official Video) [4K] [Lyrics] (Audio)"
    cleaned = strip_noise(raw)
    assert "(Official Video)" not in cleaned
    assert "[4K]" not in cleaned
    assert "[Lyrics]" not in cleaned
    assert "(Audio)" not in cleaned
    assert "Coldplay - Yellow" == cleaned


def test_strip_noise_visualizer_and_hd():
    raw = "Dua Lipa - Levitating (Official Visualizer) HD 1080p"
    cleaned = strip_noise(raw)
    assert "(Official Visualizer)" not in cleaned
    assert "HD" not in cleaned
    assert "1080p" not in cleaned
    assert "Dua Lipa - Levitating" == cleaned


def test_strip_noise_emojis_and_channel_suffix():
    raw = "🔥 Blinding Lights 🚀 (Official Lyric Video) | The Weeknd"
    cleaned = strip_noise(raw)
    assert "🔥" not in cleaned
    assert "🚀" not in cleaned
    assert "| The Weeknd" not in cleaned
    assert "Blinding Lights" == cleaned


def test_strip_noise_featuring():
    raw = "David Guetta - Titanium (feat. Sia) (Official Music Video)"
    cleaned = strip_noise(raw)
    assert "Titanium" in cleaned
    assert "David Guetta" in cleaned
    assert "(feat. Sia)" not in cleaned


def test_parse_artist_title_standard_dash():
    res = parse_artist_title("Adele - Rolling in the Deep (Official Music Video)")
    assert res["artist"] == "Adele"
    assert res["track"] == "Rolling in the Deep"


def test_parse_artist_title_unicode_dash():
    res = parse_artist_title("Queen – Bohemian Rhapsody (Remastered)")
    assert res["artist"] == "Queen"
    assert res["track"] == "Bohemian Rhapsody"


def test_parse_artist_title_channel_fallback():
    # Title without artist delimiter
    res = parse_artist_title(
        raw_title="As It Was (Official Video)",
        channel="Harry Styles - Topic",
    )
    assert res["artist"] == "Harry Styles"
    assert res["track"] == "As It Was"


def test_parse_artist_title_vevo_channel_fallback():
    res = parse_artist_title(
        raw_title="Anti-Hero [Official Audio]",
        channel="TaylorSwiftVEVO",
    )
    assert res["artist"] == "TaylorSwift"
    assert res["track"] == "Anti-Hero"
