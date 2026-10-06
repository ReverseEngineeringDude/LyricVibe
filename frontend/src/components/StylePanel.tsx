import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useSettingsStore, TextAlign, BackgroundStyle } from '@/store/useSettingsStore';
import {
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  Sparkles,
  Layers,
  Sliders,
  ExternalLink,
  Zap,
  Upload,
  Trash2,
  Image as ImageIcon,
  Eye,
  Check,
  Plus,
} from 'lucide-react';
import { OffsetControl } from './OffsetControl';
import {
  CustomFont,
  fetchAllAvailableFonts,
  loadAndRegisterFont,
  registerUploadedFontFile,
  LANGUAGE_INFO,
} from '@/lib/fontManager';

const KINETIC_HIGHLIGHTS = [
  { id: '#00f0ff', label: 'Cyan', color: '#00f0ff', safeBadge: 'Colorblind Safe' },
  { id: '#ffd600', label: 'Gold', color: '#ffd600' },
  { id: '#ff2e93', label: 'Pink', color: '#ff2e93' },
  { id: '#00ff88', label: 'Mint', color: '#00ff88' },
  { id: '#a855f7', label: 'Purple', color: '#a855f7' },
  { id: 'dynamic', label: 'Dynamic', color: 'dynamic' },
];

export const StylePanel: React.FC = () => {
  const visualOptions = useSettingsStore((s) => s.visualOptions);
  const setVisualOptions = useSettingsStore((s) => s.setVisualOptions);
  const setCustomBgImage = useSettingsStore((s) => s.setCustomBgImage);
  const toggleLyricPicker = useSettingsStore((s) => s.toggleLyricPicker);
  const candidates = useSettingsStore((s) => s.candidates);
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const toggleKineticMode = useSettingsStore((s) => s.toggleKineticMode);
  const kineticStyle = useSettingsStore((s) => s.kineticStyle);
  const setKineticStyle = useSettingsStore((s) => s.setKineticStyle);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);

  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('all');
  const [isFontLoading, setIsFontLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    fetchAllAvailableFonts().then((fonts) => {
      if (!mounted) return;
      setCustomFonts(fonts);
      // Pre-register fonts in document.fonts
      fonts.forEach((f) => loadAndRegisterFont(f));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectFont = async (fontFamily: string, customFontObj?: CustomFont) => {
    if (customFontObj) {
      setIsFontLoading(true);
      await loadAndRegisterFont(customFontObj);
      setIsFontLoading(false);
    }
    setVisualOptions({ font: fontFamily });
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsFontLoading(true);
      const added = await registerUploadedFontFile(file);
      setCustomFonts((prev) => [added, ...prev.filter((f) => f.family !== added.family)]);
      setVisualOptions({ font: added.family });
    } catch (err) {
      alert('Failed to load font file: ' + (err as Error).message);
    } finally {
      setIsFontLoading(false);
    }
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndSetImage(file);
    e.target.value = '';
  };

  const processAndSetImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setCustomBgImage(compressed);
        } else {
          setCustomBgImage(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const standardFonts = [
    { id: 'Syne', label: 'Syne', class: 'font-syne', langCode: 'EN', sample: 'Modern Display' },
    { id: 'Playfair Display', label: 'Playfair', class: 'font-serif', langCode: 'EN', sample: 'Classic Serif' },
    { id: 'Inter', label: 'Inter', class: 'font-sans', langCode: 'EN', sample: 'Clean Sans' },
  ];

  const availableLanguages = useMemo(() => {
    const langs = new Map<string, string>();
    langs.set('all', 'All');

    const codes = new Set<string>();
    customFonts.forEach((f) => {
      if (f.langCode) codes.add(f.langCode);
    });

    const sortedCodes = Array.from(codes).sort((a, b) => {
      if (a === 'ML') return -1;
      if (b === 'ML') return 1;
      if (a === 'EN') return -1;
      if (b === 'EN') return 1;
      return a.localeCompare(b);
    });

    sortedCodes.forEach((code) => {
      const info = LANGUAGE_INFO[code];
      const label = info ? `${info.native} (${code})` : code;
      langs.set(code, label);
    });

    return Array.from(langs.entries());
  }, [customFonts]);

  const displayedStandard = selectedLang === 'all' || selectedLang === 'EN' ? standardFonts : [];
  const displayedCustom = customFonts.filter((f) => {
    if (selectedLang === 'all') return true;
    return f.langCode === selectedLang;
  });

  return (
    <div className="bg-surface/90 backdrop-blur-md rounded-2xl border border-surfaceBorder p-4 space-y-4 text-xs text-gray-300 shadow-xl">
      <div className="flex items-center justify-between border-b border-surfaceBorder/60 pb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-brand-400" />
          <h3 className="font-semibold text-white">Visual Customization</h3>
        </div>
        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
          isKineticMode
            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            : 'text-brand-400 bg-brand-500/10 border-brand-500/20'
        }`}>
          {isKineticMode ? 'Kinetic Mode' : 'Aesthetic Mood'}
        </span>
      </div>

      {/* Kinetic Mode Section */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-brand-500/10 border border-amber-500/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <Zap className={`w-3.5 h-3.5 ${isKineticMode ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
            <span>Kinetic Typography</span>
          </div>
          <button
            onClick={() => toggleKineticMode()}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              isKineticMode
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-surfaceLight/80 text-gray-300 hover:text-white border border-surfaceBorder'
            }`}
          >
            {isKineticMode ? 'ACTIVE' : 'ENABLE'}
          </button>
        </div>

        {isKineticMode && (
          <div className="space-y-2.5 pt-2 border-t border-amber-500/20 animate-fade-in text-[10px]">
            {/* Intensity */}
            <div>
              <span className="text-gray-400 font-medium block mb-1">Motion Intensity</span>
              <div className="grid grid-cols-3 gap-1">
                {(['calm', 'balanced', 'wild'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setVisualOptions({ kineticIntensity: lvl })}
                    className={`py-1 rounded-lg border text-center font-medium capitalize transition-all ${
                      (visualOptions.kineticIntensity || 'balanced') === lvl
                        ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-sm'
                        : 'bg-black/30 border-white/10 text-gray-300 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() =>
                  setVisualOptions({ kineticCamera: !(visualOptions.kineticCamera !== false) })
                }
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-between transition-all ${
                  visualOptions.kineticCamera !== false
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-black/30 border-white/10 text-gray-400'
                }`}
              >
                <span>Virtual Camera</span>
                <span className="font-bold">{visualOptions.kineticCamera !== false ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() =>
                  setVisualOptions({ kineticBeats: !(visualOptions.kineticBeats !== false) })
                }
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-between transition-all ${
                  visualOptions.kineticBeats !== false
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-black/30 border-white/10 text-gray-400'
                }`}
              >
                <span>Beat Punches</span>
                <span className="font-bold">{visualOptions.kineticBeats !== false ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Lyric Highlight Color Accent (Accessible / Colorblind-Safe) */}
            <div className="pt-1.5 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-gray-300 font-medium flex items-center gap-1.5 text-[10px]">
                  <Palette className="w-3 h-3 text-cyan-400" />
                  Highlight Color Accent
                </span>
                <span className="text-[9px] text-cyan-400/90 font-mono flex items-center gap-0.5 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                  <Eye className="w-2.5 h-2.5" />
                  Colorblind Optimized
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {KINETIC_HIGHLIGHTS.map((hl) => {
                  const currentHl = visualOptions.kineticHighlightColor || '#00f0ff';
                  const isSelected = currentHl === hl.id;
                  return (
                    <button
                      key={hl.id}
                      onClick={() => setVisualOptions({ kineticHighlightColor: hl.id })}
                      title={`${hl.label} ${hl.safeBadge ? `• ${hl.safeBadge}` : ''}`}
                      className={`h-7 rounded-lg border flex flex-col items-center justify-center relative transition-all ${
                        isSelected
                          ? 'border-white ring-2 ring-cyan-400/50 scale-105 bg-white/10'
                          : 'border-white/10 hover:border-white/30 bg-black/20'
                      }`}
                    >
                      {hl.id === 'dynamic' ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 shadow-sm" />
                      ) : (
                        <span
                          className="w-3.5 h-3.5 rounded-full shadow-sm"
                          style={{ backgroundColor: hl.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-gray-400 mt-1.5 leading-tight">
                Electric Cyan is tuned for universal high contrast across red-green and blue-yellow vision deficiencies.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Typography selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-gray-400 text-[11px] font-medium flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-brand-400" />
            <span>Lyric Typography</span>
            {isFontLoading && (
              <span className="text-[10px] text-brand-400 animate-pulse font-normal">Loading font...</span>
            )}
          </label>

          <button
            onClick={() => fontFileInputRef.current?.click()}
            className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-500/10 border border-brand-500/20 hover:border-brand-500/40 transition-colors"
            title="Upload any TTF / OTF font (e.g. ML_*.ttf for Malayalam)"
          >
            <Plus className="w-3 h-3" />
            <span>Add Font (.ttf)</span>
          </button>
          <input
            ref={fontFileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={handleFontUpload}
          />
        </div>

        {/* Language filter pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
          {availableLanguages.map(([code, label]) => (
            <button
              key={code}
              onClick={() => setSelectedLang(code)}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${
                selectedLang === code
                  ? 'bg-brand-500 text-white font-medium shadow-sm'
                  : 'bg-surfaceLight/50 text-gray-400 hover:text-white border border-surfaceBorder/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Font cards grid */}
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
          {displayedStandard.map((f) => {
            const isSelected = visualOptions.font === f.id;
            return (
              <button
                key={f.id}
                onClick={() => handleSelectFont(f.id)}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-brand-500/20 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/40'
                    : 'bg-surfaceLight/40 border-surfaceBorder hover:bg-surfaceLight hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold truncate ${f.class || ''}`}>{f.label}</span>
                  <span className="text-[9px] px-1 rounded bg-black/40 text-gray-400 font-mono">EN</span>
                </div>
                <span className="block text-[10px] text-gray-400 truncate mt-0.5">{f.sample}</span>
              </button>
            );
          })}

          {displayedCustom.map((f) => {
            const isSelected = visualOptions.font === f.family;
            const scriptSample =
              f.langCode === 'ML'
                ? 'മലയാളം ലിപി'
                : f.langCode === 'TA'
                ? 'தமிழ் பாடல்'
                : f.langCode === 'HI'
                ? 'हिन्दी धुन'
                : f.nativeName || f.name;

            return (
              <button
                key={f.family}
                onClick={() => handleSelectFont(f.family, f)}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-brand-500/20 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/40'
                    : 'bg-surfaceLight/40 border-surfaceBorder hover:bg-surfaceLight hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold truncate"
                    style={{ fontFamily: `"${f.family}", sans-serif` }}
                  >
                    {f.name}
                  </span>
                  <span
                    className={`text-[9px] px-1 rounded font-mono font-medium ${
                      f.langCode === 'ML'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-black/40 text-gray-400'
                    }`}
                  >
                    {f.langCode}
                  </span>
                </div>
                <span
                  className="block text-[10px] text-gray-400 truncate mt-0.5"
                  style={{ fontFamily: `"${f.family}", sans-serif` }}
                >
                  {scriptSample}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-gray-400 leading-tight">
          Fonts in <code className="text-gray-300">fonts/</code> folder (e.g. <code className="text-gray-300">ML_*.ttf</code>) are auto-detected and rendered with genuine native glyphs.
        </p>
      </div>

      {/* Alignment & Background mode */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-gray-400 text-[11px] font-medium flex items-center gap-1.5">
            <AlignCenter className="w-3.5 h-3.5" />
            Alignment
          </label>
          <div className="flex bg-surfaceLight/60 p-1 rounded-xl border border-surfaceBorder">
            <button
              onClick={() => setVisualOptions({ alignment: 'center' })}
              className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all ${
                visualOptions.alignment === 'center'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setVisualOptions({ alignment: 'left' })}
              className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all ${
                visualOptions.alignment === 'left'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-gray-400 text-[11px] font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Backdrop
          </label>
          <div className="flex bg-surfaceLight/60 p-1 rounded-xl border border-surfaceBorder text-[11px]">
            <button
              onClick={() => setVisualOptions({ backgroundStyle: 'mesh' })}
              className={`flex-1 py-1 rounded-lg transition-all ${
                visualOptions.backgroundStyle === 'mesh'
                  ? 'bg-brand-500 text-white font-medium shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Mesh
            </button>
            <button
              onClick={() => setVisualOptions({ backgroundStyle: 'cover' })}
              className={`flex-1 py-1 rounded-lg transition-all ${
                visualOptions.backgroundStyle === 'cover'
                  ? 'bg-brand-500 text-white font-medium shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Cover
            </button>
            <button
              onClick={() => {
                if (visualOptions.customBgUrl) {
                  setVisualOptions({ backgroundStyle: 'custom' });
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className={`flex-1 py-1 rounded-lg transition-all ${
                visualOptions.backgroundStyle === 'custom'
                  ? 'bg-brand-500 text-white font-medium shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file picker for custom wallpaper */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Custom Background Management Card */}
      {visualOptions.customBgUrl ? (
        <div className="p-2.5 rounded-xl bg-surfaceLight/50 border border-surfaceBorder/80 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-black/40">
              <img
                src={visualOptions.customBgUrl}
                alt="Custom background preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-white block truncate">Custom Image</span>
              <span className="text-[10px] text-gray-400 block truncate">
                {visualOptions.backgroundStyle === 'custom' ? 'Active Wallpaper' : 'Ready to use'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded-lg bg-surfaceLight hover:bg-surfaceLight/80 text-[10px] font-medium text-gray-200 border border-surfaceBorder hover:text-white transition-colors"
              title="Upload different image"
            >
              Change
            </button>
            <button
              onClick={() => setCustomBgImage(null)}
              className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
              title="Remove custom wallpaper"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        visualOptions.backgroundStyle === 'custom' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-brand-500/50 hover:border-brand-400 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 hover:text-white flex items-center justify-center gap-2 transition-all group"
          >
            <Upload className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium">Select Image for Custom Background</span>
          </button>
        )
      )}

      {/* Toggles: Film Grain & Watermark */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-surfaceLight/40 border border-surfaceBorder hover:bg-surfaceLight/70 transition-colors">
          <input
            type="checkbox"
            checked={visualOptions.grain}
            onChange={(e) => setVisualOptions({ grain: e.target.checked })}
            className="rounded bg-surfaceBorder text-brand-500 focus:ring-brand-500/20"
          />
          <span className="text-[11px] text-gray-300">Film Grain</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-surfaceLight/40 border border-surfaceBorder hover:bg-surfaceLight/70 transition-colors">
          <input
            type="checkbox"
            checked={visualOptions.watermark}
            onChange={(e) => setVisualOptions({ watermark: e.target.checked })}
            className="rounded bg-surfaceBorder text-brand-500 focus:ring-brand-500/20"
          />
          <span className="text-[11px] text-gray-300">Watermark</span>
        </label>
      </div>


      {/* Sync Offset in Style Panel for Mobile / Tablet */}
      <div className="space-y-1.5 lg:hidden">
        <label className="text-gray-400 text-[11px] font-medium flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" />
          Sync Timing Offset
        </label>
        <OffsetControl />
      </div>

      {/* Lyric Picker Trigger Button */}
      <div className="pt-2 border-t border-surfaceBorder/60">
        <button
          onClick={() => toggleLyricPicker(true)}
          className="w-full py-2 px-3 rounded-xl border border-surfaceBorder hover:border-brand-500/50 bg-surfaceLight/40 hover:bg-surfaceLight text-xs font-medium text-gray-200 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Switch Lyric Match</span>
          </div>
          <span className="text-[11px] text-brand-400 flex items-center gap-1">
            {candidates.length > 0 ? `${candidates.length} options` : 'Search'}
            <ExternalLink className="w-3 h-3" />
          </span>
        </button>
      </div>
    </div>
  );
};
