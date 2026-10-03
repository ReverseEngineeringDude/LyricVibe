import React, { useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  ListMusic,
  History,
  Heart,
  Trash2,
  Play,
  X,
  ChevronUp,
  ChevronDown,
  Volume2,
} from 'lucide-react';
import { TrackMetadata } from '@/lib/api';

export const Queue: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.isQueueOpen);
  const toggleQueue = useSettingsStore((s) => s.toggleQueue);

  const queue = usePlayerStore((s) => s.queue);
  const history = usePlayerStore((s) => s.history);
  const favorites = usePlayerStore((s) => s.favorites);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'favorites'>('queue');

  if (!isOpen) return null;

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;
    const updated = [...queue];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    reorderQueue(updated);
  };

  const getList = (): TrackMetadata[] => {
    switch (activeTab) {
      case 'history':
        return history;
      case 'favorites':
        return favorites;
      default:
        return queue;
    }
  };

  const currentList = getList();

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-surface/95 backdrop-blur-xl border-l border-surfaceBorder shadow-2xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="p-4 border-b border-surfaceBorder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-brand-500" />
          <h2 className="font-semibold text-sm text-white">Playback Library</h2>
        </div>
        <button
          onClick={() => toggleQueue(false)}
          className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close queue"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surfaceBorder p-1.5 bg-surfaceLight/20 text-xs font-medium">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'queue' ? 'bg-surfaceLight text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          Up Next ({queue.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'history' ? 'bg-surfaceLight text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Recent ({history.length})
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'favorites' ? 'bg-surfaceLight text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          Favorites ({favorites.length})
        </button>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {currentList.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
            <p className="text-xs">
              {activeTab === 'queue'
                ? 'Your queue is empty.'
                : activeTab === 'history'
                ? 'No recently played tracks yet.'
                : 'No favorite songs added yet.'}
            </p>
          </div>
        ) : (
          currentList.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}-${idx}`}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-brand-500/10 border-brand-500/40 text-white'
                    : 'bg-surfaceLight/30 border-surfaceBorder/40 hover:bg-surfaceLight/60 hover:border-surfaceBorder'
                }`}
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => playTrack(track)}
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surfaceBorder">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-500/20 text-brand-400 text-xs">
                        ♪
                      </div>
                    )}

                    {isCurrent && isPlaying ? (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-0.5">
                        <span className="w-1 bg-brand-400 rounded-full animate-eqBar" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 bg-brand-400 rounded-full animate-eqBar" style={{ animationDelay: '200ms' }} />
                        <span className="w-1 bg-brand-400 rounded-full animate-eqBar" style={{ animationDelay: '400ms' }} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 fill-white text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-brand-400' : 'text-gray-200'}`}>
                      {track.track || track.title}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {track.artist || track.channel || 'Unknown Artist'}
                    </p>
                  </div>
                </div>

                {/* Queue controls */}
                {activeTab === 'queue' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === queue.length - 1}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="p-1 text-gray-400 hover:text-red-400"
                      title="Remove from queue"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer action */}
      {activeTab === 'queue' && queue.length > 0 && (
        <div className="p-3 border-t border-surfaceBorder/80 bg-surface">
          <button
            onClick={clearQueue}
            className="w-full py-2 px-3 rounded-xl border border-surfaceBorder hover:bg-red-500/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Queue
          </button>
        </div>
      )}
    </div>
  );
};
