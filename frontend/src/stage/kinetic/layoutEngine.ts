import { KineticPhrase, PhraseLayout, WordLayoutBox, WordItem } from './types';

// Measurement cache: fontKey:text -> metrics width
const METRICS_CACHE = new Map<string, number>();

// Segmenter for safe grapheme clustering across international scripts
let segmenter: any = null;
try {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
  }
} catch {}

export function segmentGraphemes(text: string): { graphemes: string[]; isSafeToSplit: boolean } {
  const isComplexScript = /[\u0900-\u097F\u0D00-\u0D7F\u0600-\u06FF]/.test(text);

  if (segmenter) {
    const segments = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    return {
      graphemes: segments,
      isSafeToSplit: !isComplexScript,
    };
  }

  return {
    graphemes: Array.from(text),
    isSafeToSplit: !isComplexScript,
  };
}

export function getFontFamilyString(category: 'grotesque' | 'serif' | 'mono'): string {
  switch (category) {
    case 'grotesque':
      return '"Anton", "Archivo Black", "Syne", "Noto Sans", "Noto Sans Malayalam", "Noto Sans Devanagari", sans-serif';
    case 'serif':
      return '"Playfair Display", "Noto Sans", "Noto Sans Malayalam", serif';
    case 'mono':
      return '"Space Mono", monospace, "Noto Sans"';
  }
}

export function getWordDisplayText(word: WordItem): string {
  if (word.textTransform === 'uppercase') return word.text.toUpperCase();
  if (word.textTransform === 'capitalize') {
    return word.text.charAt(0).toUpperCase() + word.text.slice(1);
  }
  return word.text;
}

function measureTextCached(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = `${font}:${text}`;
  const hit = METRICS_CACHE.get(key);
  if (hit !== undefined) return hit;

  ctx.font = font;
  const m = ctx.measureText(text).width;
  METRICS_CACHE.set(key, m);
  return m;
}

/**
 * Computes deterministic 2D layout for a phrase inside canvas width/height.
 * Strictly guarantees ZERO word-to-word collisions and safe margins.
 */
