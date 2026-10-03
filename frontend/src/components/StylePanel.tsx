import React from 'react';
import { useSettingsStore, FontChoice, TextAlign, BackgroundStyle } from '@/store/useSettingsStore';
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
} from 'lucide-react';
import { OffsetControl } from './OffsetControl';

export const StylePanel: React.FC = () => {
  const visualOptions = useSettingsStore((s) => s.visualOptions);
  const setVisualOptions = useSettingsStore((s) => s.setVisualOptions);
  const toggleLyricPicker = useSettingsStore((s) => s.toggleLyricPicker);
  const candidates = useSettingsStore((s) => s.candidates);
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const toggleKineticMode = useSettingsStore((s) => s.toggleKineticMode);
  const kineticStyle = useSettingsStore((s) => s.kineticStyle);
  const setKineticStyle = useSettingsStore((s) => s.setKineticStyle);

  const fonts: { id: FontChoice; label: string; class: string }[] = [
    { id: 'Syne', label: 'Syne Bold', class: 'font-syne' },
    { id: 'Playfair Display', label: 'Playfair Serif', class: 'font-serif' },
    { id: 'Inter', label: 'Inter Modern', class: 'font-sans' },
  ];

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
          </div>
        )}
      </div>

      {/* Typography selection */}
      <div className="space-y-1.5">
        <label className="text-gray-400 text-[11px] font-medium flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" />
          Lyric Typography
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {fonts.map((f) => (
            <button
              key={f.id}
              onClick={() => setVisualOptions({ font: f.id })}
              className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                visualOptions.font === f.id
                  ? 'bg-brand-500/20 border-brand-500/50 text-white font-semibold'
                  : 'bg-surfaceLight/40 border-surfaceBorder hover:bg-surfaceLight hover:text-white'
              }`}
            >
              <span className={`block text-xs truncate ${f.class}`}>{f.label}</span>
            </button>
          ))}
        </div>
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
          </div>
        </div>
      </div>

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
