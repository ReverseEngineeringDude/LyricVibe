import { KineticPhrase, AudioAnalysisData, KineticOptions } from './types';

export interface CameraState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  punchScale: number;
  shakeX: number;
  shakeY: number;
  whipBlurAlpha: number;
}

// Binary search for nearest prior timestamp in a sorted array
function findPriorTimestamp(arr: number[] | undefined, t: number): number | null {
  if (!arr || arr.length === 0) return null;
  let low = 0;
  let high = arr.length - 1;
  let best: number | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (arr[mid] <= t) {
      best = arr[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

// Sample energy at time t from 30Hz array
export function getEnergyAtTime(analysis: AudioAnalysisData | null, t: number): number {
  if (!analysis || !analysis.energy || analysis.energy.length === 0) {
    return 0.5;
  }
  const energy = analysis.energy;
  const firstT = energy[0].t;
  const lastT = energy[energy.length - 1].t;
  if (t <= firstT) return energy[0].v;
  if (t >= lastT) return energy[energy.length - 1].v;

  const idx = Math.floor(((t - firstT) / (lastT - firstT)) * (energy.length - 1));
  const clampedIdx = Math.max(0, Math.min(energy.length - 1, idx));
  return energy[clampedIdx]?.v ?? 0.5;
}

/**
 * Pure deterministic camera calculation at audio time t.
 * Silky smooth, organic drift with subtle beat cushions.
 * No violent shaking, twitching, or blinking.
 */
export function getCameraAtTime(
  t: number,
  activePhrase: KineticPhrase | null,
  nextPhrase: KineticPhrase | null,
  analysis: AudioAnalysisData | null,
  options: KineticOptions,
  prefersReducedMotion = false
): CameraState {
  let camX = 0;
  let camY = 0;
  let camScale = 1.0;
  let camRot = 0;
  let punchScale = 1.0;
  let shakeX = 0;
  let shakeY = 0;

  const isWild = options.intensity === 'wild';
  const isCalm = options.intensity === 'calm';

  // 1. Musical beat cushion & recoil
  if (options.beatReactions && !prefersReducedMotion && analysis) {
    const energy = getEnergyAtTime(analysis, t);
    const lastBeat = findPriorTimestamp(analysis.beats, t);
    if (lastBeat !== null) {
      const dtBeat = t - lastBeat;
      if (dtBeat >= 0 && dtBeat <= 0.22) {
        const decay = Math.exp(-dtBeat * (isWild ? 14 : isCalm ? 20 : 16));
        const beatPower = isWild ? 0.055 : isCalm ? 0.008 : 0.022;
        punchScale += beatPower * decay * (0.5 + 0.5 * energy);

        // Tactile micro-shake on beat impact in Wild mode
        if (isWild && dtBeat <= 0.12) {
          const shakeFactor = (1.0 - dtBeat / 0.12) * energy * 4.5;
          shakeX = Math.sin(t * 90) * shakeFactor;
          shakeY = Math.cos(t * 80) * shakeFactor;
        }
      }
    }
  }

  // 2. Camera drift motion
  if (options.cameraMovement && !prefersReducedMotion) {
    const dMag = isWild ? 16.0 : isCalm ? 1.8 : 6.0;
    const rMag = isWild ? 0.028 : isCalm ? 0.001 : 0.007;
    const driftSpeed = isWild ? 1.8 : isCalm ? 0.5 : 1.0;

    camX += (Math.sin(t * 0.35 * driftSpeed) * 0.7 + Math.sin(t * 0.8 * driftSpeed) * 0.3) * dMag;
    camY += (Math.cos(t * 0.28 * driftSpeed) * 0.7 + Math.sin(t * 0.65 * driftSpeed) * 0.3) * dMag;
    camRot += Math.sin(t * 0.22 * driftSpeed) * rMag;
  }

  // 3. Smooth phrase transition camera breathe
  if (activePhrase && nextPhrase && options.cameraMovement && !prefersReducedMotion) {
    const transWindow = isWild ? 0.35 : isCalm ? 0.65 : 0.5;
    const transStart = activePhrase.end - transWindow;
    if (t >= transStart && t <= activePhrase.end) {
      const p = (t - transStart) / transWindow;
      const breatheMagnitude = isWild ? 0.065 : isCalm ? 0.012 : 0.03;
      const breathe = Math.sin(p * Math.PI) * breatheMagnitude;
      camScale += breathe;
    }
  }

  return {
    x: camX + shakeX,
    y: camY + shakeY,
    scale: camScale * punchScale,
    rotation: camRot,
    punchScale,
    shakeX,
    shakeY,
    whipBlurAlpha: isWild ? 0.15 : 0,
  };
}
