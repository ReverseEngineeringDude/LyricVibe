import { StageTheme, StageState } from '../types';
import { KineticPhrase, AudioAnalysisData, KineticOptions, PhraseLayout } from '../kinetic/types';
import { buildKineticPhrases } from '../kinetic/phraseBuilder';
import { computePhraseLayout, getWordDisplayText } from '../kinetic/layoutEngine';
import { getWordAnimationState } from '../kinetic/animPresets';
import { getCameraAtTime, getEnergyAtTime } from '../kinetic/camera';
import { ColorPalette, colorWithAlpha } from '@/lib/palette';
import { API_BASE } from '@/lib/api';

export class KineticTheme implements StageTheme {
  id = 'kinetic';
  name = 'Kinetic Typography';

  private grainCanvas: HTMLCanvasElement | null = null;
  private coverImage: HTMLImageElement | null = null;
  private currentCoverUrl = '';
  private customBgImage: HTMLImageElement | null = null;
  private currentCustomBgUrl = '';

  // Analysis & Phrase Cache
  private analysisCache = new Map<string, AudioAnalysisData>();
  private fetchingVideoIds = new Set<string>();
  private phrasesCache = new Map<string, KineticPhrase[]>();
  private layoutCache = new Map<string, PhraseLayout>();

  private lastWidth = 0;
  private lastHeight = 0;

  init(ctx: CanvasRenderingContext2D, width: number, height: number, track: any) {
    this.createGrainPattern();
    this.resize(width, height);
    if (track?.thumbnail) {
      this.updateCoverImage(track.thumbnail);
    }
  }

