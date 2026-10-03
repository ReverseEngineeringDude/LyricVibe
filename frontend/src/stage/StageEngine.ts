import { StageTheme, StageState } from './types';
import { AestheticMoodTheme } from './themes/aestheticMood';
import { KineticTheme } from './themes/kineticTheme';
import { getGlobalAudioElement } from '@/hooks/useAudioClock';

export class StageEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private themes: Map<string, StageTheme> = new Map();
  private activeTheme: StageTheme;

  private isRunning = false;
  private animFrameId: number | null = null;
  private lastTimestamp = 0;

  // Viewport & Scaling
  private width = 0;
  private height = 0;
  private dpr = 1;

  // Current State Snapshot
  private currentState: StageState = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    syncedLines: [],
    activeLineIndex: -1,
    visualOptions: {
      font: 'Syne',
      alignment: 'center',
      backgroundStyle: 'mesh',
      grain: true,
      watermark: true,
      fps: 60,
      particleDisappearing: true,
    },
    track: null,
    palette: null,
    prefersReducedMotion: false,
    isKineticMode: false,
    timingOffset: 0,
    width: 0,
    height: 0,
    dpr: 1,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Could not get 2D canvas rendering context.');
    }
    this.ctx = context;

    // Register Themes (Mode 1: Aesthetic Mood + Mode 2: Kinetic)
    const aestheticMood = new AestheticMoodTheme();
    this.themes.set(aestheticMood.id, aestheticMood);

    const kineticTheme = new KineticTheme();
    this.themes.set(kineticTheme.id, kineticTheme);

    this.activeTheme = aestheticMood;

    // Detect prefers-reduced-motion media query
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.currentState.prefersReducedMotion = mql.matches;
    mql.addEventListener('change', (e) => {
      this.currentState.prefersReducedMotion = e.matches;
    });

    this.resize();
    this.activeTheme.init(this.ctx, this.width, this.height, this.currentState.track);
  }

  /**
   * Set active theme by ID (e.g. 'aesthetic-mood')
   */
  setTheme(themeId: string) {
    const found = this.themes.get(themeId);
    if (found && found.id !== this.activeTheme.id) {
      this.activeTheme.dispose();
      this.activeTheme = found;
      this.activeTheme.init(this.ctx, this.width, this.height, this.currentState.track);
    }
  }

  /**
   * Updates state data from React components / stores
   */
  updateState(partial: Partial<StageState>) {
    Object.assign(this.currentState, partial);
    if (partial.isKineticMode && this.activeTheme.id !== 'kinetic') {
      this.setTheme('kinetic');
    } else if (partial.isKineticMode === false && this.activeTheme.id === 'kinetic') {
      this.setTheme('aesthetic-mood');
    }
  }

  /**
   * Resize handling with devicePixelRatio backing store
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for mobile 60fps performance
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);

    this.currentState.width = this.width;
    this.currentState.height = this.height;
    this.currentState.dpr = this.dpr;

    this.activeTheme.resize(this.width, this.height);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    // Directly sample real-time hardware audio clock at 60 FPS for buttery smooth animations
    const audio = getGlobalAudioElement();
    if (audio && !audio.paused && !audio.ended && this.currentState.isPlaying) {
      this.currentState.currentTime = audio.currentTime + (this.currentState.timingOffset || 0);
    }

    this.drawFrame(dt);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private drawFrame(dt: number) {
    if (this.width <= 0 || this.height <= 0) return;

    this.ctx.save();
    this.activeTheme.draw(this.ctx, this.currentState, dt);
    this.ctx.restore();
  }

  /**
   * Offline rendering function used by Phase 4 Video Exporter
   * Renders at arbitrary target resolution (e.g. 1080x1920)
   */
  renderOffscreenFrame(
    targetCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    time: number,
    activeIdx: number,
    dt: number = 0.016
  ) {
    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) return;

    const exportState: StageState = {
      ...this.currentState,
      width: targetWidth,
      height: targetHeight,
      currentTime: time,
      activeLineIndex: activeIdx,
      dpr: 1,
    };

    targetCtx.save();
    this.activeTheme.draw(targetCtx, exportState, dt);
    targetCtx.restore();
  }

  dispose() {
    this.stop();
    this.activeTheme.dispose();
  }
}
