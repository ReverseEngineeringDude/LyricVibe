import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ListMusic,
  Sliders,
  X,
  Zap,
  Eye,
  Film,
  Sparkles,
  Music,
  Play,
  Pause,
} from 'lucide-react';
import { SearchPanel } from './SearchPanel';
import { Queue } from './Queue';
import { StylePanel } from './StylePanel';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePlayerStore } from '@/store/usePlayerStore';

export const MobileMenu: React.FC = () => {
  const isMobileMenuOpen = useSettingsStore((s) => s.isMobileMenuOpen);
  const toggleMobileMenu = useSettingsStore((s) => s.toggleMobileMenu);
  const mobileMenuTab = useSettingsStore((s) => s.mobileMenuTab);
  const setMobileMenuTab = useSettingsStore((s) => s.setMobileMenuTab);
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const toggleKineticMode = useSettingsStore((s) => s.toggleKineticMode);
  const toggleStatusMode = useSettingsStore((s) => s.toggleStatusMode);
  const toggleClipPicker = useSettingsStore((s) => s.toggleClipPicker);

  const queue = usePlayerStore((s) => s.queue);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  // Close menu on pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        toggleMobileMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, toggleMobileMenu]);

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => toggleMobileMenu(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Slide-out Hamburger Menu Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[88vw] max-w-sm sm:max-w-md bg-surface/95 backdrop-blur-2xl border-l border-surfaceBorder shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="h-14 pt-[env(safe-area-inset-top,0px)] px-4 border-b border-surfaceBorder/60 flex items-center justify-between shrink-0 bg-surface/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                  <Sparkles className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white leading-tight">LyricVibe</h3>
                  <p className="text-[10px] text-gray-400">Navigation & Controls</p>
                </div>
              </div>

              <button
                onClick={() => toggleMobileMenu(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white bg-surfaceLight/50 hover:bg-surfaceLight border border-surfaceBorder/60 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="p-3 border-b border-surfaceBorder/60 bg-surfaceLight/20 shrink-0">
              <div className="grid grid-cols-3 gap-1 p-1 bg-surfaceLight/60 rounded-xl border border-surfaceBorder text-xs font-medium">
                <button
                  onClick={() => setMobileMenuTab('search')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mobileMenuTab === 'search'
                      ? 'bg-brand-500 text-white shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

                <button
                  onClick={() => setMobileMenuTab('queue')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all relative ${
                    mobileMenuTab === 'queue'
                      ? 'bg-brand-500 text-white shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue</span>
                  {queue.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                      {queue.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setMobileMenuTab('style')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mobileMenuTab === 'style'
                      ? 'bg-brand-500 text-white shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Style</span>
                </button>
              </div>

              {/* Quick Actions Strip */}
              <div className="flex items-center gap-1.5 mt-2.5">
                <button
                  onClick={() => toggleKineticMode()}
                  className={`flex-1 py-1 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                    isKineticMode
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                      : 'bg-surfaceLight/40 hover:bg-surfaceLight border-surfaceBorder text-gray-300 hover:text-white'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${isKineticMode ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
                  <span>Kinetic</span>
                </button>

                <button
                  onClick={() => {
                    toggleMobileMenu(false);
                    toggleStatusMode(true);
                  }}
                  className="flex-1 py-1 px-2 rounded-lg bg-surfaceLight/40 hover:bg-surfaceLight border border-surfaceBorder hover:border-emerald-500/50 text-[11px] font-medium text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Status Mode</span>
                </button>

                <button
                  onClick={() => {
                    toggleMobileMenu(false);
                    toggleClipPicker(true);
                  }}
                  disabled={!currentTrack}
                  className="flex-1 py-1 px-2 rounded-lg bg-gradient-to-r from-brand-600 to-indigo-600 text-[11px] font-medium text-white flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 transition-all"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Scrollable Tab Panel Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 overscroll-contain">
              {mobileMenuTab === 'search' && <SearchPanel />}
              {mobileMenuTab === 'queue' && (
                <Queue embedded={true} onClose={() => toggleMobileMenu(false)} />
              )}
              {mobileMenuTab === 'style' && <StylePanel />}
            </div>

            {/* Now Playing Footer Card */}
            {currentTrack && (
              <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom,12px))] border-t border-surfaceBorder/60 bg-surface/90 shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surfaceLight border border-surfaceBorder shadow-sm">
                    {currentTrack.thumbnail ? (
                      <img
                        src={currentTrack.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-500/20 text-brand-400">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {currentTrack.track || currentTrack.title}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {currentTrack.artist || currentTrack.uploader || 'Unknown Artist'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-md transition-transform shrink-0"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
