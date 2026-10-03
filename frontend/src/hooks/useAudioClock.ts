import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getLyrics, getStreamUrl } from '@/lib/api';
import { parseLrc } from '@/lib/lrcParser';

let globalAudioElement: HTMLAudioElement | null = null;

export function getGlobalAudioElement(): HTMLAudioElement | null {
  return globalAudioElement;
}

export function useAudioClock() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setAudioClock = usePlayerStore((s) => s.setAudioClock);
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

    const handleEnded = () => {
      nextTrack();
    };

    const handleError = async () => {
      if (!audio.error) return;
      const code = audio.error.code;

      let msg = `Audio playback error (Code ${code}): ${audio.error.message || 'Failed to open media'}`;
      try {
        const res = await fetch(audio.src, { method: 'HEAD' });
        if (!res.ok) {
          if (res.status === 502 || res.status === 503) {
            setError('Backend server is spinning up (cold start)... Retrying in 4s.');
            setTimeout(() => {
              if (audioRef.current && audioRef.current.src === audio.src) {
                audioRef.current.load();
                audioRef.current.play().catch(() => {});
              }
            }, 4000);
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

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
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
      if (rafId !== null) cancelAnimationFrame(rafId);
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      window.removeEventListener('lyricvibe:seek', handleCustomSeek);
    };
  }, [setAudioClock, nextTrack, setError]);

  // Handle Track Source Change & Fetch Synced Lyrics
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const streamSrc = getStreamUrl(currentTrack.id);
    audio.src = streamSrc;
    audio.load();

    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay may need initial user interaction
      });
    }

    // Load saved per-track timing offset
    loadTrackOffset(currentTrack.id);

    // Fetch lyrics asynchronously
    let isCancelled = false;
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
    };
  }, [currentTrack, loadTrackOffset, setIsLoadingLyrics, setLyricsData]);

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
