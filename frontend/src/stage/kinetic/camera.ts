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

  const intensityMult =
    options.intensity === 'wild' ? 1.4 : options.intensity === 'calm' ? 0.35 : 1.0;

  // 1. Subtle musical beat cushion (max 1.015 scale, smooth exponential decay, no jitter)
  if (options.beatReactions && !prefersReducedMotion && analysis) {
    const energy = getEnergyAtTime(analysis, t);
    const lastBeat = findPriorTimestamp(analysis.beats, t);
    if (lastBeat !== null) {
      const dtBeat = t - lastBeat;
      if (dtBeat >= 0 && dtBeat <= 0.18) {
        const decay = Math.exp(-dtBeat * 16);
        punchScale += 0.015 * decay * (0.6 + 0.4 * energy) * intensityMult;
      }
    }
  }

  // 2. Continuous serene floating camera drift
  if (options.cameraMovement && !prefersReducedMotion) {
    const dMag = 5.0 * intensityMult;
    const rMag = 0.005 * intensityMult;
    camX += (Math.sin(t * 0.35) * 0.7 + Math.sin(t * 0.8) * 0.3) * dMag;
    camY += (Math.cos(t * 0.28) * 0.7 + Math.sin(t * 0.65) * 0.3) * dMag;
    camRot += Math.sin(t * 0.22) * rMag;
  }

  // 3. Smooth phrase transition camera breathe
  if (activePhrase && nextPhrase && options.cameraMovement && !prefersReducedMotion) {
    const transWindow = 0.5;
    const transStart = activePhrase.end - transWindow;
    if (t >= transStart && t <= activePhrase.end) {
      const p = (t - transStart) / transWindow;
      // Gentle depth breathe (1.0 -> 1.025 -> 1.0)
      const breathe = Math.sin(p * Math.PI) * 0.025 * intensityMult;
      camScale += breathe;
    }
  }

  return {
    x: camX,
    y: camY,
    scale: camScale * punchScale,
    rotation: camRot,
    punchScale,
    shakeX: 0,
    shakeY: 0,
    whipBlurAlpha: 0,
  };
}
