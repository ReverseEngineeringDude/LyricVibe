import { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Download, Music2, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import './App.css';

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [lyricsData, setLyricsData] = useState([]);
  const [plainLyrics, setPlainLyrics] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const audioRef = useRef(null);
  const lyricsContainerRef = useRef(null);

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResults([]);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!data.error) {
        setResults(data);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error searching');
    }
    setIsSearching(false);
  };

  const parseLrc = (lrcString) => {
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
  };

  const fetchLyrics = async (title) => {
    setIsLoadingLyrics(true);
    setLyricsData([]);
    setPlainLyrics(null);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/lyrics?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      if (data.syncedLyrics) {
        setLyricsData(parseLrc(data.syncedLyrics));
      } else if (data.plainLyrics) {
        setPlainLyrics(data.plainLyrics);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoadingLyrics(false);
  };

  const playSong = async (item) => {
    setCurrentSong(item);
    setIsPlaying(false); // Reset while loading
    
    // Fetch lyrics concurrently
    fetchLyrics(item.title);
    
    // Fetch direct streaming URL to allow seeking (Range requests)
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stream_url?id=${item.id}`);
      const data = await res.json();
      if (data.url && audioRef.current) {
        audioRef.current.src = data.url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Error fetching stream URL", err);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    setDuration(audioRef.current.duration || 0);
  };

  const handleProgressChange = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleDownload = async () => {
    if (!currentSong) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stream_url?id=${currentSong.id}`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = data.title + '.webm';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      alert("Error downloading");
    }
  };

  // Find active lyric index
  let activeLyricIndex = -1;
  if (lyricsData.length > 0) {
    for (let i = 0; i < lyricsData.length; i++) {
      if (currentTime >= lyricsData[i].time) {
        activeLyricIndex = i;
      } else {
        break;
      }
    }
  }

  // Smooth scroll sync
  useEffect(() => {
    if (activeLyricIndex !== -1 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector('.lyric-line.active');
      if (activeEl) {
        // center the active line in the scrollable view
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyricIndex]);

  // Dynamic Background style
  const bgStyle = currentSong?.thumbnail ? { backgroundImage: `url(${currentSong.thumbnail})` } : {};

  return (
    <div className="app-wrapper">
      <div className="bg-layer" style={bgStyle}></div>
      <div className="overlay-layer"></div>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <Music2 size={28} color="#1db954" />
          Spotifaux
        </div>
        
        <div className="search-box">
          <Search size={20} color="#a0a0a0" />
          <input 
            type="text" 
            placeholder="What do you want to play?" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        
        <div className="search-results">
          {isSearching && <p className="pulse" style={{color: '#a0a0a0', textAlign: 'center', marginTop: '20px'}}>Searching...</p>}
          
          {results.map((item) => (
            <div key={item.id} className="result-item" onClick={() => playSong(item)}>
              <img src={item.thumbnail} alt="thumb" />
              <div className="result-info">
                <div className="result-title">{item.title}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        <div className="header">
          {currentSong ? (
            <>
              <h1 className="header-title">{currentSong.title}</h1>
              <p className="header-subtitle">Now Playing</p>
            </>
          ) : (
            <>
              <h1 className="header-title" style={{color: '#a0a0a0'}}>No Track Selected</h1>
              <p className="header-subtitle">Search for a song to start listening</p>
            </>
          )}
        </div>

        <div className="lyrics-stage" ref={lyricsContainerRef}>
          <div style={{ paddingBottom: '30vh' }}>
            {isLoadingLyrics && <p className="lyric-line pulse" style={{fontSize: '24px'}}>Searching for lyrics...</p>}
            
            {!isLoadingLyrics && lyricsData.length > 0 && (
              lyricsData.map((line, index) => {
                let statusClass = 'future';
                if (index === activeLyricIndex) statusClass = 'active';
                else if (index < activeLyricIndex) statusClass = 'past';
                
                return (
                  <p 
                    key={index}
                    className={`lyric-line ${statusClass}`}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = line.time;
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    }}
                  >
                    {line.text}
                  </p>
                );
              })
            )}

            {!isLoadingLyrics && lyricsData.length === 0 && plainLyrics && (
              plainLyrics.split('\n').map((line, index) => (
                <p key={index} className="lyric-line" style={{fontSize: '24px'}}>{line}</p>
              ))
            )}

            {!isLoadingLyrics && !plainLyrics && lyricsData.length === 0 && currentSong && (
              <p className="lyric-line" style={{fontSize: '24px'}}>Looks like there are no lyrics available for this track.</p>
            )}
          </div>
        </div>
      </main>

      {/* Glassmorphic Player Dock */}
      <footer className="player-dock">
        <div className="now-playing">
          {currentSong && <img src={currentSong.thumbnail} alt="cover" />}
          <div className="np-info">
            <span className="np-title">{currentSong ? currentSong.title : ''}</span>
          </div>
        </div>

        <div className="controls-center">
          <div className="playback-btns">
            <button className="btn-icon" disabled><SkipBack size={20} /></button>
            <button className="btn-icon btn-play" onClick={togglePlay} disabled={!currentSong}>
              {isPlaying ? <Pause fill="black" size={20} /> : <Play fill="black" size={20} style={{marginLeft: '4px'}} />}
            </button>
            <button className="btn-icon" disabled><SkipForward size={20} /></button>
          </div>
          
          <div className="progress-wrapper">
            <span>{formatTime(currentTime)}</span>
            <input 
              type="range" 
              className="progress-bar"
              value={currentTime} 
              min="0" 
              max={duration || 0} 
              step="0.1" 
              disabled={!currentSong}
              onChange={handleProgressChange}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="extras">
          <Volume2 size={20} color="#a0a0a0" />
          <button className="btn-download" onClick={handleDownload} disabled={!currentSong}>
            <Download size={16} />
            Save Audio
          </button>
        </div>
      </footer>

      <audio 
        ref={audioRef} 
        style={{display: 'none'}} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      ></audio>
    </div>
  );
}

export default App;
