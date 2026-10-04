import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getLyrics, getStreamUrl, getApiBase } from '@/lib/api';
import { parseLrc } from '@/lib/lrcParser';

let globalAudioElement: HTMLAudioElement | null = null;

export function getGlobalAudioElement(): HTMLAudioElement | null {
  return globalAudioElement;
}

export function useAudioClock() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setAudioClock = usePlayerStore((s) => s.setAudioClock);
  const setDownloadProgress = usePlayerStore((s) => s.setDownloadProgress);
  const setIsLoadingTrack = usePlayerStore((s) => s.setIsLoadingTrack);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const setError = usePlayerStore((s) => s.setError);

  const setLyricsData = useSettingsStore((s) => s.setLyricsData);
  const setIsLoadingLyrics = useSettingsStore((s) => s.setIsLoadingLyrics);
  const loadTrackOffset = useSettingsStore((s) => s.loadTrackOffset);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioRef.current = audio;
    globalAudioElement = audio;

    let isCancelled = false;

    const clearActivePoll = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = undefined;
      }
    };

    const handleTimeUpdate = () => {
      let bufferedEnd = 0;
      if (audio.buffered.length > 0) {
        bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      }
      setAudioClock(audio.currentTime, audio.duration || 0, bufferedEnd);
    };

    const handleLoadedMetadata = () => {
      setAudioClock(audio.currentTime, audio.duration || 0, 0);
    };

    const handleLoadStart = () => {
      setDownloadProgress(20, 'connecting');
      setIsLoadingTrack(true);
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const percent = Math.min(98, Math.max(35, (bufferedEnd / audio.duration) * 100));
        setDownloadProgress(percent, 'downloading');
      }
    };

    const handleWaiting = () => {
      setIsLoadingTrack(true);
      setDownloadProgress(80, 'downloading');
    };

    const handleCanPlay = () => {
      clearActivePoll();
      setDownloadProgress(100, 'ready');
      setIsLoadingTrack(false);
      setError(null);
    };

    const handlePlaying = () => {
      clearActivePoll();
      setDownloadProgress(100, 'ready');
      setIsLoadingTrack(false);
      setError(null);
    };

    const handleEnded = () => {
      nextTrack();
    };

    const pollBackendWakeup = (targetSrc: string) => {
      clearActivePoll();
      let attempts = 0;
      const maxAttempts = 20;
      const healthUrl = `${getApiBase()}/health`;

      const checkHealth = async () => {
        if (isCancelled || !audioRef.current || audioRef.current.src !== targetSrc) {
          return;
        }
        attempts++;
        setError(`Backend is waking up (Render free tier cold start)... Attempt ${attempts}/${maxAttempts}. Please wait.`);

        try {
          const res = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            setError('Backend is awake! Loading audio...');
            if (audioRef.current && audioRef.current.src === targetSrc) {
              audioRef.current.load();
              try {
                await audioRef.current.play();
                setError(null);
              } catch {
                setError(null);
              }
            }
            return;
          }
        } catch {
          // Still spinning up
        }

        if (attempts < maxAttempts) {
          pollTimerRef.current = setTimeout(checkHealth, 3000);
        } else {
          setError('Backend wakeup timed out. Please check your backend status on Render or refresh.');
        }
      };

      pollTimerRef.current = setTimeout(checkHealth, 2000);
    };

    const handleError = async () => {
      if (!audio.error) return;
      const code = audio.error.code;

      let msg = `Audio playback error (Code ${code}): ${audio.error.message || 'Failed to open media'}`;
      try {
        const res = await fetch(audio.src, { method: 'GET', headers: { Range: 'bytes=0-1' } });
        if (!res.ok) {
          if (res.status === 502 || res.status === 503 || res.status === 504) {
            pollBackendWakeup(audio.src);
            return;
          }
          if (res.status === 404) {
            msg = 'Audio stream not found (404). Track may be unavailable.';
          } else if (res.status === 403) {
            msg = 'Access forbidden (403). Stream may be geo-restricted or age-gated.';
          } else {
            msg = `Audio stream request returned error status ${res.status}.`;
          }
        } else {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('text/html')) {
            msg = 'Received HTML instead of audio stream. Ensure your backend URL is connected in Search.';
          }
        }
      } catch {
        // Network error reaching audio stream - check if backend health responds
        try {
          const healthRes = await fetch(`${getApiBase()}/health`, { method: 'GET', cache: 'no-store' });
          if (!healthRes.ok) {
            pollBackendWakeup(audio.src);
            return;
          }
        } catch {
          pollBackendWakeup(audio.src);
          return;
        }
        msg = `Cannot reach audio backend at ${audio.src}. Check network or backend connection.`;
      }
      setError(msg);
    };

    const handleCustomSeek = (e: Event) => {
      const customEvent = e as CustomEvent<{ time: number }>;
      if (customEvent.detail && typeof customEvent.detail.time === 'number') {
        audio.currentTime = customEvent.detail.time;
      }
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    window.addEventListener('lyricvibe:seek', handleCustomSeek);

    // Smooth clock ticker for UI progress (20Hz throttle to prevent React thrashing, while StageEngine runs at full 60Hz)
    let rafId: number | null = null;
    let lastTick = 0;
    const tickClock = (now: number) => {
      if (!audio.paused && !audio.ended && now - lastTick >= 50) {
        lastTick = now;
        setAudioClock(audio.currentTime, audio.duration || 0);
      }
      rafId = requestAnimationFrame(tickClock);
    };
    rafId = requestAnimationFrame(tickClock);

    return () => {
      isCancelled = true;
      clearActivePoll();
      if (rafId !== null) cancelAnimationFrame(rafId);
      audio.pause();
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      window.removeEventListener('lyricvibe:seek', handleCustomSeek);
    };
  }, [setAudioClock, nextTrack, setError, setDownloadProgress, setIsLoadingTrack]);

  // Handle Track Source Change & Fetch Synced Lyrics
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    let isCancelled = false;

    setDownloadProgress(14, 'connecting');
    setIsLoadingTrack(true);

    const streamSrc = getStreamUrl(currentTrack.id);
    audio.src = streamSrc;
    audio.load();

    let simProgress = 14;
    const simInterval = setInterval(() => {
      if (isCancelled || !audioRef.current || audioRef.current.src !== streamSrc) {
        clearInterval(simInterval);
        return;
      }
      if (simProgress < 85) {
        simProgress += Math.random() * 8 + 4;
        setDownloadProgress(Math.min(88, Math.round(simProgress)), 'downloading');
      }
    }, 450);

    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay may need initial user interaction
      });
    }

    // Load saved per-track timing offset
    loadTrackOffset(currentTrack.id);

    // Fetch lyrics asynchronously
    setIsLoadingLyrics(true);

    getLyrics(currentTrack.track, currentTrack.artist, currentTrack.duration)
      .then((data) => {
        if (isCancelled) return;
        if (data.syncedLyrics) {
          const parsed = parseLrc(data.syncedLyrics);
          setLyricsData({
            syncedLines: parsed.lines,
            plainLyrics: data.plainLyrics,
            isInstrumental: data.instrumental,
            candidates: data.candidates,
          });
        } else if (data.plainLyrics) {
          const parsed = parseLrc(data.plainLyrics);
          setLyricsData({
            syncedLines: parsed.lines,
            plainLyrics: data.plainLyrics,
            isInstrumental: data.instrumental,
            candidates: data.candidates,
          });
        } else {
          setLyricsData({
            syncedLines: [],
            plainLyrics: null,
            isInstrumental: data.instrumental,
            candidates: data.candidates,
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLyricsData({
            syncedLines: [],
            plainLyrics: null,
            isInstrumental: false,
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingLyrics(false);
        }
      });

    return () => {
      isCancelled = true;
      clearInterval(simInterval);
    };
  }, [currentTrack, loadTrackOffset, setIsLoadingLyrics, setLyricsData, setDownloadProgress, setIsLoadingTrack]);

  // Handle Play / Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Handle Volume / Mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);
}
