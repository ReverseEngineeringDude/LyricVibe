import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { extractPaletteFromImage, ColorPalette } from '@/lib/palette';
import { findActiveLineIndex } from '@/lib/lrcParser';
import { StageEngine } from '@/stage/StageEngine';

let globalStageCanvas: HTMLCanvasElement | null = null;
let globalStageEngine: StageEngine | null = null;

export function getGlobalStageCanvas(): HTMLCanvasElement | null {
  return globalStageCanvas;
}

export function getGlobalStageEngine(): StageEngine | null {
  return globalStageEngine;
}

export const Stage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StageEngine | null>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoadingTrack = usePlayerStore((s) => s.isLoadingTrack);
  const downloadProgress = usePlayerStore((s) => s.downloadProgress);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);

  const syncedLines = useSettingsStore((s) => s.syncedLines);
  const timingOffset = useSettingsStore((s) => s.timingOffset);
  const visualOptions = useSettingsStore((s) => s.visualOptions);
  const selectedThemeId = useSettingsStore((s) => s.selectedThemeId);
  const storyFramingMode = useSettingsStore((s) => s.storyFramingMode);
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const setActiveLineIndex = useSettingsStore((s) => s.setActiveLineIndex);

  const [palette, setPalette] = useState<ColorPalette | null>(null);

  // Extract color palette from track thumbnail
  useEffect(() => {
    if (currentTrack?.thumbnail) {
      extractPaletteFromImage(currentTrack.thumbnail).then((pal) => {
        setPalette(pal);
      });
    } else {
      setPalette(null);
    }
  }, [currentTrack?.thumbnail]);

  // Compute active lyric line index using binary search
  const activeIndex = findActiveLineIndex(syncedLines, currentTime, timingOffset);

  useEffect(() => {
    setActiveLineIndex(activeIndex);
  }, [activeIndex, setActiveLineIndex]);

  // Initialize StageEngine with Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    globalStageCanvas = canvas;
    const engine = new StageEngine(canvas);
    engineRef.current = engine;
    globalStageEngine = engine;
    engine.start();

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    resizeObserver.observe(canvas.parentElement || canvas);

    return () => {
      resizeObserver.disconnect();
      engine.dispose();
      engineRef.current = null;
      globalStageEngine = null;
      globalStageCanvas = null;
    };
  }, []);

  // Sync state to StageEngine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const targetTheme = isKineticMode ? 'kinetic' : selectedThemeId;
    engine.setTheme(targetTheme);
    engine.updateState({
      duration,
      isPlaying,
      syncedLines,
      activeLineIndex: activeIndex,
      visualOptions,
      track: currentTrack,
      palette,
      isKineticMode,
      timingOffset,
    });
  }, [
    duration,
    isPlaying,
    syncedLines,
    activeIndex,
    visualOptions,
    currentTrack,
    palette,
    selectedThemeId,
    isKineticMode,
    timingOffset,
  ]);

  // Mobile Touch Gestures & Visual Feedback
  const [touchFeedback, setTouchFeedback] = useState<{
    icon: 'play' | 'pause' | 'next' | 'prev';
    key: number;
  } | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFeedback = (icon: 'play' | 'pause' | 'next' | 'prev') => {
    setTouchFeedback({ icon, key: Date.now() });
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setTouchFeedback(null);
    }, 600);
  };

  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    const elapsed = Date.now() - touchStartTimeRef.current;

    // Horizontal Swipe Gesture (> 60px)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        nextTrack();
        triggerFeedback('next');
      } else {
        prevTrack();
        triggerFeedback('prev');
      }
      return;
    }

    // Quick Tap Gesture (< 250ms and < 15px movement) -> Toggle Play / Pause
    if (elapsed < 250 && Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
      togglePlay();
      triggerFeedback(isPlaying ? 'pause' : 'play');
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        togglePlay();
        triggerFeedback(isPlaying ? 'pause' : 'play');
      }}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden transition-all duration-500 ${
        storyFramingMode
          ? 'max-w-[420px] max-h-[820px] aspect-[9/16] rounded-3xl border-2 border-brand-500/40 shadow-2xl mx-auto my-auto overflow-hidden'
          : 'flex-1'
      }`}
    >
      {/* Downloading Audio Stream Floating Progress Toast */}
      <AnimatePresence>
        {isLoadingTrack && currentTrack && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute top-4 z-20 pointer-events-none px-4 py-2.5 rounded-2xl bg-black/80 backdrop-blur-2xl border border-amber-500/40 shadow-2xl flex flex-col gap-1.5 max-w-[88%] sm:max-w-md w-full"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span className="flex items-center gap-2 truncate">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span className="truncate">Downloading "{currentTrack.track || currentTrack.title}"</span>
              </span>
              <span className="font-mono text-amber-400 font-bold ml-2 shrink-0">{Math.round(downloadProgress)}%</span>
            </div>
            <div className="w-full bg-surfaceLight/80 h-1.5 rounded-full overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-amber-500 via-amber-400 to-brand-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-amber-400/50"
                style={{ width: `${Math.max(6, Math.min(100, downloadProgress))}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer select-none"
        aria-label="Lyric motion canvas stage"
      />

      {/* Floating Gesture Feedback Icon */}
      <AnimatePresence>
        {touchFeedback && (
          <motion.div
            key={touchFeedback.key}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1.15 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute z-20 pointer-events-none w-16 h-16 rounded-full bg-black/65 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center shadow-2xl shadow-brand-500/20"
          >
            {touchFeedback.icon === 'play' && <Play className="w-8 h-8 fill-current ml-1" />}
            {touchFeedback.icon === 'pause' && <Pause className="w-8 h-8 fill-current" />}
            {touchFeedback.icon === 'next' && <SkipForward className="w-8 h-8 fill-current" />}
            {touchFeedback.icon === 'prev' && <SkipBack className="w-8 h-8 fill-current" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
