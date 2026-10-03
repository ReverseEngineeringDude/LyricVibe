export interface LyricLine {
  time: number; // in seconds
  text: string;
  isInstrumental?: boolean;
}

export interface ParsedLrc {
  lines: LyricLine[];
  hasTimestamps: boolean;
  plainText: string;
}

const TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

/**
 * Parses raw LRC string into a sorted list of LyricLines.
 * Supports:
 * - [mm:ss.xx] and [mm:ss.xxx]
 * - [mm:ss]
 * - Multiple timestamps on a single line
 * - Automatically inserts instrumental gap markers for pauses > 8s
 */
export function parseLrc(lrcText: string): ParsedLrc {
  if (!lrcText || !lrcText.trim()) {
    return { lines: [], hasTimestamps: false, plainText: '' };
  }

  const rawLines = lrcText.split(/\r?\n/);
  const parsedLines: LyricLine[] = [];
  let foundTimestamps = false;
  const plainTextLines: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Reset regex state
    TIME_TAG_REGEX.lastIndex = 0;
    const matches = Array.from(trimmed.matchAll(TIME_TAG_REGEX));

    if (matches.length > 0) {
      foundTimestamps = true;
      const text = trimmed.replace(TIME_TAG_REGEX, '').trim();
      plainTextLines.push(text);

      for (const m of matches) {
        const mins = parseInt(m[1], 10);
        const secs = parseInt(m[2], 10);
        const millisStr = m[3] || '0';

        let millis = 0;
        if (millisStr.length === 1) millis = parseInt(millisStr, 10) * 100;
        else if (millisStr.length === 2) millis = parseInt(millisStr, 10) * 10;
        else millis = parseInt(millisStr.slice(0, 3), 10);

        const time = mins * 60 + secs + millis / 1000;
        parsedLines.push({
          time: Math.round(time * 100) / 100,
          text,
          isInstrumental: false,
        });
      }
    } else {
      // Lines without time tags
      plainTextLines.push(trimmed);
    }
  }

  if (!foundTimestamps) {
    return {
      lines: plainTextLines.map((text, i) => ({ time: i * 4, text, isInstrumental: false })),
      hasTimestamps: false,
      plainText: plainTextLines.join('\n'),
    };
  }

  // Sort lines chronologically
  parsedLines.sort((a, b) => a.time - b.time);

  // Insert instrumental gap markers if pause > 8s
  const finalLines: LyricLine[] = [];
  for (let i = 0; i < parsedLines.length; i++) {
    if (i > 0) {
      const prevTime = parsedLines[i - 1].time;
      const currTime = parsedLines[i].time;
      const gap = currTime - prevTime;

      if (gap > 8.0) {
        finalLines.push({
          time: Math.round((prevTime + 1.0) * 100) / 100,
          text: '• • •',
          isInstrumental: true,
        });
      }
    }
    finalLines.push(parsedLines[i]);
  }

  return {
    lines: finalLines,
    hasTimestamps: true,
    plainText: plainTextLines.join('\n'),
  };
}

/**
 * High-performance binary search to locate the active lyric line for the given time.
 * Avoids O(N) linear scans every animation frame.
 * @param lines Sorted list of lyric lines
 * @param currentTime Current audio time in seconds
 * @param offsetSec User manual offset in seconds (-5s to +5s)
 * @returns Index of active line, or -1 if before the first line
 */
export function findActiveLineIndex(
  lines: LyricLine[],
  currentTime: number,
  offsetSec: number = 0
): number {
  if (!lines || lines.length === 0) return -1;

  const targetTime = currentTime + offsetSec;

  if (targetTime < lines[0].time) {
    return -1;
  }

  let low = 0;
  let high = lines.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= targetTime) {
      activeIndex = mid;
      low = mid + 1; // search higher for closest start time <= targetTime
    } else {
      high = mid - 1;
    }
  }

  return activeIndex;
}

export function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
