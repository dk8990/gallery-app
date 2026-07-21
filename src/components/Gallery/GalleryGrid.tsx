import React, { useRef } from 'react';
import { PlayCircle, CheckCircle2, Circle, X } from 'lucide-react';
import clsx from 'clsx';
import { flushSync } from 'react-dom';
import { MediaItem } from './useMediaLibrary';

export function GalleryGrid({
  itemsWithHeaders,
  visibleItems,
  totalHeight,
  containerRef,
  selectedMediaIds,
  setSelectedMediaIds,
  isSelectionModalOpen,
  setIsSelectionModalOpen,
  setActiveMediaId,
  setIsSlideshow,
  setTransitionId,
  transitionId,
  viewerIndex
}: {
  itemsWithHeaders: any[];
  visibleItems: any[];
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  selectedMediaIds: Set<number>;
  setSelectedMediaIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  isSelectionModalOpen: boolean;
  setIsSelectionModalOpen: (v: boolean) => void;
  setActiveMediaId: (id: number) => void;
  setIsSlideshow: (v: boolean) => void;
  setTransitionId: (id: number | null) => void;
  transitionId: number | null;
  viewerIndex: number | null;
}) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);

  const handlePressStart = (id: number) => {
    isLongPressing.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      setSelectedMediaIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }, 500);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <>
      <div ref={containerRef} className="relative w-full" style={{ height: totalHeight }}>
        {visibleItems.map(({ item, top, left, width, height }) => {
          if ('isHeader' in item && item.isHeader) {
            return (
              <div
                key={item.id}
                className="absolute flex items-end px-2 pb-2 pointer-events-none"
                style={{ top, left, width, height }}
              >
                <h3 className="text-2xl font-bold text-white/90 tracking-tight drop-shadow-md">{item.title}</h3>
              </div>
            );
          }

          const mediaItem = item as MediaItem;
          const thumbUrl = `media://${encodeURIComponent(mediaItem.thumbnail_path)}${mediaItem._ts ? `?t=${mediaItem._ts}` : ''}`;

          const isSelected = selectedMediaIds.has(mediaItem.id);
          const isSelectionMode = selectedMediaIds.size > 0;

          return (
            <div
              key={mediaItem.id}
              onMouseDown={() => handlePressStart(mediaItem.id)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={() => handlePressStart(mediaItem.id)}
              onTouchEnd={handlePressEnd}
              onClick={(e) => {
                if (isLongPressing.current) {
                  isLongPressing.current = false;
                  return;
                }
                if (isSelectionMode) {
                  setSelectedMediaIds(prev => {
                    const next = new Set(prev);
                    if (next.has(mediaItem.id)) next.delete(mediaItem.id);
                    else next.add(mediaItem.id);
                    return next;
                  });
                  return;
                }

                if (document.startViewTransition) {
                  flushSync(() => {
                    setTransitionId(mediaItem.id);
                  });
                  document.startViewTransition(() => {
                    flushSync(() => {
                      setActiveMediaId(mediaItem.id);
                      setIsSlideshow(false);
                    });
                  }).finished.finally(() => {
                    setTransitionId(null);
                  });
                } else {
                  setActiveMediaId(mediaItem.id);
                  setIsSlideshow(false);
                }
              }}
              className={clsx(
                "absolute group rounded-xl overflow-hidden bg-zinc-900 border transition-all duration-300 cursor-pointer shadow-sm",
                isSelected ? "border-indigo-500 shadow-indigo-500/20 scale-[0.98]" : "border-zinc-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10"
              )}
              style={{ top, left, width, height }}
            >
              <img
                src={thumbUrl}
                alt={mediaItem.filename}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                style={{
                  viewTransitionName: (transitionId === mediaItem.id && viewerIndex === null)
                    ? `media-${mediaItem.id}`
                    : 'none'
                } as React.CSSProperties}
              />
              <div className={clsx("absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />

              {/* Checkbox overlay */}
              {(isSelectionMode || isSelected) && (
                <div className="absolute top-3 left-3 z-10">
                  {isSelected ? (
                    <div className="bg-indigo-500 rounded-full text-white shadow-lg">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="text-white/50 group-hover:text-white/80 drop-shadow-md">
                      <Circle className="w-6 h-6" />
                    </div>
                  )}
                </div>
              )}

              {mediaItem.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <PlayCircle className="w-10 h-10 text-white/70 drop-shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 z-10" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Selection Button */}
      {selectedMediaIds.size > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up flex items-center bg-indigo-500/20 backdrop-blur-xl rounded-full shadow-2xl shadow-black/50 border border-indigo-400/30 pr-2 transition-all hover:scale-105 hover:bg-indigo-500/30 hover:border-indigo-400/40">
          <button
            onClick={() => setIsSelectionModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 text-white hover:bg-white/10 rounded-l-full transition-colors active:scale-95"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-sm font-medium">
              {selectedMediaIds.size}
            </div>
            <span className="font-semibold">Items Selected</span>
          </button>
          <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
          <button
            onClick={() => {
              setSelectedMediaIds(new Set());
              setIsSelectionModalOpen(false);
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}
