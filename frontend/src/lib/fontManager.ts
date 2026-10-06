/**
 * Comprehensive Font Management & Dynamic Font Registration
 * Supports discovering, loading, and applying language-prefixed fonts (e.g. ML_*.ttf for Malayalam).
 */

export interface CustomFont {
  filename: string;
  langCode: string; // e.g. "ML", "TA", "HI", "EN"
  name: string;     // Clean font title
  family: string;   // Font face family identifier (e.g. "ML_Manjari")
  url: string;      // Public URL to font file
  langName: string; // English language name (e.g. "Malayalam")
  nativeName?: string; // Native script name (e.g. "മലയാളം")
  isCustomUpload?: boolean;
}

export const LANGUAGE_INFO: Record<string, { name: string; native: string }> = {
  ML: { name: 'Malayalam', native: 'മലയാളം' },
  TA: { name: 'Tamil', native: 'தமிழ்' },
  TE: { name: 'Telugu', native: 'తెలుగు' },
  KN: { name: 'Kannada', native: 'ಕನ್ನಡ' },
  HI: { name: 'Hindi', native: 'हिन्दी' },
  BN: { name: 'Bengali', native: 'বাংলা' },
  MR: { name: 'Marathi', native: 'मराठी' },
  GU: { name: 'Gujarati', native: 'ગુજરાતી' },
  PA: { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  UR: { name: 'Urdu', native: 'اردو' },
  AR: { name: 'Arabic', native: 'العربية' },
  JA: { name: 'Japanese', native: '日本語' },
  KO: { name: 'Korean', native: '한국어' },
  ZH: { name: 'Chinese', native: '中文' },
  EN: { name: 'English', native: 'English' },
  DE: { name: 'German', native: 'Deutsch' },
  FR: { name: 'French', native: 'Français' },
  ES: { name: 'Spanish', native: 'Español' },
  RU: { name: 'Russian', native: 'Русский' },
};

export function parseFontFilename(filename: string, customUrl?: string): CustomFont {
  const parts = filename.split('_');
  const langCode = parts.length > 1 ? parts[0].toUpperCase() : 'OTHER';
  const rest = parts.length > 1 ? parts.slice(1).join('_') : filename;
  const cleanName = rest.replace(/\.(ttf|otf|woff2|woff)$/i, '').replace(/[-_]/g, ' ');
  const family = filename.replace(/\.(ttf|otf|woff2|woff)$/i, '');
  const langInfo = LANGUAGE_INFO[langCode] || { name: langCode, native: langCode };

  return {
    filename,
    langCode,
    name: cleanName,
    family,
    url: customUrl || `/fonts/${filename}`,
    langName: langInfo.name,
    nativeName: langInfo.native,
  };
}

// Built-in starter fonts available in the /fonts directory
export const BUNDLED_FONTS: CustomFont[] = [
  parseFontFilename('ML_Manjari.ttf'),
  parseFontFilename('ML_Gayathri.ttf'),
  parseFontFilename('ML_Chilanka.ttf'),
  parseFontFilename('TA_MuktaMalar.ttf'),
  parseFontFilename('HI_Kalam.ttf'),
  parseFontFilename('EN_BebasNeue.ttf'),
];

const loadedFontFamilies = new Set<string>();

/**
 * Loads and registers a font file dynamically in the browser using the FontFace API.
 */
export async function loadAndRegisterFont(font: CustomFont): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  if (loadedFontFamilies.has(font.family)) {
    return true;
  }

  try {
    // Check if browser document.fonts already has this font registered
    const existing = Array.from(document.fonts.values()).find((f) => f.family === font.family);
    if (existing && existing.status === 'loaded') {
      loadedFontFamilies.add(font.family);
      return true;
    }

    const fontFace = new FontFace(font.family, `url("${font.url}")`);
    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    loadedFontFamilies.add(font.family);
    return true;
  } catch (err) {
    console.warn(`Font load warning for ${font.family} from ${font.url}:`, err);
    return false;
  }
}

const STORAGE_KEY_USER_FONTS = 'lyricvibe_user_fonts';

function loadStoredUserFonts(): CustomFont[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_FONTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUserFonts(fonts: CustomFont[]) {
  try {
    localStorage.setItem(STORAGE_KEY_USER_FONTS, JSON.stringify(fonts));
  } catch {
    // quota limits
  }
}

/**
 * Fetches all available fonts from backend /api/fonts, merges with bundled fonts & user uploads.
 */
export async function fetchAllAvailableFonts(): Promise<CustomFont[]> {
  const fontMap = new Map<string, CustomFont>();

  // 1. Add bundled fonts
  for (const f of BUNDLED_FONTS) {
    fontMap.set(f.family, f);
  }

  // 2. Fetch dynamically from backend if reachable
  try {
    const res = await fetch('/api/fonts');
    if (res.ok) {
      const serverFonts = await res.json();
      if (Array.isArray(serverFonts)) {
        for (const item of serverFonts) {
          const parsed = parseFontFilename(item.filename, item.url);
          fontMap.set(parsed.family, parsed);
        }
      }
    }
  } catch {
    // Fall back to bundled fonts if offline or running static
  }

  // 3. Add stored user-uploaded fonts
  const userFonts = loadStoredUserFonts();
  for (const uf of userFonts) {
    fontMap.set(uf.family, uf);
  }

  return Array.from(fontMap.values());
}

/**
 * Registers an uploaded custom TTF/OTF font file and persists it in memory.
 */
export async function registerUploadedFontFile(file: File): Promise<CustomFont> {
  const filename = file.name;
  const parsed = parseFontFilename(filename);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const customFont: CustomFont = {
        ...parsed,
        url: dataUrl,
        isCustomUpload: true,
      };

      try {
        const success = await loadAndRegisterFont(customFont);
        if (success) {
          const userFonts = loadStoredUserFonts().filter((f) => f.family !== customFont.family);
          userFonts.push(customFont);
          saveStoredUserFonts(userFonts);
          resolve(customFont);
        } else {
          reject(new Error(`Failed to load font face ${customFont.family}`));
        }
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read font file'));
    reader.readAsDataURL(file);
  });
}
