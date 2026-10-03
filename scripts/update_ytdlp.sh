#!/usr/bin/env bash
set -e

echo "=== Updating yt-dlp to latest release ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"

if [ -f "$BACKEND_DIR/.venv/bin/pip" ]; then
    echo "Found backend venv. Upgrading yt-dlp in venv..."
    "$BACKEND_DIR/.venv/bin/pip" install --upgrade yt-dlp
elif command -v pip3 &> /dev/null; then
    echo "Upgrading yt-dlp via system pip3..."
    pip3 install --upgrade yt-dlp
elif command -v pip &> /dev/null; then
    echo "Upgrading yt-dlp via pip..."
    pip install --upgrade yt-dlp
else
    echo "Error: pip not found. Please install or update yt-dlp manually."
    exit 1
fi

echo "yt-dlp update complete."
