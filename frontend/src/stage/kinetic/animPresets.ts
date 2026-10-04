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
  prefersReducedMotion = false,
  intensity: 'calm' | 'balanced' | 'wild' = 'balanced'
): WordRenderState {
  const word = box.word;
  const start = word.start;
  const end = word.end;

  const isUpcoming = t < start;
  const isSung = t >= start && t <= end;
  const isPast = t > end;

  const isWild = intensity === 'wild';
  const isCalm = intensity === 'calm';

  let opacity = isCalm ? 0.30 : isWild ? 0.45 : 0.38;
  let scale = 1.0;
  let glowAlpha = 0;
  let sungProgress = 0;
  let slamAberration = 0;
  let wordShakeX = 0;
  let wordShakeY = 0;

  if (isSung) {
    const dur = Math.max(0.08, end - start);
    sungProgress = Math.min(1, Math.max(0, (t - start) / dur));
    opacity = 1.0;

    if (isWild) {
      // Wild: Explosive 1.28x spring bounce with punchy overshoot
      if (sungProgress < 0.40) {
        const popP = sungProgress / 0.40;
        scale = 1.0 + 0.28 * easeOutBack(Math.sin(popP * Math.PI * 0.5));
      } else {
        scale = 1.05;
      }
      glowAlpha = 1.25;
      slamAberration = Math.max(0, 1.0 - sungProgress) * 7.5 * (0.6 + 0.4 * energyAtT);

      // Micro entrance shake
      if (sungProgress < 0.20 && !prefersReducedMotion) {
        const sP = (1.0 - sungProgress / 0.20) * 3.5;
        wordShakeX = Math.sin(t * 110) * sP;
        wordShakeY = Math.cos(t * 95) * sP;
      }
    } else if (isCalm) {
      // Calm: Gentle, serene 1.03x breathing scale
      if (sungProgress < 0.40) {
        const popP = sungProgress / 0.40;
        scale = 1.0 + 0.03 * Math.sin(popP * Math.PI);
      } else {
        scale = 1.01;
      }
      glowAlpha = 0.50;
      slamAberration = 0;
    } else {
      // Balanced: Clean 1.10x pop bounce
      if (sungProgress < 0.35) {
        const popP = sungProgress / 0.35;
        scale = 1.0 + 0.10 * Math.sin(popP * Math.PI);
      } else {
        scale = 1.02;
      }
      glowAlpha = 0.85 + 0.15 * Math.sin(sungProgress * Math.PI);
      slamAberration = 0;
    }
  } else if (isPast) {
    opacity = isCalm ? 0.78 : isWild ? 0.94 : 0.88;
    scale = 1.0;
    glowAlpha = 0;
  } else {
    // Upcoming word
    opacity = isCalm ? 0.30 : isWild ? 0.45 : 0.38;
    scale = 1.0;
    glowAlpha = 0;
  }

  // Organic floating drift tailored by intensity
  let driftX = 0;
  let driftY = 0;
  let driftRot = 0;

  if (!prefersReducedMotion) {
    const wordSeed = (phrase.seed ^ (word.line * 43 + (word.colorIndex + 1) * 23)) >>> 0;
    const speedMult = isWild ? 2.2 : isCalm ? 0.6 : 1.2;
    const ampMult = isWild ? 2.5 : isCalm ? 0.45 : 1.1;

    const floatPhase = t * (1.2 * speedMult) + (wordSeed % 100) * 0.08;
    driftX = Math.sin(floatPhase) * 1.5 * ampMult;
    driftY = Math.cos(floatPhase * 0.8) * 1.2 * ampMult;
    driftRot = isCalm ? 0 : Math.sin(floatPhase * 0.5) * (isWild ? 0.032 : 0.009);
  }

  return {
    visible: true,
    opacity,
    scaleX: scale,
    scaleY: scale,
    translateX: driftX + wordShakeX,
    translateY: driftY + wordShakeY,
    rotation: (box.rotation || 0) + driftRot,
    isSung,
    isPast,
    isUpcoming,
    sungProgress,
    glowAlpha,
    shakeX: wordShakeX,
    shakeY: wordShakeY,
    slamAberration,
  };
}
