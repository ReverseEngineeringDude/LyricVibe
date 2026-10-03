import React, { useState, useEffect, useRef } from 'react';
import { useAudioClock } from '@/hooks/useAudioClock';
import { useMediaSession } from '@/hooks/useMediaSession';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { Stage } from '@/components/Stage';
import { Player } from '@/components/Player';
import { SearchPanel } from '@/components/SearchPanel';
import { StylePanel } from '@/components/StylePanel';
import { Queue } from '@/components/Queue';
import { LyricPicker } from '@/components/LyricPicker';
import { ClipPicker } from '@/components/ClipPicker';
import { ExportModal } from '@/components/ExportModal';
import { BottomSheet } from '@/components/BottomSheet';
import { KineticOverlay } from '@/components/KineticOverlay';

import {
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Smartphone,
  Zap,
} from 'lucide-react';

export const App: React.FC = () => {
  // Activate player audio hooks & hotkeys
  useAudioClock();
  useMediaSession();
  useKeyboard();

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Status Mode & Kinetic Mode state
  const isStatusMode = useSettingsStore((s) => s.isStatusMode);
  const toggleStatusMode = useSettingsStore((s) => s.toggleStatusMode);
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const toggleKineticMode = useSettingsStore((s) => s.toggleKineticMode);
  const storyFramingMode = useSettingsStore((s) => s.storyFramingMode);
  const toggleStoryFraming = useSettingsStore((s) => s.toggleStoryFraming);

  const error = usePlayerStore((s) => s.error);
  const setError = usePlayerStore((s) => s.setError);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);

  // Auto-hiding minimal controls in Status Mode
  const [showStatusControls, setShowStatusControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleActivity = () => {
    setShowStatusControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowStatusControls(false);
    }, 2800);
  };

  useEffect(() => {
    if (!isStatusMode) {
      setShowStatusControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      handleActivity();
    }
  }, [isStatusMode]);

  return (
    <div
      onMouseMove={isStatusMode ? handleActivity : undefined}
      onTouchStart={isStatusMode ? handleActivity : undefined}
      className="relative w-screen h-screen flex flex-col bg-background text-gray-100 overflow-hidden font-sans select-none"
    >
      {/* 1. Normal Navigation Header (Hidden in Status Mode) */}
      {!isStatusMode && (
        <header className="h-14 border-b border-surfaceBorder/60 bg-surface/80 backdrop-blur-xl px-4 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                <Sparkles className="w-4 h-4 fill-white" />
              </div>
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                LyricVibe
              </span>
            </div>
          </div>

          {/* Center Now Playing Pill */}
          {currentTrack && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surfaceLight/60 border border-surfaceBorder/80 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-gray-300 font-medium truncate max-w-[260px]">
                {currentTrack.track || currentTrack.title}
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400 truncate max-w-[140px]">{currentTrack.artist}</span>
            </div>
          )}

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2">
            {/* Quick Kinetic Mode Trigger */}
            <button
              onClick={() => toggleKineticMode()}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                isKineticMode
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold shadow-amber-500/10'
                  : 'bg-surfaceLight hover:bg-surfaceLight/80 border-surfaceBorder hover:border-amber-500/40 text-gray-200 hover:text-white'
              }`}
              title="Toggle Kinetic Mode: Animated typography overlay (Hotkey: K)"
            >
              <Zap className={`w-3.5 h-3.5 ${isKineticMode ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
              <span className="hidden sm:inline">Kinetic</span>
            </button>

            {/* Quick Status Mode Trigger */}
            <button
              onClick={() => toggleStatusMode(true)}
              className="px-3 py-1.5 rounded-xl bg-surfaceLight hover:bg-surfaceLight/80 border border-surfaceBorder hover:border-brand-500/50 text-xs font-medium text-gray-200 hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
              title="Enter Status Mode: Pure lyrics only without controls (Hotkey: S)"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Status Mode</span>
            </button>

            {/* Panel Toggles for Desktop */}
            <div className="hidden lg:flex items-center gap-1.5 border-l border-surfaceBorder pl-2">
              <button
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                className={`p-2 rounded-xl border transition-colors ${
                  leftPanelOpen
                    ? 'bg-surfaceLight/80 border-surfaceBorder text-white'
                    : 'bg-transparent border-transparent text-gray-400 hover:text-white'
                }`}
                title={leftPanelOpen ? 'Collapse Search Panel' : 'Open Search Panel'}
                aria-label="Toggle left panel"
              >
                {leftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className={`p-2 rounded-xl border transition-colors ${
                  rightPanelOpen
                    ? 'bg-surfaceLight/80 border-surfaceBorder text-white'
                    : 'bg-transparent border-transparent text-gray-400 hover:text-white'
                }`}
                title={rightPanelOpen ? 'Collapse Style Panel' : 'Open Style Panel'}
                aria-label="Toggle right panel"
              >
                {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-fade-in">
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-950/90 border border-red-800 text-xs text-red-200 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Floating Minimal Control Bar (ONLY in Status Mode, auto-fades after 2.8s) */}
      {isStatusMode && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
            showStatusControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-xs text-gray-200 shadow-2xl">
            {/* Exit Status Mode Button */}
            <button
              onClick={() => toggleStatusMode(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              title="Exit Status Mode (or press Esc)"
            >
              <EyeOff className="w-3.5 h-3.5 text-red-400" />
              <span>Exit Status (Esc)</span>
            </button>

            <div className="h-4 w-px bg-white/20" />

            {/* Quick Playback Controls */}
            <button
              onClick={prevTrack}
              className="p-1 hover:text-white text-gray-400 transition-colors"
              title="Previous"
            >
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="p-1 hover:text-white text-gray-400 transition-colors"
              title="Next"
            >
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="h-4 w-px bg-white/20" />

            {/* Quick Kinetic Toggle in Status Bar */}
            <button
              onClick={() => toggleKineticMode()}
              className={`p-1.5 rounded-lg border transition-colors ${
                isKineticMode
                  ? 'bg-amber-500/25 border-amber-500 text-amber-300'
                  : 'bg-transparent border-white/10 text-gray-400 hover:text-white'
              }`}
              title="Toggle Kinetic Typography Mode (Hotkey: K)"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-white/20" />

            {/* 9:16 Vertical Story Framing Toggle */}
            <button
              onClick={toggleStoryFraming}
              className={`p-1.5 rounded-lg border transition-colors ${
                storyFramingMode
                  ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                  : 'bg-transparent border-white/10 text-gray-400 hover:text-white'
              }`}
              title="Toggle 9:16 Story Frame"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Stage Container */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Search & Discover (Desktop) */}
        {!isStatusMode && leftPanelOpen && (
          <aside className="hidden lg:block w-80 xl:w-96 p-4 border-r border-surfaceBorder/60 shrink-0 h-full overflow-hidden transition-all">
            <SearchPanel />
          </aside>
        )}

        {/* Center: Stage (Takes full 100% in Status Mode) */}
        <section className="flex-1 h-full flex flex-col overflow-hidden relative">
          <Stage />
          <KineticOverlay />
        </section>

        {/* Right Sidebar: Style & Modes (Desktop) */}
        {!isStatusMode && rightPanelOpen && (
          <aside className="hidden lg:block w-80 p-4 border-l border-surfaceBorder/60 shrink-0 h-full overflow-y-auto transition-all">
            <StylePanel />
          </aside>
        )}

        {/* Mobile / Tablet BottomSheet */}
        {!isStatusMode && <BottomSheet />}

        {/* Sliding Queue Drawer */}
        <Queue />
      </main>

      {/* 4. Bottom Audio Player (Hidden in Status Mode) */}
      {!isStatusMode && <Player />}

      {/* Modals */}
      <LyricPicker />
      <ClipPicker />
      <ExportModal />
    </div>
  );
};
