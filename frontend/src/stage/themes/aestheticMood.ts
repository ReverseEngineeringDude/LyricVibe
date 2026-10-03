import { StageTheme, StageState, LineLayout, LineSpring } from '../types';
import { stepSpring, SPRINGS } from '../springs';
import { ColorPalette, colorWithAlpha } from '@/lib/palette';

export class AestheticMoodTheme implements StageTheme {
  id = 'aesthetic-mood';
  name = 'Aesthetic Mood';

  private timeElapsed = 0;
  private grainCanvas: HTMLCanvasElement | null = null;
  private grainPattern: CanvasPattern | null = null;
  private coverImage: HTMLImageElement | null = null;
  private currentCoverUrl = '';

  // Palette cross-fade state
  private activePalette: ColorPalette | null = null;
  private targetPalette: ColorPalette | null = null;
  private paletteTransitionProgress = 1.0; // 1 = fully transitioned

  // Layout & Spring States
  private cachedLayouts: LineLayout[] = [];
  private lastLayoutWidth = 0;
  private lineSprings: Map<number, LineSpring> = new Map();

  // Scroll physics
  private scrollY = 0;
  private scrollVelocity = 0;
  private lastActiveIndex = -1;

  init(ctx: CanvasRenderingContext2D, width: number, height: number, track: any) {
    this.createGrainPattern();
    this.resize(width, height);
  }

  resize(width: number, height: number) {
    this.lastLayoutWidth = 0; // force layout invalidation on resize
  }

  dispose() {
    this.grainCanvas = null;
    this.grainPattern = null;
    this.coverImage = null;
    this.lineSprings.clear();
    this.cachedLayouts = [];
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
      data[i + 3] = 30; // subtle 12% opacity grain
    }
    ctx.putImageData(imgData, 0, 0);

