import React from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Zap, X, Sliders } from 'lucide-react';

interface KineticOverlayProps {
  visible?: boolean;
}

export const KineticOverlay: React.FC<KineticOverlayProps> = ({ visible = true }) => {
  const isKineticMode = useSettingsStore((s) => s.isKineticMode);
  const toggleKineticMode = useSettingsStore((s) => s.toggleKineticMode);
  const visualOptions = useSettingsStore((s) => s.visualOptions);
  const setVisualOptions = useSettingsStore((s) => s.setVisualOptions);

  if (!isKineticMode) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between overflow-hidden">
      {/* Extension-Style Floating Control Pill at top */}
      <div
        className={`pt-3 px-3 sm:px-4 flex justify-between items-center transition-all duration-500 ${
          visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Animated Mode Badge */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-black/70 backdrop-blur-xl border border-amber-500/40 shadow-lg shadow-amber-500/10 text-[11px] sm:text-xs font-semibold text-amber-300 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="tracking-wide">KINETIC MODE</span>
          </div>

          {/* Intensity selector pill - visible on mobile and desktop */}
          <div className="flex items-center bg-black/60 backdrop-blur-md p-0.5 rounded-full border border-white/10 text-[10px] sm:text-[11px]">
            {(['calm', 'balanced', 'wild'] as const).map((intensity) => (
              <button
                key={intensity}
                onClick={() => setVisualOptions({ kineticIntensity: intensity })}
                className={`px-2 sm:px-2.5 py-0.5 rounded-full transition-all font-medium capitalize ${
                  (visualOptions.kineticIntensity || 'balanced') === intensity
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {intensity}
              </button>
            ))}
          </div>

          {/* Quick Highlight Color Switcher */}
          <div
            className="hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px]"
            title="Lyric Highlight Accent"
          >
            <span className="text-[10px] text-gray-400 font-medium pl-0.5">Accent:</span>
            {[
              { id: '#00f0ff', color: '#00f0ff', label: 'Cyan (Colorblind Safe)' },
              { id: '#ffd600', color: '#ffd600', label: 'Gold' },
              { id: '#ff2e93', color: '#ff2e93', label: 'Pink' },
              { id: '#00ff88', color: '#00ff88', label: 'Mint' },
              { id: '#a855f7', color: '#a855f7', label: 'Purple' },
            ].map((hl) => {
              const currentHl = visualOptions.kineticHighlightColor || '#00f0ff';
              const isSelected = currentHl === hl.id;
              return (
                <button
                  key={hl.id}
                  onClick={() => setVisualOptions({ kineticHighlightColor: hl.id })}
                  title={hl.label}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    isSelected
                      ? 'scale-125 ring-2 ring-white shadow-sm'
                      : 'opacity-60 hover:opacity-100 hover:scale-110'
                  }`}
                  style={{ backgroundColor: hl.color }}
                />
              );
            })}
          </div>
        </div>

        {/* Exit Button */}
        <button
          onClick={() => toggleKineticMode(false)}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white transition-all shadow-md group shrink-0"
          title="Exit Kinetic Mode (Esc or K)"
        >
          <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
};
