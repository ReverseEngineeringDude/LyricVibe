import React, { useState } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { searchLyrics, getLyrics, LyricCandidate } from '@/lib/api';
import { parseLrc } from '@/lib/lrcParser';
import { X, Search, Check, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

export const LyricPicker: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.isLyricPickerOpen);
  const toggleLyricPicker = useSettingsStore((s) => s.toggleLyricPicker);
  const candidates = useSettingsStore((s) => s.candidates);
  const setLyricsData = useSettingsStore((s) => s.setLyricsData);

  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LyricCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchLyrics(searchQuery);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const applyCandidate = async (candidate: LyricCandidate) => {
    setActiveCandidateId(candidate.id);
    try {
      // If syncedLyrics are already included in candidate object
      if (candidate.syncedLyrics) {
        const parsed = parseLrc(candidate.syncedLyrics);
        setLyricsData({
          syncedLines: parsed.lines,
          plainLyrics: candidate.plainLyrics || null,
          isInstrumental: Boolean(candidate.instrumental),
          candidates: candidates,
        });
        toggleLyricPicker(false);
        return;
      }

      // Otherwise fetch via getLyrics
      const data = await getLyrics(candidate.trackName, candidate.artistName, candidate.duration);
      if (data.syncedLyrics) {
        const parsed = parseLrc(data.syncedLyrics);
        setLyricsData({
          syncedLines: parsed.lines,
          plainLyrics: data.plainLyrics,
          isInstrumental: data.instrumental,
          candidates: candidates,
        });
      } else if (data.plainLyrics) {
        const parsed = parseLrc(data.plainLyrics);
        setLyricsData({
          syncedLines: parsed.lines,
          plainLyrics: data.plainLyrics,
          isInstrumental: data.instrumental,
          candidates: candidates,
        });
      }
      toggleLyricPicker(false);
    } catch (err) {
      console.error(err);
    }
  };

  const listToShow = searchResults.length > 0 ? searchResults : candidates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-surface border border-surfaceBorder rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-surfaceBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Choose Lyrics Match</h3>
              <p className="text-xs text-gray-400">Select alternate lyrics or search lrclib</p>
            </div>
          </div>
          <button
            onClick={() => toggleLyricPicker(false)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Manual search input */}
        <div className="p-4 border-b border-surfaceBorder bg-surfaceLight/30">
          <form onSubmit={handleManualSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search lyrics for "${currentTrack?.track || 'current track'}"...`}
              className="w-full bg-surfaceLight border border-surfaceBorder rounded-xl pl-9 pr-20 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 top-1 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {/* Matches list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {listToShow.length === 0 ? (
            <div className="py-8 text-center text-gray-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-gray-500" />
              <p className="text-xs">No alternate candidates found.</p>
              <p className="text-[11px] text-gray-500">
                Use the search box above to find matching lyrics on lrclib.net.
              </p>
            </div>
          ) : (
            listToShow.map((item) => (
              <div
                key={item.id}
                onClick={() => applyCandidate(item)}
                className="flex items-center justify-between p-3 rounded-xl border border-surfaceBorder/60 bg-surfaceLight/30 hover:bg-surfaceLight/80 hover:border-brand-500/50 cursor-pointer transition-all group"
              >
                <div className="min-w-0 flex-1 mr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white truncate">{item.trackName}</span>
                    {item.hasSynced && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Synced
                      </span>
                    )}
                    {item.instrumental && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Instrumental
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                    {item.artistName} {item.albumName ? `• ${item.albumName}` : ''}
                    {item.duration ? ` • ${Math.floor(item.duration / 60)}:${Math.floor(item.duration % 60).toString().padStart(2, '0')}` : ''}
                  </div>
                </div>

                <div className="w-6 h-6 rounded-full border border-surfaceBorder flex items-center justify-center group-hover:border-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                  {activeCandidateId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