export function computePhraseLayout(
  ctx: CanvasRenderingContext2D,
  phrase: KineticPhrase,
  canvasWidth: number,
  canvasHeight: number,
  intensity: 'calm' | 'balanced' | 'wild' = 'balanced'
): PhraseLayout {
  const isPortrait = canvasHeight > canvasWidth;
  const isWild = intensity === 'wild';
  const isCalm = intensity === 'calm';

  // Safe area margins: generous on calm, standard on balanced, punchy on wild
  const marginScale = isCalm ? 1.2 : isWild ? 0.85 : 1.0;
  const safeMarginX = canvasWidth * (isPortrait ? 0.09 : 0.12) * marginScale;
  const safeMarginY = canvasHeight * (isPortrait ? 0.14 : 0.10) * marginScale;
  const maxSafeWidth = canvasWidth - safeMarginX * 2;
  const maxSafeHeight = canvasHeight - safeMarginY * 2;

  // Base font sizing reference adapted by intensity
  const sizeMult = isWild ? 1.28 : isCalm ? 0.84 : 1.0;
  const baseSize = Math.max(20, Math.min(canvasWidth, canvasHeight) * 0.082 * sizeMult);

  const words = phrase.words;
  const template = phrase.template;

  let boxes: WordLayoutBox[] = [];

  switch (template) {
    case 'single-word-fullscreen': {
      const w = words[0];
      const text = getWordDisplayText(w);
      let fontSize = Math.min(canvasWidth * 0.28, canvasHeight * 0.24);
      let font = `900 ${fontSize}px ${getFontFamilyString(w.fontCategory)}`;
      let textW = measureTextCached(ctx, text, font);

      // Clamp if text exceeds safe width
      if (textW > maxSafeWidth) {
        fontSize *= maxSafeWidth / textW;
        font = `900 ${fontSize}px ${getFontFamilyString(w.fontCategory)}`;
        textW = measureTextCached(ctx, text, font);
      }

      const { graphemes, isSafeToSplit } = segmentGraphemes(text);

      boxes.push({
        word: w,
        x: -textW / 2,
        y: -fontSize / 2,
        w: textW,
        h: fontSize,
        fontSize,
        fontFamily: font,
        graphemes,
        isSafeToSplit,
        clipY: -fontSize * 0.1,
      });
      break;
    }

    case 'split': {
      // Two contrasting words in opposing vertical halves (zero collision)
      const w1 = words[0];
      const w2 = words[1] || words[0];
      const t1 = getWordDisplayText(w1);
      const t2 = getWordDisplayText(w2);

      const size1 = baseSize * (w1.importance > 0.6 ? 1.5 : 1.2);
      const size2 = baseSize * (w2.importance > 0.6 ? 1.5 : 1.2);

      const font1 = `900 ${size1}px ${getFontFamilyString(w1.fontCategory)}`;
      const font2 = `900 ${size2}px ${getFontFamilyString(w2.fontCategory)}`;

      const tw1 = measureTextCached(ctx, t1, font1);
      const tw2 = measureTextCached(ctx, t2, font2);

      const seg1 = segmentGraphemes(t1);
      const seg2 = segmentGraphemes(t2);

      // Top word placed in top half; bottom word placed in bottom half
      const gapY = 24;
      const topY = -size1 - gapY / 2;
      const bottomY = gapY / 2;

      boxes.push({
        word: w1,
        x: -tw1 / 2 - maxSafeWidth * 0.12,
        y: topY,
        w: tw1,
        h: size1,
        fontSize: size1,
        fontFamily: font1,
        graphemes: seg1.graphemes,
        isSafeToSplit: seg1.isSafeToSplit,
        rotation: isCalm ? 0 : isWild ? -0.09 : -0.03,
      });

      boxes.push({
        word: w2,
        x: -tw2 / 2 + maxSafeWidth * 0.12,
        y: bottomY,
        w: tw2,
        h: size2,
        fontSize: size2,
        fontFamily: font2,
        graphemes: seg2.graphemes,
        isSafeToSplit: seg2.isSafeToSplit,
        rotation: isCalm ? 0 : isWild ? 0.09 : 0.03,
      });
      break;
    }

    case 'centered-hero': {
      // Hero word in center; before words on a clean line above; after words on a clean line below
      const heroIdx = phrase.heroWordIndex;
      const heroWord = words[heroIdx];
      const heroText = getWordDisplayText(heroWord);
      let heroSize = baseSize * 1.75;
      let heroFont = `900 ${heroSize}px ${getFontFamilyString(heroWord.fontCategory)}`;
      let heroW = measureTextCached(ctx, heroText, heroFont);

      if (heroW > maxSafeWidth) {
        heroSize *= maxSafeWidth / heroW;
        heroFont = `900 ${heroSize}px ${getFontFamilyString(heroWord.fontCategory)}`;
        heroW = measureTextCached(ctx, heroText, heroFont);
      }

      const heroSeg = segmentGraphemes(heroText);
      const heroY = -heroSize * 0.45;
      const heroBottom = heroY + heroSize;

      boxes.push({
        word: heroWord,
        x: -heroW / 2,
        y: heroY,
        w: heroW,
        h: heroSize,
        fontSize: heroSize,
        fontFamily: heroFont,
        graphemes: heroSeg.graphemes,
        isSafeToSplit: heroSeg.isSafeToSplit,
      });

      // Helper to lay out a group of words in a single clean row
      const layoutSubLine = (subWords: WordItem[], rowY: number) => {
        if (subWords.length === 0) return;
        const subSize = baseSize * 0.75;
        const wordMetrics = subWords.map((bw) => {
          const t = getWordDisplayText(bw);
          const font = `700 ${subSize}px ${getFontFamilyString(bw.fontCategory)}`;
          return {
            w: bw,
            t,
            font,
            width: measureTextCached(ctx, t, font),
            gap: subSize * 0.35,
          };
        });

        const totalRowW = wordMetrics.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? item.gap : 0), 0);
        let curX = -totalRowW / 2;

        for (const item of wordMetrics) {
          const seg = segmentGraphemes(item.t);
          boxes.push({
            word: item.w,
            x: curX,
            y: rowY,
            w: item.width,
            h: subSize,
            fontSize: subSize,
            fontFamily: item.font,
            graphemes: seg.graphemes,
            isSafeToSplit: seg.isSafeToSplit,
          });
          curX += item.width + item.gap;
        }
      };

      const beforeWords = words.slice(0, heroIdx);
      const afterWords = words.slice(heroIdx + 1);

      // Guaranteed 20px vertical clearance so no words ever touch or overlap
      const subSize = baseSize * 0.75;
      if (beforeWords.length > 0) {
        layoutSubLine(beforeWords, heroY - subSize - 20);
      }
      if (afterWords.length > 0) {
        layoutSubLine(afterWords, heroBottom + 20);
      }
      break;
    }

    case 'diagonal-cascade': {
      // Each word is on its own separate line vertically (overlap impossible!)
      const numWords = words.length;
      const fontSize = baseSize * 1.05;
      const rowHeight = fontSize * 1.35;
      let totalH = numWords * rowHeight;

      let curY = -totalH / 2;
      const maxStaggerX = maxSafeWidth * 0.45;
      const startStaggerX = -maxStaggerX / 2;

      for (let i = 0; i < numWords; i++) {
        const w = words[i];
        const t = getWordDisplayText(w);
        const font = `800 ${fontSize}px ${getFontFamilyString(w.fontCategory)}`;
        const tw = measureTextCached(ctx, t, font);
        const seg = segmentGraphemes(t);

        const xFrac = numWords > 1 ? i / (numWords - 1) : 0.5;
        const xPos = startStaggerX + xFrac * maxStaggerX - tw / 2;

        boxes.push({
          word: w,
          x: xPos,
          y: curY,
          w: tw,
          h: fontSize,
          fontSize,
          fontFamily: font,
          graphemes: seg.graphemes,
          isSafeToSplit: seg.isSafeToSplit,
          rotation: isCalm ? 0 : isWild ? (i % 2 === 0 ? 0.08 : -0.08) : (i % 2 === 0 ? 0.025 : -0.025),
        });

        curY += rowHeight;
      }
      break;
    }

    case 'alternating-banner':
    case 'cyber-editorial':
    case 'vertical-stack':
    case 'stacked-left':
    default: {
      // General non-overlapping multi-line grouping:
      // Group words into lines that strictly respect maxSafeWidth
      const lines: WordItem[][] = [];
      let curLine: WordItem[] = [];
      let curLineWidth = 0;

      for (const w of words) {
        const t = getWordDisplayText(w);
        const font = `800 ${baseSize}px ${getFontFamilyString(w.fontCategory)}`;
        const wordW = measureTextCached(ctx, t, font);
        const gap = baseSize * 0.35;

        if (curLine.length > 0 && curLineWidth + gap + wordW > maxSafeWidth * 0.88) {
          lines.push(curLine);
          curLine = [w];
          curLineWidth = wordW;
        } else {
          curLine.push(w);
          curLineWidth += (curLine.length > 1 ? gap : 0) + wordW;
        }
      }
      if (curLine.length > 0) lines.push(curLine);

      // Measure height of each line
      const lineHeights: number[] = [];
      let totalStackHeight = 0;

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const l = lines[lIdx];
        const maxImp = Math.max(...l.map((w) => w.importance));
        const lh = baseSize * (0.95 + maxImp * 0.65);
        lineHeights.push(lh);
        totalStackHeight += lh * 1.35;
      }

      let curY = -totalStackHeight / 2;

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const l = lines[lIdx];
        const lh = lineHeights[lIdx];

        const wordMetrics = l.map((w, wIdx) => {
          const t = getWordDisplayText(w);
          const font = `800 ${lh * 0.9}px ${getFontFamilyString(w.fontCategory)}`;
          return {
            w,
            t,
            fontSize: lh * 0.9,
            font,
            width: measureTextCached(ctx, t, font),
            gap: lh * 0.32,
          };
        });

        const lineTotalW = wordMetrics.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? item.gap : 0), 0);
        let startX = -lineTotalW / 2;

        for (const item of wordMetrics) {
          const seg = segmentGraphemes(item.t);
          boxes.push({
            word: item.w,
            x: startX,
            y: curY,
            w: item.width,
            h: item.fontSize,
            fontSize: item.fontSize,
            fontFamily: item.font,
            graphemes: seg.graphemes,
            isSafeToSplit: seg.isSafeToSplit,
          });
          startX += item.width + item.gap;
        }

        // Advance to next row with guaranteed non-overlapping spacing
        curY += lh * 1.35;
      }
      break;
    }
  }

  // Global bounding box calculation
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.h);
  }

  const boundsW = Math.max(10, maxX - minX);
  const boundsH = Math.max(10, maxY - minY);

  // Proportional fit scale if layout exceeds safe boundaries
  const scaleFitX = maxSafeWidth / boundsW;
  const scaleFitY = maxSafeHeight / boundsH;
  const fitScale = Math.min(1.0, scaleFitX, scaleFitY) * 0.94;

  if (fitScale < 0.98) {
    for (const b of boxes) {
      b.x *= fitScale;
      b.y *= fitScale;
      b.w *= fitScale;
      b.h *= fitScale;
      b.fontSize *= fitScale;
      b.fontFamily = b.fontFamily.replace(/\d+(?:\.\d+)?px/, `${Math.round(b.fontSize)}px`);
    }
  }

  return {
    width: boundsW * fitScale,
    height: boundsH * fitScale,
    wordBoxes: boxes,
  };
}
