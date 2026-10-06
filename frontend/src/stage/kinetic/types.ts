export type FontCategory = 'grotesque' | 'serif' | 'mono';

export type WordPreset =
  | 'pop'
  | 'mask-rise'
  | 'blur-in'
  | 'letter-stagger'
  | 'slam'
  | 'track-in';

export type LayoutTemplate =
  | 'stacked-left'
  | 'centered-hero'
  | 'diagonal-cascade'
  | 'split'
  | 'single-word-fullscreen'
  | 'alternating-banner'
  | 'cyber-editorial'
  | 'vertical-stack';

export type TransitionType = 'scale-through' | 'whip-pan' | 'push' | 'cut' | 'cross-dissolve';

export interface WordItem {
  text: string;
  start: number;
  end: number;
  line: number;
  importance: number; // 0..1
  fontCategory: FontCategory;
  styleType: 'fill' | 'outline';
  isEmphasis: boolean;
  preset: WordPreset;
  colorIndex: number;
  textTransform?: 'uppercase' | 'none' | 'capitalize';
}

export interface WordLayoutBox {
  word: WordItem;
  x: number; // relative to phrase center
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontFamily: string;
  graphemes: string[];
  isSafeToSplit: boolean;
  clipY?: number;
  rotation?: number; // baseline template rotation
}

export interface PhraseLayout {
  width: number;
  height: number;
  wordBoxes: WordLayoutBox[];
}

export interface KineticPhrase {
  index: number;
  words: WordItem[];
  start: number; // phrase start (earliest word.start - 0.08s)
  end: number;   // phrase end (latest word.end + 0.22s)
  seed: number;
  template: LayoutTemplate;
  transitionType: TransitionType;
  heroWordIndex: number;
}

export interface AudioAnalysisData {
  video_id: string;
  status: string;
  tempo: number;
  beats: number[];
  downbeats: number[];
  energy: { t: number; v: number }[];
  words: { text: string; start: number; end: number; line: number }[];
}

export interface KineticOptions {
  intensity: 'calm' | 'balanced' | 'wild';
  cameraMovement: boolean;
  beatReactions: boolean;
  backgroundType: 'mesh' | 'cover' | 'custom' | 'solid' | 'gradient';
  fontSet: 'modern' | 'classic' | 'cyber';
  customFont?: string;
}
