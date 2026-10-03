import { TrackMetadata } from '@/lib/api';
import { LyricLine } from '@/lib/lrcParser';
import { ColorPalette } from '@/lib/palette';
import { VisualOptions } from '@/store/useSettingsStore';

export interface StageState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  syncedLines: LyricLine[];
  activeLineIndex: number;
  visualOptions: VisualOptions;
  track: TrackMetadata | null;
  palette: ColorPalette | null;
  prefersReducedMotion: boolean;
  isKineticMode?: boolean;
  timingOffset?: number;
  width: number;
  height: number;
  dpr: number;
}

export interface LineLayout {
  index: number;
  text: string;
  wrappedLines: string[];
  y: number;
  height: number;
  isInstrumental: boolean;
  time: number;
  nextTime?: number;
}

export interface LineSpring {
  y: number;
  vy: number;
  scale: number;
  vscale: number;
  opacity: number;
  vopacity: number;
}

export interface StageTheme {
  id: string;
  name: string;
  init: (ctx: CanvasRenderingContext2D, width: number, height: number, track: TrackMetadata | null) => void;
  draw: (ctx: CanvasRenderingContext2D, state: StageState, dt: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}
