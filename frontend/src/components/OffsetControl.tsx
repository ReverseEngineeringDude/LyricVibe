import React from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Clock, Plus, Minus, RotateCcw } from 'lucide-react';

interface OffsetControlProps {
  compact?: boolean;
}

export const OffsetControl: React.FC<OffsetControlProps> = ({ compact = false }) => {
  const timingOffset = useSettingsStore((s) => s.timingOffset);
  const setTimingOffset = useSettingsStore((s) => s.setTimingOffset);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const handleStep = (delta: number) => {
    setTimingOffset(timingOffset + delta, currentTrack?.id);
  };

  const handleReset = () => {
    setTimingOffset(0, currentTrack?.id);
  };

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimingOffset(parseFloat(e.target.value), currentTrack?.id);
  };

  const formattedOffset = timingOffset > 0 ? `+${timingOffset.toFixed(1)}s` : `${timingOffset.toFixed(1)}s`;

  if (compact) {
    return (
      <div
        className="flex items-center bg-surfaceLight/80 backdrop-blur-md px-2 py-1 rounded-xl border border-surfaceBorder text-xs text-gray-300 gap-1 shrink-0 shadow-sm"
        title="Sync Timing Offset"
      >
        <button
          onClick={() => handleStep(-0.1)}
          className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors text-gray-400"
          title="Lyrics -0.1s (earlier)"
          aria-label="Decrease timing offset"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/5 transition-colors font-mono font-semibold text-[11px] text-brand-400"
          title="Click to reset offset (0.0s)"
          aria-label="Reset offset"
        >
          <Clock className="w-3 h-3 text-brand-400" />
          <span>{formattedOffset}</span>
        </button>

        <button
          onClick={() => handleStep(0.1)}
          className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors text-gray-400"
          title="Lyrics +0.1s (later)"
          aria-label="Increase timing offset"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-surfaceLight/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-surfaceBorder text-xs text-gray-300">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Clock className="w-3.5 h-3.5 text-brand-500" />
        <span className="hidden sm:inline">Sync Offset:</span>
      </div>

      <button
        onClick={() => handleStep(-0.1)}
        className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
        title="Lyrics -0.1s (Appear earlier)"
        aria-label="Decrease timing offset"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <input
        type="range"
        min="-5.0"
        max="5.0"
        step="0.1"
        value={timingOffset}
        onChange={handleSlider}
        className="w-16 sm:w-24 h-1 bg-surfaceBorder rounded-lg appearance-none cursor-pointer accent-brand-500"
        aria-label="Timing offset slider"
      />

      <button
        onClick={() => handleStep(0.1)}
        className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
        title="Lyrics +0.1s (Appear later)"
        aria-label="Increase timing offset"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <span className="font-mono min-w-[42px] text-right font-medium text-brand-400">
        {formattedOffset}
      </span>

      {timingOffset !== 0 && (
        <button
          onClick={handleReset}
          className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors text-gray-400"
          title="Reset offset to 0.0s"
          aria-label="Reset offset"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
