import { create } from 'zustand';
import { TrackMetadata } from '@/lib/api';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedTime: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  queue: TrackMetadata[];
  originalQueue: TrackMetadata[];
  queueIndex: number;
  history: TrackMetadata[];
  favorites: TrackMetadata[];
  isLoadingTrack: boolean;
  error: string | null;

  // Actions
  playTrack: (track: TrackMetadata) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seekTo: (time: number) => void;
  setAudioClock: (currentTime: number, duration: number, bufferedTime?: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  addToQueue: (track: TrackMetadata) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (newQueue: TrackMetadata[]) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavorite: (track: TrackMetadata) => void;
  isFavorite: (trackId: string) => boolean;
  setError: (err: string | null) => void;
}

const STORAGE_KEY_QUEUE = 'lyricvibe_queue';
const STORAGE_KEY_VOLUME = 'lyricvibe_volume';
const STORAGE_KEY_FAVORITES = 'lyricvibe_favorites';
const STORAGE_KEY_HISTORY = 'lyricvibe_history';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota limits
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  bufferedTime: 0,
  volume: loadFromStorage<number>(STORAGE_KEY_VOLUME, 0.8),
  isMuted: false,
  repeatMode: 'off',
  isShuffled: false,
  queue: loadFromStorage<TrackMetadata[]>(STORAGE_KEY_QUEUE, []),
  originalQueue: loadFromStorage<TrackMetadata[]>(STORAGE_KEY_QUEUE, []),
  queueIndex: -1,
  history: loadFromStorage<TrackMetadata[]>(STORAGE_KEY_HISTORY, []),
  favorites: loadFromStorage<TrackMetadata[]>(STORAGE_KEY_FAVORITES, []),
  isLoadingTrack: false,
  error: null,

  playTrack: (track: TrackMetadata) => {
    const state = get();
    const existingIndex = state.queue.findIndex((t) => t.id === track.id);
    let newQueue = [...state.queue];
    let newIndex = existingIndex;

    if (existingIndex === -1) {
      newQueue = [track, ...state.queue];
      newIndex = 0;
    }

    // Add to history without duplicates
    const newHistory = [track, ...state.history.filter((t) => t.id !== track.id)].slice(0, 30);
    saveToStorage(STORAGE_KEY_HISTORY, newHistory);
    saveToStorage(STORAGE_KEY_QUEUE, newQueue);

    set({
      currentTrack: track,
      queue: newQueue,
      originalQueue: newQueue,
      queueIndex: newIndex,
      isPlaying: true,
      currentTime: 0,
      duration: track.duration || 0,
      history: newHistory,
      error: null,
      isLoadingTrack: true,
    });
  },

  togglePlay: () => {
    const { currentTrack, isPlaying } = get();
    if (!currentTrack) return;
    set({ isPlaying: !isPlaying });
  },

  pause: () => set({ isPlaying: false }),
  resume: () => {
    if (get().currentTrack) set({ isPlaying: true });
  },

  seekTo: (time: number) => {
    const { duration } = get();
    const clamped = Math.max(0, Math.min(time, duration || time));
    set({ currentTime: clamped });
    // Global custom event for <audio> element to consume immediately
    window.dispatchEvent(new CustomEvent('lyricvibe:seek', { detail: { time: clamped } }));
  },

  setAudioClock: (currentTime: number, duration: number, bufferedTime: number = 0) => {
    set({
      currentTime,
      duration: duration || get().duration,
      bufferedTime,
      isLoadingTrack: false,
    });
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    saveToStorage(STORAGE_KEY_VOLUME, clamped);
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  nextTrack: () => {
    const { queue, queueIndex, repeatMode } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      get().seekTo(0);
      set({ isPlaying: true });
      return;
    }

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }

    const nextTrackItem = queue[nextIndex];
    if (nextTrackItem) {
      get().playTrack(nextTrackItem);
    }
  },

  prevTrack: () => {
    const { queue, queueIndex, currentTime } = get();
    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      get().seekTo(0);
      return;
    }

    if (queue.length === 0) return;
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      get().playTrack(queue[prevIndex]);
    } else {
      get().seekTo(0);
    }
  },

  addToQueue: (track: TrackMetadata) => {
    const { queue } = get();
    if (queue.some((t) => t.id === track.id)) return;
    const updated = [...queue, track];
    saveToStorage(STORAGE_KEY_QUEUE, updated);
    set({ queue: updated, originalQueue: updated });
  },

  removeFromQueue: (index: number) => {
    const { queue, queueIndex } = get();
    const updated = queue.filter((_, i) => i !== index);
    saveToStorage(STORAGE_KEY_QUEUE, updated);

    let newIndex = queueIndex;
    if (index < queueIndex) {
      newIndex = queueIndex - 1;
    } else if (index === queueIndex && index >= updated.length) {
      newIndex = updated.length - 1;
    }

    set({ queue: updated, queueIndex: newIndex });
  },

  reorderQueue: (newQueue: TrackMetadata[]) => {
    const { currentTrack } = get();
    saveToStorage(STORAGE_KEY_QUEUE, newQueue);
    const newIndex = currentTrack ? newQueue.findIndex((t) => t.id === currentTrack.id) : -1;
    set({ queue: newQueue, queueIndex: newIndex });
  },

  clearQueue: () => {
    saveToStorage(STORAGE_KEY_QUEUE, []);
    set({ queue: [], queueIndex: -1 });
  },

  toggleShuffle: () => {
    const { isShuffled, queue, originalQueue, currentTrack } = get();
    if (!isShuffled) {
      // Shuffle except current track
      const current = currentTrack ? [currentTrack] : [];
      const rest = queue.filter((t) => !currentTrack || t.id !== currentTrack.id);
      const shuffledRest = [...rest].sort(() => Math.random() - 0.5);
      const shuffledQueue = [...current, ...shuffledRest];
      set({ isShuffled: true, queue: shuffledQueue, queueIndex: 0 });
    } else {
      const restoredIndex = currentTrack ? originalQueue.findIndex((t) => t.id === currentTrack.id) : 0;
      set({ isShuffled: false, queue: originalQueue, queueIndex: restoredIndex });
    }
  },

  toggleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = get().repeatMode;
    const nextMode = modes[(modes.indexOf(current) + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  toggleFavorite: (track: TrackMetadata) => {
    const { favorites } = get();
    const exists = favorites.some((t) => t.id === track.id);
    const updated = exists ? favorites.filter((t) => t.id !== track.id) : [track, ...favorites];
    saveToStorage(STORAGE_KEY_FAVORITES, updated);
    set({ favorites: updated });
  },

  isFavorite: (trackId: string) => {
    return get().favorites.some((t) => t.id === trackId);
  },

  setError: (err: string | null) => set({ error: err }),
}));
