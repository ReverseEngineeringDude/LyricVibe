/**
 * Deterministic PRNG and String Hashing for Kinetic Typography.
 * Mulberry32 32-bit state generator for 100% reproducible animations across runs.
 */

export function stringHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hashPhrase(videoId: string, phraseIndex: number): number {
  return stringHash(`${videoId}_phrase_${phraseIndex}`);
}

export interface PRNG {
  next: () => number; // [0, 1)
  range: (min: number, max: number) => number;
  choice: <T>(arr: T[]) => T;
  boolean: (chance?: number) => boolean;
}

export function createPRNG(seed: number): PRNG {
  let s = (seed >>> 0) || 123456789;

  const next = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number) => {
    return min + next() * (max - min);
  };

  const choice = <T>(arr: T[]): T => {
    if (!arr || arr.length === 0) return undefined as any;
    const idx = Math.floor(next() * arr.length);
    return arr[Math.min(idx, arr.length - 1)];
  };

  const boolean = (chance = 0.5) => {
    return next() < chance;
  };

  return { next, range, choice, boolean };
}
