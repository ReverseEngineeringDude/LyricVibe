import React, { useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  SlidersHorizontal,
  Film,
  Smartphone,
  Music,
  Eye,
  Zap,
} from 'lucide-react';
import { OffsetControl } from './OffsetControl';

export const Player: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const bufferedTime = usePlayerStore((s) => s.bufferedTime);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffled = usePlayerStore((s) => s.isShuffled);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const isFavorite = usePlayerStore((s) => (currentTrack ? s.isFavorite(currentTrack.id) : false));

  const toggleQueue = useSettingsStore((s) => s.toggleQueue);
  const isQueueOpen = useSettingsStore((s) => s.isQueueOpen);
  const toggleClipPicker = useSettingsStore((s) => s.toggleClipPicker);
  const toggleStoryFraming = useSettingsStore((s) => s.toggleStoryFraming);
  const storyFramingMode = useSettingsStore((s) => s.storyFramingMode);
  const toggleStatusMode = useSettingsStore((s) => s.toggleStatusMode);
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const toggleKineticMode = useSettingsStore((s) => s.toggleKineticMode);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? ((scrubTime ?? currentTime) / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  const calculateTimeFromClientX = (clientX: number) => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (clickX / rect.width) * duration;
  };

  const handleSeek = (clientX: number) => {
    const newTime = calculateTimeFromClientX(clientX);
    seekTo(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const initialTime = calculateTimeFromClientX(e.clientX);
    setScrubTime(initialTime);

    const onMouseMove = (ev: MouseEvent) => {
      const updatedTime = calculateTimeFromClientX(ev.clientX);
      setScrubTime(updatedTime);
    };

    const onMouseUp = (ev: MouseEvent) => {
      setIsScrubbing(false);
      const finalTime = calculateTimeFromClientX(ev.clientX);
      seekTo(finalTime);
      setScrubTime(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const touch = e.touches[0];
    const initialTime = calculateTimeFromClientX(touch.clientX);
    setScrubTime(initialTime);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const touch = e.touches[0];
    const updatedTime = calculateTimeFromClientX(touch.clientX);
    setScrubTime(updatedTime);
  };

  const handleTouchEnd = () => {
    setIsScrubbing(false);
    if (scrubTime !== null) {
      seekTo(scrubTime);
      setScrubTime(null);
    }
  };

  return (
    <div className="w-full bg-surface/95 backdrop-blur-xl border-t border-surfaceBorder px-2.5 sm:px-4 pt-2 sm:pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:pb-3 select-none z-30">
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5 sm:gap-2">
        {/* Seek Bar with Buffered Indicator & Touch Scrubbing */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 min-w-[32px] sm:min-w-[36px] text-right">
            {formatTime(scrubTime ?? currentTime)}
          </span>

          <div
            ref={progressBarRef}
            onClick={(e) => handleSeek(e.clientX)}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="group relative flex-1 h-6 flex items-center cursor-pointer touch-none select-none -my-1"
            role="slider"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-label="Seek bar"
          >
            {/* Track container */}
            <div className="relative w-full h-1.5 sm:h-2 bg-surfaceLight rounded-full overflow-hidden py-0.5">
              {/* Buffered Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-surfaceBorder/80 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, bufferedPercent)}%` }}
              />
              {/* Played Progress Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>

            {/* Glowing Touch Scrub Thumb */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md shadow-brand-500/50 border border-brand-400 pointer-events-none transition-transform ${
                isScrubbing ? 'scale-125 ring-4 ring-brand-500/40' : 'scale-0 group-hover:scale-100 sm:group-hover:scale-100'
              }`}
              style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>

          <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 min-w-[32px] sm:min-w-[36px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Player Controls Bar */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Track Info */}
          {/* Left: Track Info */}
          <div className="flex-1 min-w-0 max-w-[42%] sm:max-w-[30%] flex items-center gap-2 sm:gap-3">
            {currentTrack ? (
              <>
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden shrink-0 bg-surfaceLight border border-surfaceBorder shadow-md">
                  {currentTrack.thumbnail ? (
                    <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-brand-500/20 text-brand-400">
                      <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                    {currentTrack.track || currentTrack.title}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">
                    {currentTrack.artist || currentTrack.uploader || 'Unknown Artist'}
                  </p>
                </div>
                <button
                  onClick={() => toggleFavorite(currentTrack)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors shrink-0 ${
                    isFavorite ? 'text-red-500 hover:text-red-400' : 'text-gray-400 hover:text-white'
                  }`}
                  aria-label="Toggle favorite"
                >
                  <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Music className="w-4 h-4 shrink-0" />
                <span className="truncate">No track playing</span>
              </div>
            )}
          </div>

          {/* Core Controls (shrink-0 prevents right tools from squeezing or overlapping) */}
          <div className="shrink-0 flex items-center gap-1 sm:gap-2.5 md:gap-3.5 justify-center px-1">
            <button
              onClick={toggleShuffle}
              className={`hidden sm:flex p-2 rounded-lg transition-colors ${
                isShuffled ? 'text-brand-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Shuffle"
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={prevTrack}
              className="p-1.5 sm:p-2 text-gray-300 hover:text-white rounded-lg transition-colors hover:bg-white/5"
              title="Previous"
              aria-label="Previous track"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-transform disabled:opacity-40"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="p-1.5 sm:p-2 text-gray-300 hover:text-white rounded-lg transition-colors hover:bg-white/5"
              title="Next"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`hidden sm:flex p-2 rounded-lg transition-colors ${
                repeatMode !== 'off' ? 'text-brand-400' : 'text-gray-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
              aria-label="Repeat mode"
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Right Tools & Volume */}
          <div className="flex-1 min-w-0 flex items-center justify-end gap-1 sm:gap-2">
            {/* Timing Offset Control (compact stepper in player bar) */}
            <div className="hidden lg:block shrink-0">
              <OffsetControl compact={true} />
            </div>

            {/* 9:16 Story Preview Toggle */}
            <button
              onClick={toggleStoryFraming}
              className={`hidden md:flex p-2 rounded-xl border transition-colors shrink-0 ${
                storyFramingMode
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                  : 'bg-surfaceLight/40 border-surfaceBorder text-gray-400 hover:text-white'
              }`}
              title="Preview 9:16 Story Framing"
              aria-label="Preview 9:16 Story Framing"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            {/* Kinetic Typography Mode Toggle */}
            <button
              onClick={() => toggleKineticMode()}
              className={`hidden sm:flex p-2 sm:px-2.5 sm:py-2 rounded-xl border text-xs font-medium items-center gap-1.5 transition-all shadow-sm shrink-0 ${
                isKineticMode
                  ? 'bg-gradient-to-r from-amber-500/25 to-brand-500/25 border-amber-500/50 text-amber-300 shadow-amber-500/10 scale-102 font-semibold'
                  : 'bg-surfaceLight/60 hover:bg-surfaceLight border-surfaceBorder text-gray-300 hover:text-white'
              }`}
              title="Kinetic Mode: Dynamic typography overlay (Hotkey: 'K')"
              aria-label="Kinetic Mode"
            >
              <Zap className={`w-4 h-4 ${isKineticMode ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
              <span className="hidden xl:inline">Kinetic</span>
            </button>

            {/* Status Mode Toggle (Clean Lyrics Only) */}
            <button
              onClick={() => toggleStatusMode(true)}
              className="hidden sm:flex p-2 sm:px-2.5 sm:py-2 rounded-xl bg-surfaceLight/60 hover:bg-surfaceLight border border-surfaceBorder text-gray-300 hover:text-white text-xs font-medium items-center gap-1.5 transition-all shadow-sm shrink-0"
              title="Status Mode (Lyrics Only — Hotkey: 'S')"
              aria-label="Status Mode"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="hidden xl:inline">Status</span>
            </button>

            {/* Video Export Modal Trigger */}
            <button
              onClick={() => toggleClipPicker(true)}
              disabled={!currentTrack}
              className="p-1.5 sm:p-2 sm:px-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-brand-500/20 disabled:opacity-40 transition-all hover:scale-102 shrink-0"
              title="Export Story / Status Video"
            >
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xl:inline">Export</span>
            </button>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center gap-2 group">
              <button
                onClick={toggleMute}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                aria-label="Mute / Unmute"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 lg:w-20 h-1 bg-surfaceBorder rounded-lg appearance-none cursor-pointer accent-brand-500"
                aria-label="Volume slider"
              />
            </div>

            {/* Queue Toggle */}
            <button
              onClick={() => toggleQueue()}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors shrink-0 ${
                isQueueOpen
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                  : 'bg-surfaceLight/40 border-surfaceBorder text-gray-400 hover:text-white'
              }`}
              title="Queue & Library"
              aria-label="Toggle queue"
            >
              <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