    this.grainCanvas = canvas;
  }

  private updateCoverImage(url: string) {
    if (!url || url === this.currentCoverUrl) return;
    this.currentCoverUrl = url;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.coverImage = img;
    };
    img.src = url;
  }

  private updatePalette(newPalette: ColorPalette | null, dt: number) {
    if (!newPalette) return;

    if (!this.activePalette) {
      this.activePalette = newPalette;
      this.targetPalette = newPalette;
      this.paletteTransitionProgress = 1.0;
      return;
    }

    if (this.targetPalette?.primary !== newPalette.primary) {
      this.targetPalette = newPalette;
      this.paletteTransitionProgress = 0.0;
    }

    if (this.paletteTransitionProgress < 1.0) {
      this.paletteTransitionProgress = Math.min(1.0, this.paletteTransitionProgress + dt * 1.5);
    }
  }

  private getTypography(width: number, visualOptions: any) {
    const fontSize = width < 640 ? 22 : width < 1024 ? 28 : 34;
    const lineHeight = fontSize * 1.35;
    const maxTextWidth = Math.min(width * 0.84, 760);
    const fontName = visualOptions.font || 'Syne';
    return { fontSize, lineHeight, maxTextWidth, fontName };
  }

  private computeLineLayouts(ctx: CanvasRenderingContext2D, state: StageState) {
    const { syncedLines, width, visualOptions } = state;
    const { fontSize, lineHeight, maxTextWidth, fontName } = this.getTypography(width, visualOptions);

    ctx.font = `600 ${fontSize}px "${fontName}", sans-serif`;

    const layouts: LineLayout[] = [];
    let currentY = 0;

    for (let i = 0; i < syncedLines.length; i++) {
      const line = syncedLines[i];
      const nextTime = syncedLines[i + 1]?.time;

      if (line.isInstrumental) {
        layouts.push({
          index: i,
          text: '• • •',
          wrappedLines: ['• • •'],
          y: currentY,
          height: lineHeight * 1.2,
          isInstrumental: true,
          time: line.time,
          nextTime,
        });
        currentY += lineHeight * 1.6;
        continue;
      }

      // Word wrapping algorithm
      const words = line.text.split(' ');
      const wrapped: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && currentLine) {
          wrapped.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) wrapped.push(currentLine);

      const blockHeight = wrapped.length * lineHeight;
      layouts.push({
        index: i,
        text: line.text,
        wrappedLines: wrapped,
        y: currentY,
        height: blockHeight,
        isInstrumental: false,
        time: line.time,
        nextTime,
      });

      // Spacing between lines
      const lineGap = width < 640 ? 24 : 32;
      currentY += blockHeight + lineGap;
    }

    this.cachedLayouts = layouts;
    this.lastLayoutWidth = width;
  }

  draw(ctx: CanvasRenderingContext2D, state: StageState, dt: number) {
    this.timeElapsed += dt;
    const { width, height, visualOptions, track, palette } = state;

    if (track?.thumbnail) {
      this.updateCoverImage(track.thumbnail);
    }
    this.updatePalette(palette, dt);

    // 1. Draw Dynamic Blurred Mesh Backdrop
    this.drawBackground(ctx, width, height, visualOptions);

    // 2. Draw Soft Vignette Overlay
    this.drawVignette(ctx, width, height);

    // 3. Draw Film Grain Overlay
    if (visualOptions.grain && this.grainCanvas) {
      this.drawGrain(ctx, width, height);
    }

    // 4. Draw Header
    this.drawHeader(ctx, state);

    // 5. Compute & Cache Text Layouts
    if (this.lastLayoutWidth !== width || this.cachedLayouts.length !== state.syncedLines.length) {
      this.computeLineLayouts(ctx, state);
    }

    // 6. Draw Spring-Driven Synced Lyrics with Active Bloom
    if (state.syncedLines.length > 0) {
      if (state.isKineticMode) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        this.drawLyrics(ctx, state, dt);
        ctx.restore();
      } else {
        this.drawLyrics(ctx, state, dt);
      }
    } else if (state.track) {
      this.drawIdleState(ctx, state);
    }

    // 7. Draw Bottom Progress Indicator
    this.drawBottomProgressBar(ctx, state);

    // 8. Draw Watermark Badge
    if (visualOptions.watermark) {
      this.drawWatermark(ctx, width);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, opts: any) {
    const pal = this.targetPalette || this.activePalette || {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      background: '#090a0f',
      isDark: true,
    };

    // Base background fill
    ctx.fillStyle = pal.background;
    ctx.fillRect(0, 0, w, h);

    if (opts.backgroundStyle === 'cover' && this.coverImage) {
      ctx.save();
      ctx.filter = 'blur(35px) brightness(0.4)';
      const scale = Math.max(w / this.coverImage.width, h / this.coverImage.height) * 1.15;
      const dw = this.coverImage.width * scale;
      const dh = this.coverImage.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(this.coverImage, dx, dy, dw, dh);
      ctx.restore();
      return;
    }

    // Slowly drifting orbital coordinates
    const t = this.timeElapsed * 0.35;
    const r1 = Math.min(w, h) * 0.65;
    const x1 = w * 0.3 + Math.cos(t * 0.8) * (w * 0.18);
    const y1 = h * 0.35 + Math.sin(t * 0.6) * (h * 0.15);

    const x2 = w * 0.7 + Math.sin(t * 0.7) * (w * 0.15);
    const y2 = h * 0.65 + Math.cos(t * 0.5) * (h * 0.18);

    const x3 = w * 0.5 + Math.cos(t * 0.4 + 1.5) * (w * 0.12);
    const y3 = h * 0.5 + Math.sin(t * 0.9) * (h * 0.12);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Orb 1 (Primary)
    const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
    g1.addColorStop(0, colorWithAlpha(pal.primary, 0.48));
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    // Orb 2 (Secondary)
    const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r1 * 1.1);
    g2.addColorStop(0, colorWithAlpha(pal.secondary, 0.40));
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    // Orb 3 (Accent)
    const g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r1 * 0.8);
    g3.addColorStop(0, colorWithAlpha(pal.accent, 0.35));
    g3.addColorStop(1, 'transparent');
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const rx = w / 2;
    const ry = h / 2;
    const radius = Math.max(w, h) * 0.75;
    const vignette = ctx.createRadialGradient(rx, ry, radius * 0.35, rx, ry, radius);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.75)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  private drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.grainCanvas) return;
    if (!this.grainPattern) {
      this.grainPattern = ctx.createPattern(this.grainCanvas, 'repeat');
    }
    if (!this.grainPattern) return;

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = this.grainPattern;
    // Subtly jitter grain offset for film motion
    const shiftX = (Math.floor(this.timeElapsed * 15) % 8) * 8;
    const shiftY = (Math.floor(this.timeElapsed * 12) % 8) * 8;
    ctx.translate(shiftX, shiftY);
    ctx.fillRect(-shiftX, -shiftY, w, h);
    ctx.restore();
  }

  public resetScrollToActive(ctx: CanvasRenderingContext2D, state: StageState) {
    this.computeLineLayouts(ctx, state);
    const opticalCenterY = state.height * 0.44;
    if (state.activeLineIndex >= 0 && state.activeLineIndex < this.cachedLayouts.length) {
      const activeLayout = this.cachedLayouts[state.activeLineIndex];
      this.scrollY = opticalCenterY - (activeLayout.y + activeLayout.height / 2);
    } else if (this.cachedLayouts.length > 0) {
      this.scrollY = opticalCenterY - 40;
    }
    this.scrollVelocity = 0;
    this.lastActiveIndex = state.activeLineIndex;
  }

  private drawHeader(ctx: CanvasRenderingContext2D, state: StageState) {
    const { track, width } = state;
    if (!track) return;

    const pad = 24;
    const thumbSize = 38;

    ctx.save();
    // Thumbnail rounded card
    const tx = pad;
    const ty = pad;
    const radius = 10;

    ctx.beginPath();
    ctx.roundRect(tx, ty, thumbSize, thumbSize, radius);
    ctx.clip();

    if (this.coverImage && this.coverImage.complete) {
      ctx.drawImage(this.coverImage, tx, ty, thumbSize, thumbSize);
    } else {
      ctx.fillStyle = '#222533';
      ctx.fillRect(tx, ty, thumbSize, thumbSize);
    }
    ctx.restore();

    // Track and artist text
    ctx.save();
    const textX = tx + thumbSize + 12;
    const maxTitleW = width < 640 ? width - textX - 80 : 320;

    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    const title = track.track || track.title || 'Unknown Title';
    ctx.fillText(this.truncateText(ctx, title, maxTitleW), textX, ty + 15);

    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const artist = track.artist || track.uploader || 'Unknown Artist';
    ctx.fillText(this.truncateText(ctx, artist, maxTitleW), textX, ty + 32);

    ctx.restore();
  }

  private drawWatermark(ctx: CanvasRenderingContext2D, width: number) {
    ctx.save();
    ctx.font = '600 10px Syne, Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'right';
    ctx.letterSpacing = '1px';
    ctx.fillText('LYRICVIBE', width - 24, 38);
    ctx.restore();
  }

  private drawBottomProgressBar(ctx: CanvasRenderingContext2D, state: StageState) {
    const { currentTime, duration, width, height } = state;
    if (duration <= 0) return;

    const progress = Math.max(0, Math.min(1, currentTime / duration));
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, height - 3, width, 3);

    // Glowing active progress line
    ctx.fillStyle = '#60a5fa';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 6;
    ctx.fillRect(0, height - 3, width * progress, 3);
    ctx.restore();
  }

  private drawLyrics(ctx: CanvasRenderingContext2D, state: StageState, dt: number) {
    const { width, height, activeLineIndex, visualOptions, prefersReducedMotion, currentTime } = state;
    const opticalCenterY = height * 0.44;

    // Detect seeking vs natural play progression
    const isSeeking = this.lastActiveIndex !== -1 && Math.abs(activeLineIndex - this.lastActiveIndex) > 1;
    this.lastActiveIndex = activeLineIndex;

    // Determine target scroll position
    let targetScrollY = 0;
    if (activeLineIndex >= 0 && activeLineIndex < this.cachedLayouts.length) {
      const activeLayout = this.cachedLayouts[activeLineIndex];
      targetScrollY = opticalCenterY - (activeLayout.y + activeLayout.height / 2);
    } else if (this.cachedLayouts.length > 0) {
      targetScrollY = opticalCenterY - 40;
    }

    // Step scroll spring
    if (prefersReducedMotion) {
      this.scrollY = targetScrollY;
      this.scrollVelocity = 0;
    } else {
      const springConfig = isSeeking ? SPRINGS.seek : SPRINGS.scroll;
      const [newScrollY, newVel] = stepSpring(
        this.scrollY,
        targetScrollY,
        this.scrollVelocity,
        springConfig,
        dt
      );
      this.scrollY = newScrollY;
      this.scrollVelocity = newVel;
    }

    const { fontSize, lineHeight, maxTextWidth, fontName } = this.getTypography(width, visualOptions);
    const isCenter = visualOptions.alignment !== 'left';
    const alignX = isCenter ? width / 2 : Math.max(28, (width - maxTextWidth) / 2);

    ctx.save();
    ctx.textAlign = isCenter ? 'center' : 'left';
    ctx.textBaseline = 'middle';

    // Render visible lyric lines
    for (let i = 0; i < this.cachedLayouts.length; i++) {
      const layout = this.cachedLayouts[i];
      const lineCenterY = this.scrollY + layout.y + layout.height / 2;

      // Skip lines far outside canvas view
      if (lineCenterY + layout.height < -120 || lineCenterY - layout.height > height + 120) {
        continue;
      }

      const isActive = i === activeLineIndex;
      const distance = Math.abs(i - (activeLineIndex === -1 ? 0 : activeLineIndex));

      // Scale & Opacity: elegant 1.08x lift for active line, smooth dimming for neighbors
      const targetScale = isActive ? 1.08 : distance === 1 ? 0.98 : 0.92;
      const targetOpacity = isActive ? 1.0 : distance === 1 ? 0.55 : distance === 2 ? 0.30 : 0.15;

      // Update line spring physics
      let spring = this.lineSprings.get(i);
      if (!spring) {
        spring = {
          y: lineCenterY,
          vy: 0,
          scale: targetScale,
          vscale: 0,
          opacity: targetOpacity,
          vopacity: 0,
        };
        this.lineSprings.set(i, spring);
      }

      if (prefersReducedMotion) {
        spring.scale = targetScale;
        spring.opacity = targetOpacity;
      } else {
        const [sScale, vScale] = stepSpring(spring.scale, targetScale, spring.vscale, SPRINGS.scale, dt);
        const [sOpac, vOpac] = stepSpring(spring.opacity, targetOpacity, spring.vopacity, SPRINGS.opacity, dt);
        spring.scale = sScale;
        spring.vscale = vScale;
        spring.opacity = sOpac;
        spring.vopacity = vOpac;
      }

      // Draw instrumental gap pause indicator
      if (layout.isInstrumental) {
        this.drawInstrumentalDots(ctx, alignX, lineCenterY, spring.scale, spring.opacity);
        continue;
      }

      // Line typography transform
      ctx.save();
      ctx.translate(alignX, lineCenterY);
      ctx.scale(spring.scale, spring.scale);

      ctx.font = `${isActive ? '700' : '600'} ${fontSize}px "${fontName}", sans-serif`;

      const blockTotalH = layout.wrappedLines.length * lineHeight;
      const startLocalY = -blockTotalH / 2 + lineHeight / 2;

      // Calculate continuous progressive highlight across wrapped lines
      const hasNextTime = layout.nextTime && layout.nextTime > layout.time;
      const duration = hasNextTime ? layout.nextTime! - layout.time : 0;
      const overallProgress = duration > 0 ? Math.max(0, Math.min(1, (currentTime - layout.time) / duration)) : 1;

      // Character count distribution across wrapped sub-lines
      const totalChars = layout.wrappedLines.reduce((acc, l) => acc + l.length, 0) || 1;
      let charOffset = 0;

      for (let wIdx = 0; wIdx < layout.wrappedLines.length; wIdx++) {
        const lineText = layout.wrappedLines[wIdx];
        const lineLocalY = startLocalY + wIdx * lineHeight;
        const lineCharCount = lineText.length;

        if (isActive) {
          // Calculate this sub-line's fraction of the overall sentence duration
          const startFrac = charOffset / totalChars;
          const endFrac = (charOffset + lineCharCount) / totalChars;

          let subProgress = 1;
          if (hasNextTime) {
            if (overallProgress <= startFrac) {
              subProgress = 0;
            } else if (overallProgress >= endFrac) {
              subProgress = 1;
            } else {
              subProgress = (overallProgress - startFrac) / (endFrac - startFrac);
            }
          }

          // 1. Draw base active text (brilliant readable active white)
          ctx.save();
          ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.fillText(lineText, 0, lineLocalY);
          ctx.restore();

          // 2. Draw synced progressive karaoke illumination
          if (subProgress > 0) {
            const fullW = ctx.measureText(lineText).width;
            const startX = isCenter ? -fullW / 2 : 0;

            ctx.save();
            if (subProgress < 1) {
              ctx.beginPath();
              ctx.rect(startX - 2, lineLocalY - lineHeight * 0.65, fullW * subProgress + 4, lineHeight * 1.3);
              ctx.clip();
            }

            // Radiant sung highlight with luminous glow
            ctx.shadowColor = '#93c5fd';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(lineText, 0, lineLocalY);
            ctx.restore();
          }
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(235, 238, 245, ${spring.opacity})`;
          ctx.fillText(lineText, 0, lineLocalY);
        }

        charOffset += lineCharCount;
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawInstrumentalDots(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    opacity: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const dotSpacing = 18;
    const numDots = 3;
    const startX = -((numDots - 1) * dotSpacing) / 2;

    for (let d = 0; d < numDots; d++) {
      const dotX = startX + d * dotSpacing;
      const wave = Math.sin(this.timeElapsed * 4 + d * 0.8) * 0.5 + 0.5;
      const dotAlpha = opacity * (0.35 + wave * 0.65);
      const dotRadius = 3.5 + wave * 1.5;

      ctx.beginPath();
      ctx.arc(dotX, 0, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(147, 197, 253, ${dotAlpha})`;
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    ctx.restore();
  }

  private drawIdleState(ctx: CanvasRenderingContext2D, state: StageState) {
    const { width, height, track, visualOptions } = state;
    const cx = width / 2;
    const cy = height / 2;
    const fontName = visualOptions.font || 'Syne';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `700 ${width < 640 ? 28 : 40}px "${fontName}", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 20;

    const title = track?.track || track?.title || 'Playing';
    ctx.fillText(title, cx, cy - 20);

    ctx.font = '500 16px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 0;
    ctx.fillText(track?.artist || 'Unknown Artist', cx, cy + 24);

    ctx.restore();
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(`${truncated}...`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}...`;
  }
}

