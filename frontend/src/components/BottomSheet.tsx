import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Search, ListMusic, ChevronUp, ChevronDown, Sliders } from 'lucide-react';
import { SearchPanel } from './SearchPanel';
import { Queue } from './Queue';
import { StylePanel } from './StylePanel';

type SheetSnap = 'peek' | 'half' | 'full';

export const BottomSheet: React.FC = () => {
  const [snap, setSnap] = useState<SheetSnap>('peek');
  const [activeTab, setActiveTab] = useState<'search' | 'queue' | 'style'>('search');

  const snapHeights: Record<SheetSnap, string> = {
    peek: '64px',
    half: '45vh',
    full: '88vh',
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.velocity.y < -300 || info.offset.y < -80) {
      // Swiped up
      if (snap === 'peek') setSnap('half');
      else if (snap === 'half') setSnap('full');
    } else if (info.velocity.y > 300 || info.offset.y > 80) {
      // Swiped down
      if (snap === 'full') setSnap('half');
      else if (snap === 'half') setSnap('peek');
    }
  };

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      animate={{ height: snapHeights[snap] }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="md:hidden fixed bottom-[76px] left-0 right-0 z-30 bg-surface/95 backdrop-blur-2xl border-t border-surfaceBorder rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Drag handle header */}
      <div
        onClick={() => setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')}
        className="pt-2.5 pb-2 px-4 flex flex-col items-center justify-center cursor-pointer select-none"
      >
        <div className="w-12 h-1.5 bg-gray-600 rounded-full mb-2" />
        <div className="w-full flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('search');
                if (snap === 'peek') setSnap('half');
              }}
              className={`flex items-center gap-1.5 font-medium py-1 px-2 rounded-lg ${
                activeTab === 'search' ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('queue');
                if (snap === 'peek') setSnap('half');
              }}
              className={`flex items-center gap-1.5 font-medium py-1 px-2 rounded-lg ${
                activeTab === 'queue' ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              Queue
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('style');
                if (snap === 'peek') setSnap('half');
              }}
              className={`flex items-center gap-1.5 font-medium py-1 px-2 rounded-lg ${
                activeTab === 'style' ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Style
            </button>
          </div>

          <div className="text-gray-400">
            {snap === 'full' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Sheet Content when open */}
      {snap !== 'peek' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {activeTab === 'search' && <SearchPanel />}
          {activeTab === 'queue' && <Queue />}
          {activeTab === 'style' && <StylePanel />}
        </div>
      )}
    </motion.div>
  );
};
