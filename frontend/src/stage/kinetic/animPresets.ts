import { WordLayoutBox, KineticPhrase, WordPreset } from './types';

export interface WordRenderState {
  visible: boolean;
  opacity: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotation: number;
  isSung: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  sungProgress: number; // 0..1 during the word's singing
  glowAlpha: number;
  shakeX: number;
  shakeY: number;
  slamAberration: number;
}

function easeOutBack(x: number, c1 = 1.70158): number {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Pure deterministic word animation evaluation.
 * In Lyricsvibe style:
 * - Upcoming words are visible with clean elegant readability (opacity ~0.38)
 * - Currently sung words pop with vibrant accent glow and scale (opacity 1.0)
 * - Already sung words remain clearly readable (opacity ~0.85)
 * - Entire phrase feels alive, fluid, and never "stuck"
 */
export function getWordAnimationState(
  t: number,
  box: WordLayoutBox,
  phrase: KineticPhrase,
  energyAtT = 0.5,
  prefersReducedMotion = false
): WordRenderState {
  const word = box.word;
  const start = word.start;
  const end = word.end;

  const isUpcoming = t < start;
  const isSung = t >= start && t <= end;
  const isPast = t > end;

  let opacity = 0.38;
  let scale = 1.0;
  let glowAlpha = 0;
  let sungProgress = 0;
  let slamAberration = 0;

  if (isSung) {
    const dur = Math.max(0.08, end - start);
    sungProgress = Math.min(1, Math.max(0, (t - start) / dur));
    opacity = 1.0;

    // Smooth pop scale upon entrance of singing (1.0 -> 1.06 -> 1.02)
    if (sungProgress < 0.35) {
      const popP = sungProgress / 0.35;
      scale = 1.0 + 0.06 * Math.sin(popP * Math.PI);
    } else {
      scale = 1.02;
    }

    glowAlpha = 0.85 + 0.15 * Math.sin(sungProgress * Math.PI);
    slamAberration = 0;
  } else if (isPast) {
    opacity = 0.88;
    scale = 1.0;
    glowAlpha = 0;
  } else {
    // Upcoming word
    opacity = 0.38;
    scale = 1.0;
    glowAlpha = 0;
  }

  // Gentle, organic floating drift
  let driftX = 0;
  let driftY = 0;
  let driftRot = 0;

  if (!prefersReducedMotion) {
    const wordSeed = (phrase.seed ^ (word.line * 43 + (word.colorIndex + 1) * 23)) >>> 0;
    const floatPhase = t * 1.4 + (wordSeed % 100) * 0.08;
    driftX = Math.sin(floatPhase) * 1.5;
    driftY = Math.cos(floatPhase * 0.8) * 1.2;
    driftRot = Math.sin(floatPhase * 0.5) * 0.008;
  }

  return {
    visible: true,
    opacity,
    scaleX: scale,
    scaleY: scale,
    translateX: driftX,
    translateY: driftY,
    rotation: (box.rotation || 0) + driftRot,
    isSung,
    isPast,
    isUpcoming,
    sungProgress,
    glowAlpha,
    shakeX: 0,
    shakeY: 0,
    slamAberration,
  };
}
