export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  track: string;
  channel?: string;
  uploader?: string;
  duration: number;
  thumbnail: string;
  is_upload?: boolean;
}

export interface LyricCandidate {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  hasSynced?: boolean;
  instrumental?: boolean;
  syncedLyrics?: string;
  plainLyrics?: string;
}

export interface LyricsResponse {
  id: number | null;
  trackName: string;
  artistName: string;
  duration: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental: boolean;
  candidates?: LyricCandidate[];
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const API_BASE = `${BASE_URL}/api`;

export async function searchTracks(query: string): Promise<TrackMetadata[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Search failed with status ${res.status}`);
  }
  return res.json();
}

export async function getTrack(videoId: string): Promise<TrackMetadata> {
  const res = await fetch(`${API_BASE}/track/${encodeURIComponent(videoId)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch track: ${res.status}`);
  }
  return res.json();
}

export async function getLyrics(
  track: string,
  artist: string = '',
  duration?: number
): Promise<LyricsResponse> {
  const params = new URLSearchParams({
    track: track.trim(),
    artist: artist.trim(),
  });
  if (duration && duration > 0) {
    params.set('duration', Math.round(duration).toString());
  }

  const res = await fetch(`${API_BASE}/lyrics?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch lyrics: ${res.status}`);
  }
  return res.json();
}

export async function searchLyrics(query: string): Promise<LyricCandidate[]> {
  const res = await fetch(`${API_BASE}/lyrics/search?q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function uploadAudio(file: File): Promise<TrackMetadata> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/track/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Upload failed with status ${res.status}`);
  }
  return res.json();
}

export function getStreamUrl(videoId: string): string {
  return `${API_BASE}/stream/${encodeURIComponent(videoId)}`;
}

export async function convertToMp4(webmBlob: Blob): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', webmBlob, 'recording.webm');

  const res = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Conversion failed: ${res.status}`);
  }

  return res.blob();
}
