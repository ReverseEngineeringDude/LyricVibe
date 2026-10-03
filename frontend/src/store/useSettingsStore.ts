import { create } from 'zustand';
import { LyricLine } from '@/lib/lrcParser';
import { LyricCandidate } from '@/lib/api';

export type FontChoice = 'Inter' | 'Playfair Display' | 'Syne';
export type TextAlign = 'center' | 'left';
export type BackgroundStyle = 'mesh' | 'cover';

export interface VisualOptions {
  font: FontChoice;
  alignment: TextAlign;
  backgroundStyle: BackgroundStyle;
  grain: boolean;
  watermark: boolean;
  fps: 30 | 60;
  particleDisappearing: boolean;
  kineticIntensity?: 'calm' | 'balanced' | 'wild';
  kineticCamera?: boolean;
  kineticBeats?: boolean;
  kineticFontSet?: 'modern' | 'classic' | 'cyber';
}

interface SettingsState {
  // Lyrics state
  syncedLines: LyricLine[];
  plainLyrics: string | null;
  isInstrumental: boolean;
  isLoadingLyrics: boolean;
  activeLineIndex: number;
  candidates: LyricCandidate[];
  timingOffset: number; // in seconds (-5.0 to +5.0)

  // Visual options
  selectedThemeId: string;
  visualOptions: VisualOptions;

  // UI modal toggles
  isLyricPickerOpen: boolean;
  isClipPickerOpen: boolean;
  isExportOpen: boolean;
  isQueueOpen: boolean;
  isSearchOpen: boolean;
  storyFramingMode: boolean; // desktop 9:16 preview frame
  isStatusMode: boolean; // clean lyrics-only mode with no player/headers/toolbars
  isKineticMode: boolean; // kinetic typography overlay mode
  kineticStyle: 'hero' | 'floating' | 'cinematic';

  // Clip selection for export
  clipRange: [number, number];

  // Actions
  setClipRange: (start: number, end: number) => void;
  toggleKineticMode: (open?: boolean) => void;
  setKineticStyle: (style: 'hero' | 'floating' | 'cinematic') => void;
  setLyricsData: (data: {
    syncedLines: LyricLine[];
    plainLyrics: string | null;
    isInstrumental: boolean;
    candidates?: LyricCandidate[];
  }) => void;
  setActiveLineIndex: (index: number) => void;
  setTimingOffset: (offset: number, trackId?: string) => void;
  loadTrackOffset: (trackId: string) => void;
  setIsLoadingLyrics: (loading: boolean) => void;
  setVisualOptions: (options: Partial<VisualOptions>) => void;
  setSelectedThemeId: (themeId: string) => void;
  toggleLyricPicker: (open?: boolean) => void;
  toggleClipPicker: (open?: boolean) => void;
  toggleExport: (open?: boolean) => void;
  toggleQueue: (open?: boolean) => void;
  toggleSearch: (open?: boolean) => void;
  toggleStoryFraming: () => void;
  toggleStatusMode: (open?: boolean) => void;
}

const STORAGE_KEY_OFFSETS = 'lyricvibe_track_offsets';
const STORAGE_KEY_VISUALS = 'lyricvibe_visual_options';

function loadOffsets(): { [key: string]: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFSETS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOffsetForTrack(trackId: string, offset: number) {
  try {
    const offsets = loadOffsets();
    offsets[trackId] = offset;
    localStorage.setItem(STORAGE_KEY_OFFSETS, JSON.stringify(offsets));
  } catch {
    // Ignore quota errors
  }
}

function loadVisualOptions(): VisualOptions {
  const fallback: VisualOptions = {
    font: 'Syne',
    alignment: 'center',
    backgroundStyle: 'mesh',
    grain: true,
    watermark: true,
    fps: 60,
    particleDisappearing: true,
    kineticIntensity: 'balanced',
    kineticCamera: true,
    kineticBeats: true,
    kineticFontSet: 'modern',
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISUALS);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  syncedLines: [],
  plainLyrics: null,
  isInstrumental: false,
  isLoadingLyrics: false,
  activeLineIndex: -1,
  candidates: [],
  timingOffset: 0,

  selectedThemeId: 'aesthetic-mood',
  visualOptions: loadVisualOptions(),

  isLyricPickerOpen: false,
  isClipPickerOpen: false,
  isExportOpen: false,
  isQueueOpen: false,
  isSearchOpen: false,
  storyFramingMode: false,
  isStatusMode: false,
  isKineticMode: false,
  kineticStyle: 'hero',
  clipRange: [0, 30],

  setClipRange: (start: number, end: number) => {
    const s = Math.max(0, Math.round(start * 10) / 10);
    const e = Math.max(s + 1, Math.round(end * 10) / 10);
    set({ clipRange: [s, e] });
  },

  setLyricsData: ({ syncedLines, plainLyrics, isInstrumental, candidates }) => {
    set({
      syncedLines,
      plainLyrics,
      isInstrumental,
      candidates: candidates || [],
      activeLineIndex: -1,
    });
  },

  setActiveLineIndex: (index: number) => {
    if (get().activeLineIndex !== index) {
      set({ activeLineIndex: index });
    }
  },

  setTimingOffset: (offset: number, trackId?: string) => {
    const clamped = Math.round(Math.max(-5.0, Math.min(5.0, offset)) * 10) / 10;
    set({ timingOffset: clamped });
    if (trackId) {
      saveOffsetForTrack(trackId, clamped);
    }
  },

  loadTrackOffset: (trackId: string) => {
    const offsets = loadOffsets();
    const offset = offsets[trackId] ?? 0.0;
    set({ timingOffset: offset });
  },

  setIsLoadingLyrics: (loading: boolean) => set({ isLoadingLyrics: loading }),

  setVisualOptions: (options: Partial<VisualOptions>) => {
    const updated = { ...get().visualOptions, ...options };
    try {
      localStorage.setItem(STORAGE_KEY_VISUALS, JSON.stringify(updated));
    } catch {}
    set({ visualOptions: updated });
  },

  setSelectedThemeId: (themeId: string) => set({ selectedThemeId: themeId }),

  toggleLyricPicker: (open) =>
    set((state) => ({ isLyricPickerOpen: open !== undefined ? open : !state.isLyricPickerOpen })),
  toggleClipPicker: (open) =>
    set((state) => ({ isClipPickerOpen: open !== undefined ? open : !state.isClipPickerOpen })),
  toggleExport: (open) =>
    set((state) => ({ isExportOpen: open !== undefined ? open : !state.isExportOpen })),
  toggleQueue: (open) =>
    set((state) => ({ isQueueOpen: open !== undefined ? open : !state.isQueueOpen })),
  toggleSearch: (open) =>
    set((state) => ({ isSearchOpen: open !== undefined ? open : !state.isSearchOpen })),
  toggleStoryFraming: () =>
    set((state) => ({ storyFramingMode: !state.storyFramingMode })),
  toggleStatusMode: (open) =>
    set((state) => ({ isStatusMode: open !== undefined ? open : !state.isStatusMode })),
  toggleKineticMode: (open) =>
    set((state) => ({ isKineticMode: open !== undefined ? open : !state.isKineticMode })),
  setKineticStyle: (style) => set({ kineticStyle: style }),
}));
