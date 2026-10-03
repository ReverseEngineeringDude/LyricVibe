export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  isDark: boolean;
}

const DEFAULT_PALETTE: ColorPalette = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  background: '#0d0e15',
  isDark: true,
};

/**
 * Parses any color format (hex, rgb, rgba) and returns a clean rgba(r, g, b, alpha) string.
 */
export function colorWithAlpha(color: string, alpha: number): string {
  if (!color) return `rgba(59, 130, 246, ${alpha})`;

  // If already rgba(r, g, b, a)
  const rgbaMatch = color.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/i);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
  }

  // If rgb(r, g, b)
  const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }

  // If hex: #rrggbb or #rgb
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) || 0;
      const g = parseInt(hex.slice(2, 4), 16) || 0;
      const b = parseInt(hex.slice(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return color;
}

/**
 * Extracts dominant colors from an image URL using an offscreen canvas downsampler.
 * Fully cross-origin safe with fallback to vibrant defaults.
 */
export async function extractPaletteFromImage(imageUrl: string): Promise<ColorPalette> {
  if (!imageUrl) return DEFAULT_PALETTE;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        // Downsample to 40x40 for fast pixel analysis
        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imgData = ctx.getImageData(0, 0, 40, 40).data;
        const colorCounts: { [key: string]: { r: number; g: number; b: number; count: number } } = {};

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip transparent or near-black/near-white extremes for primary accents
          if (a < 128) continue;
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness < 20 || brightness > 240) continue;

          // Bucket to 16-step quantization
          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;
          const key = `${qr},${qg},${qb}`;

          if (!colorCounts[key]) {
            colorCounts[key] = { r: qr, g: qg, b: qb, count: 0 };
          }
          colorCounts[key].count++;
        }

        const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);

        if (sorted.length < 2) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        const c1 = sorted[0];
        const c2 = sorted[1] || sorted[0];
        const c3 = sorted[2] || sorted[1] || sorted[0];

        const primary = `rgb(${c1.r}, ${c1.g}, ${c1.b})`;
        const secondary = `rgb(${c2.r}, ${c2.g}, ${c2.b})`;
        const accent = `rgb(${c3.r}, ${c3.g}, ${c3.b})`;
        const background = `rgb(${Math.round(c1.r * 0.15)}, ${Math.round(c1.g * 0.15)}, ${Math.round(c1.b * 0.18)})`;

        resolve({
          primary,
          secondary,
          accent,
          background,
          isDark: true,
        });
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_PALETTE);
    };

    img.src = imageUrl;
  });
}
