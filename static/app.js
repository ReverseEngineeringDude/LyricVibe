const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');
const playerThumbnail = document.getElementById('playerThumbnail');
const playerTitle = document.getElementById('playerTitle');
const currentSongTitle = document.getElementById('currentSongTitle');
const downloadBtn = document.getElementById('downloadBtn');
const lyricsContent = document.getElementById('lyricsContent');

let syncedLyricsData = [];
let currentVideoId = null;

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
        searchResults.innerHTML = '<p style="color: #b3b3b3; text-align: center;">Searching...</p>';
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                searchResults.innerHTML = '';
                if (data.error) {
                    searchResults.innerHTML = `<p style="color: red;">${data.error}</p>`;
                    return;
                }
                data.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'result-item';
                    div.innerHTML = `
                        <img src="${item.thumbnail}" alt="thumb">
                        <div class="result-info">
                            <div class="result-title">${item.title}</div>
                        </div>
                    `;
                    div.addEventListener('click', () => playSong(item));
                    searchResults.appendChild(div);
                });
            })
            .catch(err => {
                searchResults.innerHTML = `<p style="color: red;">Error searching</p>`;
            });
    }
});

function parseLrc(lrcString) {
    const lines = lrcString.split('\n');
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    const lrcData = [];
    
    for (let line of lines) {
        const match = line.match(regex);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const ms = parseInt(match[3].length === 2 ? match[3] + '0' : match[3]);
            const time = minutes * 60 + seconds + ms / 1000;
            const text = match[4].trim();
            if (text) {
                lrcData.push({ time, text });
            }
        }
    }
    return lrcData;
}

function fetchLyrics(title) {
    lyricsContent.innerHTML = '<p class="placeholder-text">Searching for lyrics...</p>';
    syncedLyricsData = [];
    fetch(`/api/lyrics?title=${encodeURIComponent(title)}`)
        .then(res => res.json())
        .then(data => {
            if (data.syncedLyrics) {
                syncedLyricsData = parseLrc(data.syncedLyrics);
                renderSyncedLyrics();
            } else if (data.plainLyrics) {
                lyricsContent.innerHTML = data.plainLyrics.split('\n').map(line => `<p class="lyric-line">${line}</p>`).join('');
            } else {
                lyricsContent.innerHTML = '<p class="placeholder-text">No lyrics found.</p>';
            }
        })
        .catch(err => {
            lyricsContent.innerHTML = '<p class="placeholder-text">Error fetching lyrics.</p>';
        });
}

function renderSyncedLyrics() {
    lyricsContent.innerHTML = '';
    syncedLyricsData.forEach((line, index) => {
        const p = document.createElement('p');
        p.className = 'lyric-line';
        p.innerText = line.text;
        p.dataset.index = index;
        p.addEventListener('click', () => {
            audioPlayer.currentTime = line.time;
            audioPlayer.play();
        });
        lyricsContent.appendChild(p);
    });
}

function playSong(item) {
    currentVideoId = item.id;
    
    playerTitle.innerText = item.title;
    currentSongTitle.innerText = item.title;
    playerThumbnail.src = item.thumbnail;
    playerThumbnail.style.display = 'block';
    
    playPauseBtn.disabled = false;
    progressBar.disabled = false;
    downloadBtn.disabled = false;
    
    audioPlayer.src = `/api/stream?id=${item.id}`;
    audioPlayer.play();
    playPauseBtn.innerText = '⏸';
    
    fetchLyrics(item.title);
}

playPauseBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseBtn.innerText = '⏸';
    } else {
        audioPlayer.pause();
        playPauseBtn.innerText = '▶';
    }
});

audioPlayer.addEventListener('timeupdate', () => {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    
    currentTimeEl.innerText = formatTime(current);
    if (!isNaN(duration)) {
        durationTimeEl.innerText = formatTime(duration);
        progressBar.max = duration;
        progressBar.value = current;
    }
    
    // Sync lyrics
    if (syncedLyricsData.length > 0) {
        let activeIndex = -1;
        for (let i = 0; i < syncedLyricsData.length; i++) {
            if (current >= syncedLyricsData[i].time) {
                activeIndex = i;
            } else {
                break;
            }
        }
        
        const lines = lyricsContent.querySelectorAll('.lyric-line');
        lines.forEach((line, index) => {
            if (index === activeIndex) {
                if (!line.classList.contains('active')) {
                    line.classList.add('active');
                    // Scroll into view smoothly
                    line.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                line.classList.remove('active');
            }
        });
    }
});

progressBar.addEventListener('input', () => {
    audioPlayer.currentTime = progressBar.value;
});

downloadBtn.addEventListener('click', () => {
    if (!currentVideoId) return;
    
    // Simple download by opening the proxy in a new tab, or fetching stream_url
    // We can fetch stream_url to trigger download or download the proxy
    fetch(`/api/stream_url?id=${currentVideoId}`)
        .then(res => res.json())
        .then(data => {
            if (data.url) {
                const a = document.createElement('a');
                a.href = data.url;
                a.download = data.title + '.webm'; // Youtube default audio often webm or m4a
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
});
