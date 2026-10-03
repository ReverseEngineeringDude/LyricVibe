import {
  KineticPhrase,
  WordItem,
  LayoutTemplate,
  TransitionType,
  WordPreset,
  FontCategory,
} from './types';
import { hashPhrase, createPRNG } from './prng';
import { scoreWordImportance } from './importance';
import { LyricLine } from '@/lib/lrcParser';

const TEMPLATES: LayoutTemplate[] = [
  'stacked-left',
  'centered-hero',
  'diagonal-cascade',
  'split',
  'single-word-fullscreen',
  'alternating-banner',
  'cyber-editorial',
  'vertical-stack',
];

const TRANSITIONS: TransitionType[] = [
  'scale-through',
  'whip-pan',
  'push',
  'cross-dissolve',
  'cut',
];

/**
 * Builds kinetic phrases with rich random typographies and continuous lifetimes
 * ensuring ultra-smooth transitions without stuck or empty gaps.
 */
export function buildKineticPhrases(
  words: { text: string; start: number; end: number; line: number }[],
  syncedLines: LyricLine[],
  videoId = 'default'
): KineticPhrase[] {
  let wordList = words;
  if (!wordList || wordList.length === 0) {
    wordList = estimateWordsFromLines(syncedLines);
  }

  if (wordList.length === 0) {
    return [];
  }

  // Count word repetitions across the song for importance boosting
  const repetitionMap = new Map<string, number>();
  for (const w of wordList) {
    const clean = w.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length > 2) {
      repetitionMap.set(clean, (repetitionMap.get(clean) || 0) + 1);
    }
  }

  const rawPhrases: {
    words: WordItem[];
    seed: number;
    template: LayoutTemplate;
    transitionType: TransitionType;
    heroWordIndex: number;
    earliestStart: number;
    latestEnd: number;
  }[] = [];

  let currentGroup: typeof wordList = [];
  let currentLine = -1;
  let phraseIdx = 0;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    const seed = hashPhrase(videoId, phraseIdx);
    const rng = createPRNG(seed);

    // Phrase-level typography theme
    const phraseCase = rng.choice(['uppercase', 'capitalize', 'none'] as const);
    const phraseFontTheme = rng.choice(['grotesque-heavy', 'editorial-serif', 'cyber-mix', 'dynamic-contrast'] as const);

    // Score importance & assign styling to each word
    const enrichedWords: WordItem[] = currentGroup.map((w, wIdx) => {
      const isLast = wIdx === currentGroup.length - 1;
      const prevWord = currentGroup[wIdx - 1];
      const isAfterPause = prevWord ? (w.start - prevWord.end > 0.35) : false;
      const clean = w.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      const repCount = repetitionMap.get(clean) || 0;

      const scored = scoreWordImportance(
        w.text,
        w.end - w.start,
        isLast,
        isAfterPause,
        repCount,
        seed + wIdx
      );

      // Select preset based on importance and seed
      let preset: WordPreset;
      if (scored.isEmphasis) {
        preset = rng.choice(['slam', 'pop', 'letter-stagger']);
      } else {
        preset = rng.choice(['pop', 'mask-rise', 'blur-in', 'track-in', 'letter-stagger']);
      }

      // Varied font category pairing based on phrase theme
      let fontCategory: FontCategory = scored.fontCategory;
      if (phraseFontTheme === 'editorial-serif') {
        fontCategory = wIdx % 2 === 0 ? 'serif' : 'grotesque';
      } else if (phraseFontTheme === 'cyber-mix') {
        fontCategory = wIdx % 2 === 1 ? 'mono' : 'grotesque';
      } else if (phraseFontTheme === 'grotesque-heavy') {
        fontCategory = 'grotesque';
      } else {
        fontCategory = scored.isEmphasis ? 'grotesque' : (rng.boolean(0.5) ? 'serif' : 'mono');
      }

      // Random style mix: fill vs stroke outline
      let styleType: 'fill' | 'outline' = scored.styleType;
      if (!scored.isEmphasis && rng.boolean(0.25)) {
        styleType = 'outline';
      }

      return {
        text: w.text,
        start: w.start,
        end: w.end,
        line: w.line,
        importance: scored.score,
        fontCategory,
        styleType,
        isEmphasis: scored.isEmphasis,
        preset,
        colorIndex: (phraseIdx * 2 + wIdx) % 4,
        textTransform: phraseCase,
      };
    });

    // Select layout template based on phrase length and seeded random choice
    let template: LayoutTemplate = 'stacked-left';
    const count = enrichedWords.length;

    if (count === 1 && enrichedWords[0].text.length <= 14) {
      template = 'single-word-fullscreen';
    } else if (count === 2) {
      template = rng.choice(['split', 'alternating-banner', 'centered-hero']);
    } else if (count <= 4) {
      template = rng.choice([
        'centered-hero',
        'alternating-banner',
        'diagonal-cascade',
        'cyber-editorial',
        'vertical-stack',
      ]);
    } else if (count <= 6) {
      template = rng.choice([
        'diagonal-cascade',
        'stacked-left',
        'cyber-editorial',
        'centered-hero',
        'vertical-stack',
      ]);
    } else {
      template = rng.choice(['stacked-left', 'cyber-editorial', 'diagonal-cascade']);
    }

    // Hero word index (highest importance)
    let heroWordIndex = 0;
    let maxImp = -1;
    enrichedWords.forEach((w, idx) => {
      if (w.importance > maxImp) {
        maxImp = w.importance;
        heroWordIndex = idx;
      }
    });

    const earliestStart = enrichedWords[0].start;
    const latestEnd = enrichedWords[enrichedWords.length - 1].end;
    const transitionType = rng.choice(TRANSITIONS);

    rawPhrases.push({
      words: enrichedWords,
      seed,
      template,
      transitionType,
      heroWordIndex,
      earliestStart,
      latestEnd,
    });

    phraseIdx++;
    currentGroup = [];
  };

  // Group words into phrases: break on line break or pauses > 0.45s or length > 8 words
  for (let i = 0; i < wordList.length; i++) {
    const w = wordList[i];
    const prevW = wordList[i - 1];

    const isLineBreak = currentLine !== -1 && w.line !== currentLine;
    const isPause = prevW && (w.start - prevW.end > 0.65);
    const isTooLong = currentGroup.length >= 12;
    const charsInGroup = currentGroup.reduce((sum, item) => sum + item.text.length, 0) + w.text.length;
    const isCharsExceeded = charsInGroup > 55;

    if (currentGroup.length > 0 && (isLineBreak || isPause || isTooLong || isCharsExceeded)) {
      flushGroup();
    }

    currentGroup.push(w);
    currentLine = w.line;
  }

  flushGroup();

  if (rawPhrases.length === 0) return [];

  // Second pass: compute phrase start & end with continuous lifetimes
  // Words remain visible and bridge directly into next phrase for 100% smooth transitions!
  const finalPhrases: KineticPhrase[] = [];

  for (let i = 0; i < rawPhrases.length; i++) {
    const raw = rawPhrases[i];
    const nextRaw = rawPhrases[i + 1] || null;

    const phraseStart = Math.max(0, raw.earliestStart - 0.12);
    let phraseEnd: number;

    if (nextRaw) {
      const gap = nextRaw.earliestStart - raw.latestEnd;
      if (gap <= 4.0) {
        // Continuous bridge: holds and overlaps smoothly until the next phrase begins!
        phraseEnd = nextRaw.earliestStart + 0.35;
      } else {
        // Genuine long pause/solo: linger for 2.2s then fade
        phraseEnd = raw.latestEnd + 2.2;
      }
    } else {
      phraseEnd = raw.latestEnd + 3.0;
    }

    finalPhrases.push({
      index: i,
      words: raw.words,
      start: phraseStart,
      end: phraseEnd,
      seed: raw.seed,
      template: raw.template,
      transitionType: raw.transitionType,
      heroWordIndex: raw.heroWordIndex,
    });
  }

  return finalPhrases;
}

