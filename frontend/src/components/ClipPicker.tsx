import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getGlobalAudioElement } from '@/hooks/useAudioClock';
import { formatTime } from '@/lib/lrcParser';
import { Scissors, Play, Pause, X, ChevronRight, Sparkles, Clock, Music } from 'lucide-react';

export const ClipPicker: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.isClipPickerOpen);
  const toggleClipPicker = useSettingsStore((s) => s.toggleClipPicker);
  const toggleExport = useSettingsStore((s) => s.toggleExport);
  const clipRange = useSettingsStore((s) => s.clipRange);
  const setClipRange = useSettingsStore((s) => s.setClipRange);
  const syncedLines = useSettingsStore((s) => s.syncedLines);
  const timingOffset = useSettingsStore((s) => s.timingOffset);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const trackDuration = usePlayerStore((s) => s.duration) || currentTrack?.duration || 180;
  const currentTime = usePlayerStore((s) => s.currentTime);

  const [previewing, setPreviewing] = useState(false);
  const [startTime, setStartTime] = useState(clipRange[0]);
  const [endTime, setEndTime] = useState(clipRange[1]);

  // Synchronize initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialStart = Math.min(Math.max(0, Math.floor(currentTime)), Math.max(0, trackDuration - 15));
      const initialEnd = Math.min(trackDuration, initialStart + 30);
      setStartTime(initialStart);
      setEndTime(initialEnd);
      setClipRange(initialStart, initialEnd);
      setPreviewing(false);
    }
  }, [isOpen]);

  // Preview loop logic
  useEffect(() => {
    if (!previewing) return;

    const audio = getGlobalAudioElement();
    if (!audio) return;

    audio.currentTime = startTime;
    audio.play().catch(() => {});

    const interval = setInterval(() => {
      if (audio.currentTime >= endTime || audio.ended) {
        audio.currentTime = startTime;
      }
    }, 150);

    return () => {
      clearInterval(interval);
      audio.pause();
    };
  }, [previewing, startTime, endTime]);

  if (!isOpen || !currentTrack) return null;

  const clipDuration = Math.max(1, Math.round((endTime - startTime) * 10) / 10);

  const handleStartChange = (val: number) => {
    const s = Math.min(val, endTime - 1);
    setStartTime(s);
    setClipRange(s, endTime);
  };

  const handleEndChange = (val: number) => {
    const e = Math.max(val, startTime + 1);
    setEndTime(e);
    setClipRange(startTime, e);
  };

  const applyPreset = (durationSec: number) => {
    let s = startTime;
    let e = s + durationSec;
    if (e > trackDuration) {
      e = trackDuration;
      s = Math.max(0, e - durationSec);
    }
    setStartTime(s);
    setEndTime(e);
    setClipRange(s, e);
  };

  const applyFullSong = () => {
    setStartTime(0);
    setEndTime(trackDuration);
    setClipRange(0, trackDuration);
  };

  const togglePreview = () => {
    setPreviewing((prev) => !prev);
  };

  const handleProceedToExport = () => {
    setPreviewing(false);
    const audio = getGlobalAudioElement();
    if (audio) audio.pause();

    setClipRange(startTime, endTime);
    toggleClipPicker(false);
    toggleExport(true);
  };

  const handleClose = () => {
    setPreviewing(false);
    const audio = getGlobalAudioElement();
    if (audio) audio.pause();
    toggleClipPicker(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surfaceBorder/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Select Clip Range</h3>
              <p className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">
                {currentTrack.title} &bull; {currentTrack.artist}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clip Duration summary card */}
        <div className="bg-surfaceLight/60 border border-surfaceBorder rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Start Time</span>
              <span className="text-sm font-semibold text-brand-300 font-mono">{formatTime(startTime)}</span>
            </div>
            <div className="text-gray-600 font-light text-lg">&rarr;</div>
            <div>
              <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">End Time</span>
              <span className="text-sm font-semibold text-brand-300 font-mono">{formatTime(endTime)}</span>
            </div>
            <div className="h-7 w-px bg-surfaceBorder/80 mx-1 hidden sm:block" />
            <div>
              <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Clip Length</span>
              <span className="text-sm font-semibold text-white">{clipDuration}s</span>
            </div>
          </div>

          {/* Preview Play/Pause button */}
          <button
            onClick={togglePreview}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              previewing
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
            }`}
          >
            {previewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{previewing ? 'Pause Preview' : 'Preview Clip'}</span>
          </button>
        </div>

        {/* Quick Duration Preset Pills */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-400">Quick Presets</span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: '15s Status', duration: 15 },
              { label: '30s Story', duration: 30 },
              { label: '60s Reel', duration: 60 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.duration)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  clipDuration === p.duration
                    ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                    : 'bg-surfaceLight/50 border-surfaceBorder text-gray-300 hover:text-white hover:bg-surfaceLight'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={applyFullSong}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                startTime === 0 && Math.abs(endTime - trackDuration) < 1
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                  : 'bg-surfaceLight/50 border-surfaceBorder text-gray-300 hover:text-white hover:bg-surfaceLight'
              }`}
            >
              Full Song ({Math.round(trackDuration)}s)
            </button>
          </div>
        </div>

        {/* Interactive Scrubbing Sliders */}
        <div className="space-y-3 bg-surfaceLight/30 border border-surfaceBorder rounded-xl p-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Start Offset: <strong className="text-white font-mono">{formatTime(startTime)}</strong></span>
              <span>0:00</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, trackDuration - 1)}
              step={0.5}
              value={startTime}
              onChange={(e) => handleStartChange(parseFloat(e.target.value))}
              className="w-full accent-brand-500 h-1.5 bg-surfaceBorder rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>End Offset: <strong className="text-white font-mono">{formatTime(endTime)}</strong></span>
              <span>{formatTime(trackDuration)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={trackDuration}
              step={0.5}
              value={endTime}
              onChange={(e) => handleEndChange(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-surfaceBorder rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Synced Lyrics Picker Section */}
        {syncedLines.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-brand-400" />
                Snap to Synced Lyric Lines ({syncedLines.length} lines)
                {timingOffset !== 0 && (
                  <span className="text-[10px] text-brand-300 font-mono bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                    Sync: {timingOffset > 0 ? `+${timingOffset.toFixed(1)}s` : `${timingOffset.toFixed(1)}s`}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-gray-500">Click a line to set start / end</span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-surfaceBorder bg-surfaceLight/30 divide-y divide-surfaceBorder/40 text-xs">
              {syncedLines.map((line, idx) => {
                const targetAudioTime = Math.max(0, Math.round((line.time - timingOffset) * 10) / 10);
                const inRange = targetAudioTime >= startTime && targetAudioTime <= endTime;
                return (
                  <div
                    key={`${line.time}-${idx}`}
                    className={`px-3 py-2 flex items-center justify-between transition-colors ${
                      inRange
                        ? 'bg-brand-500/10 text-white font-medium'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <span className="text-[11px] font-mono text-gray-500 shrink-0">
                        {formatTime(line.time)}
                      </span>
                      <span className="truncate">{line.text}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartChange(targetAudioTime)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 hover:bg-brand-600 hover:text-white text-gray-300 transition-colors"
                        title="Set clip start here"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => handleEndChange(Math.min(trackDuration, targetAudioTime + 3))}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 hover:bg-indigo-600 hover:text-white text-gray-300 transition-colors"
                        title="Set clip end here"
                      >
                        End
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-surfaceBorder/60">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-surfaceBorder text-xs text-gray-300 hover:bg-surfaceLight transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleProceedToExport}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 flex items-center gap-1.5 transition-all hover:scale-102"
          >
            <span>Configure Video Export</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
