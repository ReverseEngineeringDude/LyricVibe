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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    if (isJson) {
      try {
        const errData = await res.json();
        errorMsg = errData.message || errData.error || errorMsg;
      } catch {
        // Fallback to status message
      }
    } else {
      const text = await res.text().catch(() => '');
      if (text && text.length < 200 && !text.includes('<html') && !text.includes('<!DOCTYPE')) {
        errorMsg = text;
      }
    }
    throw new Error(errorMsg);
  }

  if (!isJson) {
    const text = await res.text().catch(() => '');
    const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
    if (isHtml) {
      throw new Error(
        `Received HTML instead of JSON from API. If deployed on Firebase, ensure VITE_API_BASE_URL is set to your live backend (e.g. https://<backend>.onrender.com).`
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse response as JSON from ${url}`);
    }
  }

  try {
    return (await res.json()) as T;
  } catch (err: any) {
    throw new Error(`Failed to parse JSON response: ${err?.message || err}`);
  }
}

export async function searchTracks(query: string): Promise<TrackMetadata[]> {
  if (!query.trim()) return [];
  return fetchJson<TrackMetadata[]>(`${API_BASE}/search?q=${encodeURIComponent(query.trim())}`);
}

export async function getTrack(videoId: string): Promise<TrackMetadata> {
  return fetchJson<TrackMetadata>(`${API_BASE}/track/${encodeURIComponent(videoId)}`);
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

  return fetchJson<LyricsResponse>(`${API_BASE}/lyrics?${params.toString()}`);
}

export async function searchLyrics(query: string): Promise<LyricCandidate[]> {
  try {
    return await fetchJson<LyricCandidate[]>(`${API_BASE}/lyrics/search?q=${encodeURIComponent(query.trim())}`);
  } catch {
    return [];
  }
}

export async function uploadAudio(file: File): Promise<TrackMetadata> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchJson<TrackMetadata>(`${API_BASE}/track/upload`, {
    method: 'POST',
    body: formData,
  });
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
