import React from 'react';
import { Search, Filter, ArrowUpDown, Play } from 'lucide-react';
import clsx from 'clsx';
import { InteractiveButton } from '../InteractiveButton';
import { DynamicDropdown } from '../DynamicDropdown';
import { MediaItem } from './useMediaLibrary';

export function GalleryToolbar({
  total,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  sortBy,
  setSortBy,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  mediaItems,
  setActiveMediaId,
  setIsSlideshow,
  openDropdown,
  setOpenDropdown,
  onRandomSort
}: {
  total: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterType: 'All' | 'video' | 'image';
  setFilterType: (f: 'All' | 'video' | 'image') => void;
  sortBy: 'Newest' | 'Oldest' | 'Largest' | 'Smallest' | 'Random';
  setSortBy: (s: 'Newest' | 'Oldest' | 'Largest' | 'Smallest' | 'Random') => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  mediaItems: MediaItem[];
  setActiveMediaId: (id: number) => void;
  setIsSlideshow: (v: boolean) => void;
  openDropdown: 'sort' | 'filter' | 'date' | 'slideshow' | null;
  setOpenDropdown: (d: 'sort' | 'filter' | 'date' | 'slideshow' | null) => void;
  onRandomSort: () => void;
}) {
  return (
    <header className="absolute top-0 inset-x-0 z-40 flex flex-wrap items-center justify-between px-8 py-4 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent backdrop-blur-sm pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-6">
        <div>
          <h2 className="text-lg font-medium text-white/90 flex items-center gap-3">
            Library
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">{total} items</p>
        </div>
      </div>

      <div className="flex gap-3 items-center pointer-events-auto">
        <label className="relative block cursor-text">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 focus-within:bg-zinc-800 border border-white/5 focus-within:border-white/20 rounded-lg transition-all">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags or names..."
              className="bg-transparent text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none w-48"
            />
          </div>
        </label>

        <DynamicDropdown
          isOpen={openDropdown === 'filter'}
          onToggle={() => setOpenDropdown(openDropdown === 'filter' ? null : 'filter')}
          className="bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 text-zinc-300"
          triggerContent={
            <>
              <Filter className="w-4 h-4 text-indigo-400" />
              {filterType === 'All' ? 'All Media' : filterType === 'video' ? 'Videos' : 'Photos'}
            </>
          }
        >
          <div className="w-40 py-1">
            {['All', 'image', 'video'].map(type => (
              <InteractiveButton
                key={type}
                noScale
                onClick={() => { setFilterType(type as any); setOpenDropdown(null); }}
                className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-indigo-500/10 hover:text-indigo-300 ", filterType === type ? "text-indigo-400 bg-indigo-500/5" : "text-zinc-300")}
              >
                {type === 'All' ? 'All Media' : type === 'image' ? 'Photos Only' : 'Videos Only'}
              </InteractiveButton>
            ))}
          </div>
        </DynamicDropdown>

        <DynamicDropdown
          isOpen={openDropdown === 'sort'}
          onToggle={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
          className="bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 text-zinc-300"
          triggerContent={
            <>
              <ArrowUpDown className="w-4 h-4 text-pink-400" />
              {sortBy}
            </>
          }
        >
          <div className="w-40 py-1">
            {['Newest', 'Oldest', 'Largest', 'Smallest', 'Random'].map(sort => (
              <InteractiveButton
                key={sort}
                noScale
                onClick={() => {
                  if (sort === 'Random' && sortBy === 'Random') {
                    onRandomSort();
                  } else {
                    setSortBy(sort as any);
                  }
                  setOpenDropdown(null);
                }}
                className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-pink-500/10 hover:text-pink-300 ", sortBy === sort ? "text-pink-400 bg-pink-500/5" : "text-zinc-300")}
              >
                {sort}
              </InteractiveButton>
            ))}
          </div>
        </DynamicDropdown>

        <DynamicDropdown
          isOpen={openDropdown === 'date'}
          onToggle={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
          className={clsx((startDate || endDate) && "!text-emerald-300", (startDate || endDate) && openDropdown !== 'date' && "!bg-emerald-500/20 !border-emerald-500/30")}
          triggerContent="Dates"
        >
          <div className="w-64 p-4 flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            {(startDate || endDate) && (
              <InteractiveButton
                noScale
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="w-full text-center px-4 py-2 mt-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg"
              >
                Clear Dates
              </InteractiveButton>
            )}
          </div>
        </DynamicDropdown>

        <InteractiveButton
          onClick={() => {
            if (mediaItems.length > 0) {
              setActiveMediaId(mediaItems[0].id);
              setIsSlideshow(true);
            }
          }}
          className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20 shadow-sm"
        >
          <Play className="w-4 h-4" />
          Slideshow
        </InteractiveButton>
      </div>
    </header>
  );
}
