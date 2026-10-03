/**
 * Importance scoring for Kinetic Typography words (0..1 score).
 * Determines hierarchy: font size (0.6x to 2.4x), weight, font family and fill vs outline.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'up', 'down', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'i', 'me', 'my', 'we', 'us',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
  'them', 'their', 'this', 'that', 'these', 'those', 'as', 'than', 'too', 'very',
]);

const EMOTIONAL_LEXICON = new Set([
  'love', 'fire', 'heart', 'soul', 'burn', 'night', 'light', 'dark', 'fall', 'fly',
  'run', 'die', 'live', 'scream', 'cry', 'break', 'dream', 'sky', 'pain', 'rain',
  'stay', 'leave', 'never', 'forever', 'world', 'hold', 'free', 'lost', 'gold',
  'shine', 'fade', 'cold', 'deep', 'high', 'wild', 'kiss', 'touch', 'eyes', 'bleed',
  'alive', 'heaven', 'hell', 'insane', 'storm', 'shadow', 'truth', 'lie', 'tears',
  'desire', 'passion', 'rage', 'power', 'crazy', 'magic', 'forever', 'alone', 'fight',
]);

export interface ImportanceResult {
  score: number;       // 0..1
  scaleMultiplier: number; // 0.6x to 2.4x
  isEmphasis: boolean;
  styleType: 'fill' | 'outline';
  fontCategory: 'grotesque' | 'serif' | 'mono';
}

export function scoreWordImportance(
  word: string,
  duration: number,
  isLastInLine: boolean,
  isAfterPause: boolean,
  repetitionCount: number,
  seed = 0
): ImportanceResult {
  const clean = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const raw = word.trim();

  let score = 0.45;

  // 1. Stopword penalty
  if (STOPWORDS.has(clean)) {
    score -= 0.25;
  }

  // 2. Emotional/impactful content lexicon boost
  if (EMOTIONAL_LEXICON.has(clean)) {
    score += 0.35;
  }

  // 3. ALL CAPS boost (e.g. "STOP", "NEVER", "NOW")
  const isAllCaps = raw.length >= 2 && raw === raw.toUpperCase() && /[A-Z]/.test(raw);
  if (isAllCaps) {
    score += 0.25;
  }

  // 4. Word duration (long duration indicates sustained note / emphasis)
  if (duration > 0.65) {
    score += 0.28;
  } else if (duration > 0.4) {
    score += 0.15;
  } else if (duration < 0.18) {
    score -= 0.1;
  }

  // 5. Position: last word in a line or phrase
  if (isLastInLine) {
    score += 0.2;
  }

  // 6. Position: immediately after a musical pause
  if (isAfterPause) {
    score += 0.18;
  }

  // 7. Repetition in song / chorus
  if (repetitionCount > 1) {
    score += 0.15;
  }

  // Clamp to [0.05, 1.0]
  score = Math.max(0.05, Math.min(1.0, score));

  // Determine scale multiplier: 0.6x to 2.4x
  const scaleMultiplier = 0.6 + score * 1.8;

  // Emphasized word criteria
  const isEmphasis = score > 0.72 || isAllCaps;

  // Font category assignment based on importance and character
  let fontCategory: 'grotesque' | 'serif' | 'mono' = 'grotesque';
  if (score > 0.75) {
    // Top hero words: heavy grotesque or elegant italic serif
    fontCategory = (seed % 3 === 0) ? 'serif' : 'grotesque';
  } else if (score < 0.25) {
    fontCategory = (seed % 2 === 0) ? 'mono' : 'grotesque';
  }

  // Fill vs Outline styling (occasional outline for dramatic contrast on top words)
  const styleType: 'fill' | 'outline' = isEmphasis && (seed % 4 === 0) ? 'outline' : 'fill';

  return {
    score,
    scaleMultiplier,
    isEmphasis,
    styleType,
    fontCategory,
  };
}