  resize(width: number, height: number) {
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.lastWidth = width;
      this.lastHeight = height;
      this.layoutCache.clear();
    }
  }

  dispose() {
    this.grainCanvas = null;
    this.analysisCache.clear();
    this.phrasesCache.clear();
    this.layoutCache.clear();
  }

  private createGrainPattern() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 22; // subtle 8% opacity grain
    }
    ctx.putImageData(imgData, 0, 0);
    this.grainCanvas = canvas;
  }

  private updateCoverImage(url: string) {
    if (!url) {
      this.coverImage = null;
      this.currentCoverUrl = '';
      return;
    }
    if (url === this.currentCoverUrl && this.coverImage && this.coverImage.complete) return;
    this.currentCoverUrl = url;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.coverImage = img;
    };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      this.coverImage = img;
    }
  }

  private updateCustomBgImage(url?: string | null) {
    if (!url) {
      this.customBgImage = null;
      this.currentCustomBgUrl = '';
      return;
    }
    if (url === this.currentCustomBgUrl && this.customBgImage && this.customBgImage.complete) return;
    this.currentCustomBgUrl = url;
    const img = new Image();
    img.onload = () => {
      this.customBgImage = img;
    };
    img.onerror = () => {
      console.warn('Failed to load custom background image:', url);
    };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      this.customBgImage = img;
    }
  }

  private async fetchAnalysis(videoId: string, trackTitle?: string, artist?: string, duration?: number) {
    if (this.fetchingVideoIds.has(videoId) || this.analysisCache.has(videoId)) return;
    this.fetchingVideoIds.add(videoId);

    try {
      const params = new URLSearchParams();
      if (trackTitle) params.set('track', trackTitle);
      if (artist) params.set('artist', artist);
      if (duration) params.set('duration', duration.toString());

      const res = await fetch(`${API_BASE}/analysis/${videoId}?${params.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.toLowerCase().includes('application/json')) {
        const data: AudioAnalysisData = await res.json();
        this.analysisCache.set(videoId, data);
      }
    } catch (err) {
      console.warn('[KineticTheme] Failed to fetch audio analysis:', err);
    } finally {
      this.fetchingVideoIds.delete(videoId);
    }
  }

  private getPhrases(state: StageState): KineticPhrase[] {
    const videoId = state.track?.id || 'default';
    const cacheKey = `${videoId}:${state.syncedLines.length}`;

    const cached = this.phrasesCache.get(cacheKey);
    if (cached) return cached;

    const analysis = this.analysisCache.get(videoId);
    if (!analysis && state.track?.id) {
      this.fetchAnalysis(
        state.track.id,
        state.track.title,
        state.track.artist,
        state.duration
      );
    }

    const words = analysis?.words || [];
    const phrases = buildKineticPhrases(words, state.syncedLines, videoId);
    this.phrasesCache.set(cacheKey, phrases);
    return phrases;
  }

  private lastCustomFont = '';

  private getLayout(
    ctx: CanvasRenderingContext2D,
    phrase: KineticPhrase,
    w: number,
    h: number,
    intensity: 'calm' | 'balanced' | 'wild' = 'balanced',
    customFont?: string
  ): PhraseLayout {
    const key = `${phrase.index}:${w}:${h}:${intensity}:${customFont || ''}`;
    const cached = this.layoutCache.get(key);
    if (cached) return cached;

    const layout = computePhraseLayout(ctx, phrase, w, h, intensity, customFont);
    this.layoutCache.set(key, layout);
    return layout;
  }

  /**
   * PURE DETERMINISTIC DRAW FUNCTION.
   * Renders identically for any given state.currentTime (t).
   * Implements Lyricsvibe-style smooth vertical slide transitions and vibrant word flow.
   */
  draw(ctx: CanvasRenderingContext2D, state: StageState, _dt: number) {
    const { width: w, height: h, currentTime: t, track, palette, visualOptions, prefersReducedMotion } = state;
    if (w <= 0 || h <= 0) return;

    if (visualOptions.font !== this.lastCustomFont) {
      this.lastCustomFont = visualOptions.font;
      this.layoutCache.clear();
    }

    if (track?.thumbnail && track.thumbnail !== this.currentCoverUrl) {
      this.updateCoverImage(track.thumbnail);
    }
    this.updateCustomBgImage(visualOptions.customBgUrl);

    const kineticOpts: KineticOptions = {
      intensity: (visualOptions as any).kineticIntensity || 'balanced',
      cameraMovement: (visualOptions as any).kineticCamera !== false,
      beatReactions: (visualOptions as any).kineticBeats !== false,
      backgroundType: (visualOptions.backgroundStyle as any) || 'mesh',
      fontSet: 'modern',
      customFont: visualOptions.font,
    };

    const pal: ColorPalette = palette || {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      background: '#07080d',
      isDark: true,
    };

    // Accessible highlight color resolution (defaulting to high-contrast cyan #00f0ff)
    const userHighlight = visualOptions.kineticHighlightColor || '#00f0ff';
    const highlightColor = userHighlight === 'dynamic' ? (pal.accent || '#00f0ff') : userHighlight;

    // 1. Render Background
    this.drawBackground(ctx, w, h, pal, visualOptions.backgroundStyle);

    // 2. Render Film Grain
    if (visualOptions.grain && this.grainCanvas) {
      this.drawGrain(ctx, w, h);
    }

    // 3. Retrieve phrases & analysis
    const videoId = track?.id || 'default';
    const analysis = this.analysisCache.get(videoId) || null;
    const phrases = this.getPhrases(state);

    if (phrases.length === 0) {
      this.drawIdleMessage(ctx, w, h, track, pal);
      return;
    }

    // 4. Find which phrase(s) to render and calculate smooth vertical slide transitions
    const TRANSITION_DUR = 0.50; // 500ms smooth vertical slide transition window
    const HALF_TRANS = TRANSITION_DUR / 2;

    const phrasesToDraw: {
      phrase: KineticPhrase;
      offsetY: number;
      opacity: number;
      scale: number;
    }[] = [];

    // Check if before the very first phrase
    const firstPhrase = phrases[0];
    const enterStart = firstPhrase.start - TRANSITION_DUR;
    if (t < enterStart) {
      this.drawIntroState(ctx, w, h, track, pal, firstPhrase.start - t, 1.0, highlightColor);
      if (visualOptions.watermark) this.drawWatermark(ctx, w);
      return;
    } else if (t < firstPhrase.start) {
      const u = (t - enterStart) / TRANSITION_DUR;
      const ease = u * u * (3 - 2 * u);
      this.drawIntroState(ctx, w, h, track, pal, firstPhrase.start - t, Math.max(0, 1.0 - ease), highlightColor);
    }

    // Identify active phrase index
    let currentIdx = -1;
    for (let i = 0; i < phrases.length; i++) {
      const p = phrases[i];
      const nextP = phrases[i + 1] || null;
      const transPoint = nextP ? nextP.start : p.end;

      if (t < transPoint + HALF_TRANS) {
        currentIdx = i;
        break;
      }
    }
    if (currentIdx === -1) {
      currentIdx = phrases.length - 1;
    }

    const curPhrase = phrases[currentIdx];
    const nextPhrase = phrases[currentIdx + 1] || null;

    if (nextPhrase) {
      const transPoint = nextPhrase.start;
      const transStart = transPoint - HALF_TRANS;
      const transEnd = transPoint + HALF_TRANS;

      if (t >= transStart && t <= transEnd) {
        // Active Transition between curPhrase (outgoing) and nextPhrase (incoming)
        const u = (t - transStart) / TRANSITION_DUR;
        // Smoothstep easing
        const ease = u * u * (3 - 2 * u);

        const curLayout = this.getLayout(ctx, curPhrase, w, h, kineticOpts.intensity, visualOptions.font);
        const nextLayout = this.getLayout(ctx, nextPhrase, w, h, kineticOpts.intensity, visualOptions.font);

        // Required vertical clearance distance so bounding boxes NEVER collide or overlap
        const slideDist = (curLayout.height + nextLayout.height) / 2 + 60;

        // Outgoing: slides UP and cleanly fades OUT
        phrasesToDraw.push({
          phrase: curPhrase,
          offsetY: -ease * slideDist,
          opacity: Math.max(0, 1.0 - ease * 1.25),
          scale: 1.0 - ease * 0.04,
        });

        // Incoming: slides IN from below with strictly maintained clearance and fades IN
        phrasesToDraw.push({
          phrase: nextPhrase,
          offsetY: (1.0 - ease) * slideDist,
          opacity: Math.min(1.0, ease * 1.25),
          scale: 0.96 + ease * 0.04,
        });
      } else if (t < transStart) {
        // curPhrase is fully displayed
        phrasesToDraw.push({
          phrase: curPhrase,
          offsetY: 0,
          opacity: 1.0,
          scale: 1.0,
        });
      } else {
        // nextPhrase is fully displayed
        phrasesToDraw.push({
          phrase: nextPhrase,
          offsetY: 0,
          opacity: 1.0,
          scale: 1.0,
        });
      }
    } else {
      // Last phrase in track
      const fadeStart = curPhrase.end - 0.6;
      if (t > fadeStart) {
        const u = Math.min(1, Math.max(0, (t - fadeStart) / 0.6));
        const ease = u * u * (3 - 2 * u);
        const lastLayout = this.getLayout(ctx, curPhrase, w, h, kineticOpts.intensity, visualOptions.font);
        phrasesToDraw.push({
          phrase: curPhrase,
          offsetY: -ease * (lastLayout.height / 2 + 40),
          opacity: 1.0 - ease,
          scale: 1.0 - ease * 0.04,
        });
      } else {
        phrasesToDraw.push({
          phrase: curPhrase,
          offsetY: 0,
          opacity: 1.0,
          scale: 1.0,
        });
      }
    }

    // First phrase entrance slide-in
    if (currentIdx === 0 && t < firstPhrase.start) {
      const enterStart = firstPhrase.start - TRANSITION_DUR;
      const u = Math.min(1, Math.max(0, (t - enterStart) / TRANSITION_DUR));
      const ease = u * u * (3 - 2 * u);
      const firstLayout = this.getLayout(ctx, firstPhrase, w, h, kineticOpts.intensity, visualOptions.font);
      const slideInDist = firstLayout.height / 2 + 50;
      if (phrasesToDraw.length > 0 && phrasesToDraw[0].phrase === firstPhrase) {
        phrasesToDraw[0].offsetY = (1.0 - ease) * slideInDist;
        phrasesToDraw[0].opacity = ease;
        phrasesToDraw[0].scale = 0.96 + ease * 0.04;
      }
    }

    // 5. Virtual Camera Transform (serene, smooth, continuous)
    const cam = getCameraAtTime(t, curPhrase, nextPhrase, analysis, kineticOpts, prefersReducedMotion);
    const energyAtT = getEnergyAtTime(analysis, t);

    ctx.save();
    ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
    ctx.rotate(cam.rotation);
    ctx.scale(cam.scale, cam.scale);

    // 6. Draw Phrases with Smooth Transition Transforms
    for (const item of phrasesToDraw) {
      if (item.opacity <= 0.01) continue;
      const layout = this.getLayout(ctx, item.phrase, w, h, kineticOpts.intensity, visualOptions.font);
      this.drawPhraseLayout(
        ctx,
        item.phrase,
        layout,
        t,
        energyAtT,
        pal,
        item.offsetY,
        item.opacity,
        item.scale,
        prefersReducedMotion,
        kineticOpts,
        highlightColor
      );
    }

    ctx.restore();

    // 7. Watermark Badge
    if (visualOptions.watermark) {
      this.drawWatermark(ctx, w);
    }
  }

  private drawPhraseLayout(
    ctx: CanvasRenderingContext2D,
    phrase: KineticPhrase,
    layout: PhraseLayout,
    t: number,
    energyAtT: number,
    pal: ColorPalette,
    phraseOffsetY: number,
    phraseOpacity: number,
    phraseScale: number,
    prefersReducedMotion: boolean,
    kineticOpts: KineticOptions,
    highlightColor = '#00f0ff'
  ) {
    ctx.save();
    ctx.translate(0, phraseOffsetY);
    ctx.scale(phraseScale, phraseScale);

    const isWild = kineticOpts.intensity === 'wild';
    const isCalm = kineticOpts.intensity === 'calm';

    for (const box of layout.wordBoxes) {
      const anim = getWordAnimationState(t, box, phrase, energyAtT, prefersReducedMotion, kineticOpts.intensity);
      if (!anim.visible) continue;

      ctx.save();

      const centerX = box.x + box.w / 2 + anim.translateX;
      const centerY = box.y + box.h / 2 + anim.translateY;

      ctx.translate(centerX, centerY);
      ctx.rotate(anim.rotation);
      ctx.scale(anim.scaleX, anim.scaleY);
      ctx.globalAlpha = phraseOpacity * anim.opacity;

      const isSung = anim.isSung;
      const isPast = anim.isPast;
      const displayText = getWordDisplayText(box.word);

      // Color mapping:
      // - Sung: vivid accessible highlight (Electric Cyan #00f0ff by default, or user chosen)
      // - Past: clean solid text (white)
      // - Upcoming: soft secondary translucent tone
      let textColor = '#ffffff';
      if (isSung) {
        textColor = highlightColor;
      } else if (isPast) {
        textColor = '#f8fafc';
      } else {
        textColor = box.word.colorIndex === 1 ? colorWithAlpha(pal.secondary, 0.7) : 'rgba(255, 255, 255, 0.45)';
      }

      ctx.font = box.fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Render Word Fill or Outline
      if (box.word.styleType === 'outline') {
        if (isSung) {
          // Double stroke for maximum readability and accessibility across all vision types
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.lineWidth = Math.max(3.5, box.fontSize * (isWild ? 0.085 : 0.065));
          ctx.strokeText(displayText, 0, 0);
          ctx.restore();
        }
        ctx.strokeStyle = textColor;
        ctx.lineWidth = Math.max(2.5, box.fontSize * (isWild ? 0.065 : 0.045));
        ctx.strokeText(displayText, 0, 0);
      } else {
        // High-contrast background shadow/halo for sung word so it pops on ANY background
        if (isSung) {
          // 1. Contrast dark halo to guarantee distinction against any background
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.lineWidth = Math.max(3, box.fontSize * 0.05);
          ctx.strokeText(displayText, 0, 0);
          ctx.restore();

          // 2. Glow shadow in chosen highlight color
          ctx.shadowColor = highlightColor;
          const blurMult = isWild ? 0.48 : isCalm ? 0.18 : 0.32;
          ctx.shadowBlur = Math.min(36, box.fontSize * blurMult);
        }

        // Chromatic Aberration in Wild mode
        if (isSung && isWild && anim.slamAberration > 0.5) {
          ctx.save();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.65)';
          ctx.fillText(displayText, -anim.slamAberration, 0);
          ctx.restore();

          ctx.save();
          ctx.fillStyle = 'rgba(236, 72, 153, 0.65)';
          ctx.fillText(displayText, anim.slamAberration, 0);
          ctx.restore();
        }

        ctx.fillStyle = textColor;
        ctx.fillText(displayText, 0, 0);
        ctx.shadowBlur = 0;
      }

      // Kinetic Particle Sparks in Wild mode around currently sung word
      if (isSung && isWild && !prefersReducedMotion) {
        const numSparks = 4;
        for (let s = 0; s < numSparks; s++) {
          const sparkAngle = t * 5 + s * (Math.PI * 2 / numSparks);
          const sparkDist = (box.w / 2 + 10) * (0.85 + 0.15 * Math.sin(t * 10 + s));
          const sx = Math.cos(sparkAngle) * sparkDist;
          const sy = Math.sin(sparkAngle) * (box.h * 0.42);
          ctx.save();
          ctx.fillStyle = highlightColor;
          ctx.shadowColor = highlightColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Sung Word Underline Sweep
      if (isSung) {
        const sweepW = box.w * anim.sungProgress;
        if (isWild) {
          ctx.shadowColor = highlightColor;
          ctx.shadowBlur = 14;
          ctx.fillStyle = highlightColor;
          ctx.fillRect(-box.w / 2, box.h * 0.44, sweepW, Math.max(4, box.fontSize * 0.08));
          ctx.shadowBlur = 0;
        } else if (isCalm) {
          ctx.fillStyle = colorWithAlpha(highlightColor, 0.75);
          ctx.fillRect(-box.w / 2, box.h * 0.44, sweepW, Math.max(2, box.fontSize * 0.038));
        } else {
          ctx.fillStyle = highlightColor;
          ctx.fillRect(-box.w / 2, box.h * 0.44, sweepW, Math.max(3, box.fontSize * 0.055));
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    pal: ColorPalette,
    style: 'mesh' | 'cover' | 'custom'
  ) {
    ctx.fillStyle = pal.background || '#07080d';
    ctx.fillRect(0, 0, w, h);

    if (style === 'custom' && this.customBgImage) {
      ctx.save();
      const scale = Math.max(w / this.customBgImage.width, h / this.customBgImage.height);
      const dw = this.customBgImage.width * scale;
      const dh = this.customBgImage.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.customBgImage, dx, dy, dw, dh);
      ctx.restore();
    } else if (style === 'cover' && this.coverImage) {
      ctx.save();
      const scale = Math.max(w / this.coverImage.width, h / this.coverImage.height) * 1.15;
      const dw = this.coverImage.width * scale;
      const dh = this.coverImage.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.globalAlpha = 0.28;
      ctx.drawImage(this.coverImage, dx, dy, dw, dh);
      ctx.restore();
    } else {
      const grad1 = ctx.createRadialGradient(w * 0.35, h * 0.35, 10, w * 0.4, h * 0.4, Math.max(w, h) * 0.65);
      grad1.addColorStop(0, colorWithAlpha(pal.primary, 0.24));
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      const grad2 = ctx.createRadialGradient(w * 0.7, h * 0.65, 10, w * 0.65, h * 0.65, Math.max(w, h) * 0.55);
      grad2.addColorStop(0, colorWithAlpha(pal.secondary, 0.2));
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);
    }

    // High contrast overlay for crisp typography
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(0, 0, w, h);
  }

  private drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.grainCanvas) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.10;
    const pattern = ctx.createPattern(this.grainCanvas, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  private drawIntroState(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    track: any,
    pal: ColorPalette,
    countdown: number,
    opacity = 1.0,
    highlightColor = '#00f0ff'
  ) {
    if (opacity <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const title = track?.title || 'Kinetic Typography';
    const artist = track?.artist || 'Ready for playback';

    ctx.font = `900 36px "Anton", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, h / 2 - 20);

    ctx.font = `italic 600 18px "Playfair Display", serif`;
    ctx.fillStyle = highlightColor;
    ctx.fillText(artist, w / 2, h / 2 + 22);

    if (countdown > 0.5 && countdown < 10) {
      ctx.font = `600 12px "Space Mono", monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText(
        `LYRICS STARTING IN ${Math.ceil(countdown)}S`,
        w / 2,
        h / 2 + 65
      );
    }
    ctx.restore();
  }

  private drawIdleMessage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    track: any,
    pal: ColorPalette
  ) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const title = track?.title || 'Kinetic Typography';
    const artist = track?.artist || 'Ready for playback';

    ctx.font = `900 ${Math.max(24, Math.min(w, h) * 0.065)}px "Anton", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, h / 2 - 16);

    ctx.font = `italic 600 ${Math.max(14, Math.min(w, h) * 0.032)}px "Playfair Display", serif`;
    ctx.fillStyle = colorWithAlpha(pal.primary, 0.85);
    ctx.fillText(artist, w / 2, h / 2 + 24);
    ctx.restore();
  }

  private drawWatermark(ctx: CanvasRenderingContext2D, w: number) {
    ctx.save();
    ctx.font = '600 11px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('LYRICVIBE • KINETIC', w - 24, 20);
    ctx.restore();
  }
}
