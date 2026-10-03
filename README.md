# LyricVibe 🎵✨

LyricVibe is a high-performance music player and kinetic lyrics status/story generator with dynamic visual themes, real-time synchronized typography, and high-fidelity video export.

---

## 🌟 Key Features

- **Kinetic Mode (Kinetic Typography)**:
  - 60 FPS deterministic canvas typography rendering driven by audio time.
  - Multi-template phrase layouts: *Centered Hero*, *Stacked Left*, *Diagonal Cascade*, *Split*, and *Fullscreen*.
  - Collision-free layout algorithms preventing lyrics overlaps.
  - Smooth spring transitions and virtual camera with subtle Perlin drift.
  - Word-level synchronization with active speech highlighting, underline sweeps, and beat pulsation.
  - Zero flicker / zero blinking across seeking and playback.
- **Aesthetic Mood Mode**:
  - Ambient fluid canvas visualizer with color extraction from track artwork.
- **Synchronized Lyrics**:
  - Automatic lookup via [LRCLIB](https://lrclib.net) with manual candidate selector and timestamp offset adjustment (`±ms`).
- **Flexible Aspect Ratios**:
  - 9:16 (Stories/Reels/Shorts), 1:1 (Square), and 16:9 (Landscape).
- **Video & Story Export**:
  - Live canvas recording with clean audio merge and MP4 conversion via FFmpeg.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│        Frontend (React)         │       │        Backend (FastAPI)        │
│ Hosted on Firebase Hosting      │       │ Hosted on PythonAnywhere        │
│                                 │       │                                 │
│  - React 18 + TypeScript        │ HTTP  │  - FastAPI + Uvicorn / WSGI     │
│  - Vite + Tailwind CSS          ├──────►│  - yt-dlp (Audio extraction)    │
│  - HTML5 Canvas 2D Stage Engine │       │  - LRCLIB (Synced lyrics)       │
│  - Zustand State Store          │       │  - Librosa (Beats & energy)     │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## 💻 Local Development

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --port 8000 --reload
```
API runs on `http://127.0.0.1:8000`. Test via `http://127.0.0.1:8000/api/health`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. In development, Vite automatically proxies `/api` requests to `http://127.0.0.1:8000`.

---

## 🚀 Deployment Guide

This guide details how to deploy:
- **Backend**: Hosted on [PythonAnywhere](https://www.pythonanywhere.com/) (WSGI with `a2wsgi` adapter)
- **Frontend**: Hosted on [Firebase Hosting](https://firebase.google.com/docs/hosting)

---

### Part 1: Deploy Backend to PythonAnywhere

PythonAnywhere natively serves Python web apps using the **WSGI** standard. Because FastAPI is an **ASGI** application, we use the `a2wsgi` adapter included in `backend/requirements.txt` to run FastAPI seamlessly.

#### Step 1: Open Bash Console on PythonAnywhere
1. Log in to [PythonAnywhere](https://www.pythonanywhere.com/).
2. Go to the **Consoles** tab and start a new **Bash** console.

#### Step 2: Clone or Upload the Code
In the Bash console, clone your repository (or create the directory and upload your files):
```bash
git clone https://github.com/<your-username>/<your-repo>.git /home/<your-username>/lyrics
cd /home/<your-username>/lyrics
```
*(Replace `<your-username>` with your actual PythonAnywhere username)*.

#### Step 3: Create a Virtualenv & Install Dependencies
```bash
mkvirtualenv lyrics-venv --python=python3.10
pip install --upgrade pip
pip install -r backend/requirements.txt
```
> [!NOTE]
> Note down the virtual environment path: `/home/<your-username>/.virtualenvs/lyrics-venv`.

#### Step 4: Configure the Web App
1. Go to the **Web** tab in PythonAnywhere dashboard.
2. Click **"Add a new web app"**.
3. Choose your domain (e.g. `<your-username>.pythonanywhere.com`).
4. Select **"Manual configuration"** (do NOT choose Django or Flask).
5. Choose **Python 3.10** (matching your virtualenv).
6. Under the **Virtualenv** section:
   - Enter: `/home/<your-username>/.virtualenvs/lyrics-venv`
7. Under the **Code** section:
   - Source code: `/home/<your-username>/lyrics`
   - Working directory: `/home/<your-username>/lyrics`

#### Step 5: Edit the WSGI Configuration File
In the **Web** tab under **Code**, click on the link for the **WSGI configuration file** (`/var/www/<your-username>_pythonanywhere_com_wsgi.py`).

Delete all default boilerplate and replace it with:
```python
import sys
import os

# Project root directory
project_home = '/home/<your-username>/lyrics'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set environment variables if needed
os.environ["PYTHONPATH"] = project_home

# Import a2wsgi and wrap the FastAPI ASGI app into WSGI
from a2wsgi import ASGIMiddleware
from backend.main import app as asgi_app

application = ASGIMiddleware(asgi_app)
```
*(Make sure to replace `<your-username>` with your PythonAnywhere username!)*

Save the file.

#### Step 6: Reload & Test
1. Click the green **"Reload <your-username>.pythonanywhere.com"** button at the top of the **Web** tab.
2. In your browser, test the health check endpoint:
   ```
   https://<your-username>.pythonanywhere.com/api/health
   ```
   You should see:
   ```json
   {"status":"ok","service":"LyricVibe"}
   ```

> [!TIP]
> **Free Account Outbound Proxy Notice**:
> PythonAnywhere free tier allows outbound HTTP/HTTPS requests only to whitelisted domains.
> - `lrclib.net` is typically allowed or requestable on the PA whitelist forum.
> - If `yt-dlp` streaming triggers proxy restrictions on free accounts, consider a PythonAnywhere "Hacker" tier ($5/mo) which grants unrestricted outbound internet access.

---

### Part 2: Deploy Frontend to Firebase Hosting

Firebase Hosting provides ultra-fast global CDN delivery, automated SSL certificates, and custom domains.

#### Step 1: Install Firebase CLI & Login
If you haven't installed `firebase-tools`:
```bash
npm install -g firebase-tools
firebase login
```

#### Step 2: Set the Production Backend URL
Create or update `frontend/.env.production` with your PythonAnywhere URL:
```bash
echo "VITE_API_BASE_URL=https://<your-username>.pythonanywhere.com" > frontend/.env.production
```
*(Replace `<your-username>` with your actual PythonAnywhere domain)*.

#### Step 3: Build the Frontend
From the `frontend` directory:
```bash
cd frontend
npm install
npm run build
```
This compiles TypeScript and builds optimized production bundles into `frontend/dist/`.

#### Step 4: Initialize Firebase (If not already linked)
From the project root directory:
```bash
firebase init hosting
```
When prompted:
- **Project**: Select or create your Firebase project.
- **What do you want to use as your public directory?**: `frontend/dist`
- **Configure as a single-page app (rewrite all urls to /index.html)?**: `Yes`
- **Set up automatic builds and deploys with GitHub?**: `No` (or `Yes` if desired)
- **File frontend/dist/index.html already exists. Overwrite?**: `No`

The repository already includes pre-configured `firebase.json` files for immediate use.

#### Step 5: Deploy to Firebase Hosting
From the root directory:
```bash
firebase deploy --only hosting
```
Or directly from `frontend/`:
```bash
cd frontend
firebase deploy --only hosting
```

Your app is now live at:
```
https://<your-project-id>.web.app
https://<your-project-id>.firebaseapp.com
```

---

## 🔒 Verification & CORS Check

1. Open your live Firebase website: `https://<your-project-id>.web.app`.
2. Open DevTools (F12 -> Console & Network).
3. Search for a track or paste a song name.
4. Verify requests succeed against `https://<your-username>.pythonanywhere.com/api/...`.
5. Switch to **Kinetic Mode** in the top bar:
   - Check that lyrics render smoothly without blinking.
   - Verify word-level timing updates and fluid camera animations.
   - Test changing visual options (intensity, font set, palette, camera toggle).

---

## 🛠️ Project Structure

```
├── backend/
│   ├── main.py                     # FastAPI entrypoint & CORS middleware
│   ├── config.py                   # Paths, cache folders, and settings
│   ├── requirements.txt            # Dependencies (FastAPI, yt-dlp, librosa, a2wsgi)
│   ├── routers/
│   │   ├── search.py               # YouTube & sound search
│   │   ├── stream.py               # Audio streaming with HTTP 206 range support
│   │   ├── lyrics.py               # LRCLIB synced lyrics integration
│   │   ├── analysis.py             # Audio beat, energy & word timing analysis
│   │   └── convert.py              # WebM to MP4 FFmpeg conversion
│   └── services/
│       ├── audio_analysis.py       # Librosa beat detection & fallback grid
│       ├── ytdlp_service.py        # yt-dlp extractor
│       └── lrclib_service.py       # Lyrics fetcher & search
├── frontend/
│   ├── src/
│   │   ├── components/             # Stage, Player, LyricPicker, ExportModal
│   │   ├── stage/
│   │   │   ├── StageEngine.ts      # 60fps canvas animation engine
│   │   │   ├── themes/
│   │   │   │   ├── kineticTheme.ts # Kinetic Typography pure render theme
│   │   │   │   └── aestheticMood.ts# Ambient mood visualization
│   │   │   └── kinetic/            # Layout engine, PRNG, anim presets, camera
│   │   ├── store/                  # Zustand player & UI stores
│   │   └── lib/api.ts              # API client with VITE_API_BASE_URL support
│   ├── firebase.json               # Frontend Firebase hosting config
│   ├── .env.example                # Example environment variables
│   └── package.json
├── firebase.json                   # Root Firebase hosting config
├── wsgi.py                         # PythonAnywhere WSGI entrypoint
└── README.md
```

---

## 📄 License
MIT License. Created with ❤️ for music and typography lovers.
