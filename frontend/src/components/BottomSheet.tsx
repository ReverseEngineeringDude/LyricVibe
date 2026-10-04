import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
import { Search, ListMusic, ChevronUp, ChevronDown, Sliders } from 'lucide-react';
import { SearchPanel } from './SearchPanel';
import { Queue } from './Queue';
import { StylePanel } from './StylePanel';
import { usePlayerStore } from '@/store/usePlayerStore';

type SheetSnap = 'peek' | 'half' | 'full';

export const BottomSheet: React.FC = () => {
  const [snap, setSnap] = useState<SheetSnap>('peek');
  const [activeTab, setActiveTab] = useState<'search' | 'queue' | 'style'>('search');
  const queue = usePlayerStore((s) => s.queue);
  const dragControls = useDragControls();

  const snapHeights: Record<SheetSnap, string> = {
    peek: '64px',
    half: '52vh',
    full: '88vh',
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.velocity.y < -250 || info.offset.y < -60) {
      // Swiped up
      if (snap === 'peek') setSnap('half');
      else if (snap === 'half') setSnap('full');
    } else if (info.velocity.y > 250 || info.offset.y > 60) {
      // Swiped down
      if (snap === 'full') setSnap('half');
      else if (snap === 'half') setSnap('peek');
    }
  };

  const openTab = (tab: 'search' | 'queue' | 'style') => {
    setActiveTab(tab);
    if (snap === 'peek') {
      setSnap('half');
    }
  };

  return (
    <>
      {/* Backdrop overlay when expanded to half or full */}
      <AnimatePresence>
        {snap !== 'peek' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSnap('peek')}
            className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.div
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ height: snapHeights[snap] }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="lg:hidden fixed bottom-[72px] sm:bottom-[76px] left-0 right-0 z-30 bg-surface/95 backdrop-blur-2xl border-t border-surfaceBorder rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Drag handle header (Draggable exclusively from this handle area) */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          onClick={() => setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')}
          className="pt-2.5 pb-2 px-3 sm:px-4 flex flex-col items-center justify-center cursor-pointer select-none touch-none shrink-0"
        >
          {/* Pill grab handle */}
          <div className="w-10 h-1.5 bg-gray-500 hover:bg-gray-400 rounded-full mb-2 transition-colors" />

          {/* Navigation Tabs Bar */}
          <div className="w-full flex items-center justify-between text-xs text-gray-300">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openTab('search');
                }}
                className={`flex items-center gap-1.5 font-medium py-1.5 px-2.5 rounded-xl transition-all ${
                  activeTab === 'search' && snap !== 'peek'
                    ? 'text-white bg-brand-500 shadow-md shadow-brand-500/30'
                    : activeTab === 'search'
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openTab('queue');
                }}
                className={`flex items-center gap-1.5 font-medium py-1.5 px-2.5 rounded-xl transition-all ${
                  activeTab === 'queue' && snap !== 'peek'
                    ? 'text-white bg-brand-500 shadow-md shadow-brand-500/30'
                    : activeTab === 'queue'
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Queue</span>
                {queue.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                    {queue.length}
                  </span>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openTab('style');
                }}
                className={`flex items-center gap-1.5 font-medium py-1.5 px-2.5 rounded-xl transition-all ${
                  activeTab === 'style' && snap !== 'peek'
                    ? 'text-white bg-brand-500 shadow-md shadow-brand-500/30'
                    : activeTab === 'style'
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Style</span>
              </button>
            </div>

            {/* Quick minimize / expand toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSnap(snap === 'peek' ? 'half' : 'peek');
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors"
              aria-label={snap === 'peek' ? 'Expand sheet' : 'Minimize sheet'}
            >
              {snap === 'full' ? (
                <ChevronDown className="w-4 h-4" />
              ) : snap === 'half' ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Sheet Content when open */}
        {snap !== 'peek' && (
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-4 overscroll-contain">
            {activeTab === 'search' && <SearchPanel />}
            {activeTab === 'queue' && <Queue embedded={true} onClose={() => setSnap('peek')} />}
            {activeTab === 'style' && <StylePanel />}
          </div>
        )}
      </motion.div>
    </>
  );
};
