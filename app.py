from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import requests
import re
import os

app = Flask(__name__)
CORS(app)

# Basic ytdl options for extracting info without downloading the file to disk by default
ydl_opts_search = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'extract_flat': 'in_playlist' 
}

ydl_opts_stream = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search')
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        with yt_dlp.YoutubeDL(ydl_opts_search) as ydl:
            # We search youtube for the query and get top 5 results
            info = ydl.extract_info(f"ytsearch5:{query}", download=False)
            results = []
            if 'entries' in info:
                for entry in info['entries']:
                    results.append({
                        'id': entry.get('id'),
                        'title': entry.get('title'),
                        'thumbnail': entry.get('thumbnail') or (entry.get('thumbnails', [{}])[0].get('url') if entry.get('thumbnails') else None),
                        'duration': entry.get('duration')
                    })
            return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream')
def stream():
    video_id = request.args.get('id')
    if not video_id:
        return jsonify({"error": "No video id provided"}), 400

    try:
        # We need to extract the direct URL to the audio stream
        with yt_dlp.YoutubeDL(ydl_opts_stream) as ydl:
            info = ydl.extract_info(video_id, download=False)
            url = info['url']
            
            # Since youtube audio URLs might have CORS issues, we can either proxy it or return it.
            # Proxying is safer to bypass CORS issues on the audio element.
            req = requests.get(url, stream=True)
            return Response(stream_with_context(req.iter_content(chunk_size=1024)), content_type=req.headers['content-type'])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream_url')
def stream_url():
    video_id = request.args.get('id')
    if not video_id:
        return jsonify({"error": "No video id provided"}), 400

    try:
        with yt_dlp.YoutubeDL(ydl_opts_stream) as ydl:
            info = ydl.extract_info(video_id, download=False)
            url = info['url']
            return jsonify({"url": url, "title": info.get('title')})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/lyrics')
def lyrics():
    title = request.args.get('title')
    if not title:
        return jsonify({"error": "No title provided"}), 400

    # Clean the title (e.g. remove "Official Video", "(Lyrics)", etc.)
    clean_title = re.sub(r'\(.*?\)|\[.*?\]', '', title)
    clean_title = re.sub(r'(?i)official video|official audio|lyrics|music video', '', clean_title)
    clean_title = clean_title.strip()

    try:
        # Search lrclib.net
        # First attempt with search
        res = requests.get(f"https://lrclib.net/api/search", params={"q": clean_title})
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                best_match = data[0]
                return jsonify({
                    "plainLyrics": best_match.get("plainLyrics"),
                    "syncedLyrics": best_match.get("syncedLyrics")
                })
        return jsonify({"plainLyrics": None, "syncedLyrics": None})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
