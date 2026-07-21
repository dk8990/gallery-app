import React from 'react';
import { Play, Pause, X } from 'lucide-react';
import clsx from 'clsx';
import { InteractiveButton } from '../InteractiveButton';

export function SlideshowHUD({
  isSlideshow,
  isIdle,
  slideshowPaused,
  currentSpeed,
  setSlideshowPaused,
  setCurrentSpeed,
  onSlideshowEnd
}: {
  isSlideshow: boolean;
  isIdle: boolean;
  slideshowPaused: boolean;
  currentSpeed: number;
  setSlideshowPaused: (v: boolean) => void;
  setCurrentSpeed: (v: (s: number) => number) => void;
  onSlideshowEnd?: () => void;
}) {
  if (!isSlideshow) return null;

  return (
    <div className={clsx("absolute bottom-10 left-1/2 -translate-x-1/2 z-[150] flex flex-col items-center gap-3 pointer-events-auto transition-opacity duration-300", isIdle && "opacity-0")}>
      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 zoom-in-95">
        <InteractiveButton 
          onClick={() => setSlideshowPaused(!slideshowPaused)} 
          className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
          title={slideshowPaused ? "Resume Slideshow" : "Pause Slideshow"}
        >
          {slideshowPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
        </InteractiveButton>
        
        <div className="w-px h-6 bg-white/20 mx-1" />
        
        <InteractiveButton 
          onClick={() => setCurrentSpeed(s => s === 2000 ? 4000 : s === 4000 ? 10000 : 2000)}
          className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
          title="Change Speed"
        >
          {currentSpeed / 1000}s
        </InteractiveButton>

        <div className="w-px h-6 bg-white/20 mx-1" />

        <InteractiveButton 
          onClick={() => {
            if (onSlideshowEnd) onSlideshowEnd();
          }}
          className="p-2 hover:bg-white/10 rounded-full text-red-400 hover:text-red-300 transition-colors"
          title="Exit Slideshow"
        >
          <X className="w-5 h-5" />
        </InteractiveButton>
      </div>
    </div>
  );
}