/**
 * On-the-fly syllable and character estimation when backend words are not yet fetched.
 */
function estimateWordsFromLines(
  syncedLines: LyricLine[]
): { text: string; start: number; end: number; line: number }[] {
  const result: { text: string; start: number; end: number; line: number }[] = [];

  for (let lIdx = 0; lIdx < syncedLines.length; lIdx++) {
    const line = syncedLines[lIdx];
    if (line.isInstrumental || !line.text.trim()) continue;

    const words = line.text.trim().split(/\s+/);
    if (words.length === 0) continue;

    const nextLine = syncedLines[lIdx + 1];
    const nextStart = nextLine ? nextLine.time : line.time + 4.0;
    const lineDuration = Math.max(0.8, Math.min(nextStart - line.time, 7.0));
    const activeDuration = Math.max(0.5, lineDuration - 0.2);

    const weights = words.map((w) => {
      const vowels = (w.match(/[aeiouy]/gi) || []).length || 1;
      return 0.6 * vowels + 0.4 * (w.length / 3.0);
    });
    const totalW = weights.reduce((a, b) => a + b, 0) || 1;

    let curTime = line.time;
    words.forEach((w, wIdx) => {
      const dur = Math.max(0.12, (weights[wIdx] / totalW) * activeDuration);
      result.push({
        text: w,
        start: curTime,
        end: curTime + dur,
        line: lIdx,
      });
      curTime += dur + 0.02;
    });
  }

  return result;
}
