import React from 'react';
import { InteractiveButton } from '../InteractiveButton';
import { ChevronLeft, ZoomIn, ZoomOut, RotateCw, Expand, Monitor, Copy, Check, FolderOpen, Info, Tag as TagIcon, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { MediaItem } from './types';

export function MediaViewerHeader({
  item,
  scale,
  isIdle,
  copied,
  isInfoOpen,
  isSidebarOpen,
  onClose,
  updateZoom,
  getOriginalScale,
  handleAction,
  setIsInfoOpen,
  setIsSidebarOpen
}: {
  item: MediaItem;
  scale: number;
  isIdle: boolean;
  copied: boolean;
  isInfoOpen: boolean;
  isSidebarOpen: boolean;
  onClose: () => void;
  updateZoom: (s: number) => void;
  getOriginalScale: () => number;
  handleAction: (action: string) => void;
  setIsInfoOpen: (v: boolean) => void;
  setIsSidebarOpen: (v: boolean) => void;
}) {
  return (
    <div className={clsx("absolute top-0 inset-x-0 p-6 flex justify-between items-start transition-opacity duration-300 pointer-events-none z-30 bg-gradient-to-b from-black/80 to-transparent pb-12", isIdle && "opacity-0")}>
      <div className="flex items-center gap-4 pointer-events-auto">
        <InteractiveButton
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </InteractiveButton>
        <div className="text-white drop-shadow-md">
          <p className="text-sm font-medium truncate max-w-md">{item.filename}</p>
          <p className="text-xs text-white/80">{item.width || 'Unknown'} x {item.height || 'Unknown'} • {item.type.toUpperCase()}</p>
        </div>
      </div>
      
      <div className="flex gap-2 pointer-events-auto shadow-lg">
        {item.type === 'image' && (
          <>
            <InteractiveButton onClick={() => updateZoom(Math.min(scale * 1.5, 10))} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
              <ZoomIn className="w-4 h-4" />
            </InteractiveButton>
            <InteractiveButton onClick={() => {
              const origScale = getOriginalScale();
              updateZoom(Math.max(scale / 1.5, Math.min(1, origScale)));
            }} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
              <ZoomOut className="w-4 h-4" />
            </InteractiveButton>
            <div className="w-px h-6 bg-white/20 my-auto mx-1" />
            <InteractiveButton onClick={() => handleAction('rotate')} title="Rotate" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
              <RotateCw className="w-4 h-4" />
            </InteractiveButton>
            <InteractiveButton onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(err));
              } else {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
              }
            }} title="Fullscreen" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
              <Expand className="w-4 h-4" />
            </InteractiveButton>
            <InteractiveButton onClick={() => handleAction('wallpaper')} title="Set as Wallpaper" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
              <Monitor className="w-4 h-4" />
            </InteractiveButton>
          </>
        )}
        
        <InteractiveButton onClick={() => handleAction('share')} title="Copy to Clipboard" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </InteractiveButton>
        <InteractiveButton onClick={() => handleAction('reveal')} title="Reveal in Explorer" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white">
          <FolderOpen className="w-4 h-4" />
        </InteractiveButton>
        
        <div className="w-px h-6 bg-white/20 my-auto mx-1" />
        
        <InteractiveButton onClick={() => { setIsInfoOpen(!isInfoOpen); if (!isInfoOpen) setIsSidebarOpen(false); }} className={clsx("p-3 backdrop-blur-md rounded-full text-white", isInfoOpen ? "bg-indigo-500 hover:bg-indigo-600" : "bg-white/10 hover:bg-white/20")} title="Info">
          <Info className="w-4 h-4" />
        </InteractiveButton>

        <InteractiveButton onClick={() => { setIsSidebarOpen(!isSidebarOpen); if (!isSidebarOpen) setIsInfoOpen(false); }} className={clsx("p-3 backdrop-blur-md rounded-full text-white", isSidebarOpen ? "bg-indigo-500 hover:bg-indigo-600" : "bg-white/10 hover:bg-white/20")} title="Tags">
          <TagIcon className="w-4 h-4" />
        </InteractiveButton>
        
        <InteractiveButton onClick={() => handleAction('delete')} className="p-3 bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-md rounded-full ml-2" title="Delete">
          <Trash2 className="w-4 h-4" />
        </InteractiveButton>
      </div>
    </div>
  );
}
