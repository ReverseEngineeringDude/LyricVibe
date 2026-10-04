import React, { useState, useRef } from 'react';
import { Search, Music, Upload, Plus, Play, Loader2, X, Globe } from 'lucide-react';
import { searchTracks, uploadAudio, TrackMetadata, getCustomBackendUrl, setCustomBackendUrl } from '@/lib/api';
import { usePlayerStore } from '@/store/usePlayerStore';

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [backendUrlInput, setBackendUrlInput] = useState(getCustomBackendUrl());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isLoadingTrack = usePlayerStore((s) => s.isLoadingTrack);
  const downloadProgress = usePlayerStore((s) => s.downloadProgress);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await searchTracks(query);
      setResults(data);
      if (data.length === 0) {
        setSearchError('No songs found matching your search. Try different keywords.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSearchError(null);
    try {
      const uploaded = await uploadAudio(file);
      playTrack(uploaded);
      setResults((prev) => [uploaded, ...prev]);
    } catch (err: any) {
      setSearchError(err.message || 'Audio upload failed. Check format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSearchError(null);
    try {
      const uploaded = await uploadAudio(file);
      playTrack(uploaded);
      setResults((prev) => [uploaded, ...prev]);
    } catch (err: any) {
      setSearchError(err.message || 'Audio upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-surface/90 backdrop-blur-md rounded-2xl border border-surfaceBorder overflow-hidden shadow-xl">
      {/* Header & Search Bar */}
      <div className="p-4 border-b border-surfaceBorder/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold text-sm tracking-wide text-white">Discover & Search</h2>
          </div>
          <span className="text-[11px] text-gray-400">YouTube + Local</span>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search song, artist, album..."
            className="w-full bg-surfaceLight border border-surfaceBorder/80 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5 pointer-events-none" />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="absolute right-3 top-3 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Upload Fallback Banner / Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="mx-4 mt-3 p-3 rounded-xl border border-dashed border-surfaceBorder hover:border-brand-500/50 bg-surfaceLight/40 hover:bg-surfaceLight/70 transition-all cursor-pointer flex items-center justify-between group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-200">
              {isUploading ? 'Uploading & parsing audio...' : 'Drop your audio file here'}
            </div>
            <div className="text-[10px] text-gray-400">MP3, M4A, FLAC, WAV (fallback player)</div>
          </div>
        </div>
        <span className="text-[11px] font-medium text-brand-400 group-hover:underline">Browse</span>
      </div>

      {/* Results / Empty / Skeleton State */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {searchError && (
          <div className="p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-200 space-y-2.5">
            <div>{searchError}</div>
            {(searchError.includes('VITE_API_BASE_URL') || searchError.includes('HTML instead of JSON')) && (
              <div className="pt-2 border-t border-red-800/40 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-300 font-medium">
                  <Globe className="w-3.5 h-3.5 text-brand-400" />
                  Connect Backend URL (Render / PythonAnywhere):
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://lyricvibe-backend.onrender.com"
                    value={backendUrlInput}
                    onChange={(e) => setBackendUrlInput(e.target.value)}
                    className="flex-1 bg-surface border border-surfaceBorder rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (backendUrlInput.trim()) {
                        setCustomBackendUrl(backendUrlInput);
                        setSearchError(null);
                        handleSearch();
                      }
                    }}
                    className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                  >
                    Save & Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isSearching && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-12 h-12 bg-surfaceLight rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-surfaceLight rounded w-3/4" />
                  <div className="h-2.5 bg-surfaceLight rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isSearching && results.length === 0 && !searchError && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surfaceLight flex items-center justify-center text-gray-500">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">Ready to play</p>
              <p className="text-xs text-gray-500 max-w-[220px] mt-1">
                Type song title or artist above to load audio and synced lyrics.
              </p>
            </div>
          </div>
        )}

        {!isSearching &&
          results.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            const isDownloading = isCurrent && isLoadingTrack;
            return (
              <div
                key={track.id}
                className={`group flex flex-col p-2 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-brand-500/10 border-brand-500/40 text-white'
                    : 'bg-surfaceLight/30 border-surfaceBorder/40 hover:bg-surfaceLight/80 hover:border-surfaceBorder'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    onClick={() => playTrack(track)}
                  >
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-surfaceBorder">
                      {track.thumbnail ? (
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-500/20 text-brand-400">
                          <Music className="w-5 h-5" />
                        </div>
                      )}
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                        isDownloading
                          ? 'bg-black/60 opacity-100'
                          : 'bg-black/40 opacity-0 group-hover:opacity-100'
                      }`}>
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 fill-white text-white" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-brand-400' : 'text-gray-100'}`}>
                        {track.track || track.title}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate flex items-center gap-1.5">
                        {isDownloading ? (
                          <span className="text-amber-400 font-medium flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Downloading {Math.round(downloadProgress)}%
                          </span>
                        ) : (
                          <span>{track.artist || track.channel} • {formatDuration(track.duration)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => addToQueue(track)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 active:scale-90 rounded-lg text-gray-400 hover:text-white transition-all"
                      title="Add to Up Next"
                      aria-label="Add to Queue"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => playTrack(track)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-brand-500/20 active:scale-90 rounded-lg text-brand-400 transition-all"
                      title="Play Now"
                      aria-label="Play Now"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress bar informing user of downloading progress */}
                {isDownloading && (
                  <div className="w-full bg-surfaceLight/80 h-1.5 rounded-full overflow-hidden mt-2 border border-white/5">
                    <div
                      className="bg-gradient-to-r from-amber-500 via-amber-400 to-brand-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-amber-400/50"
                      style={{ width: `${Math.max(6, Math.min(100, downloadProgress))}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
