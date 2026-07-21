import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { MediaViewerHeader } from './MediaViewer/MediaViewerHeader';
import { MediaViewerSidebar } from './MediaViewer/MediaViewerSidebar';
import { VideoPlayer } from './MediaViewer/VideoPlayer';
import { ImageViewer } from './MediaViewer/ImageViewer';
import { SlideshowHUD } from './MediaViewer/SlideshowHUD';
import { useSwipeTrack } from './MediaViewer/useSwipeTrack';
import { MediaItem, TagType } from './MediaViewer/types';

export function MediaViewer({
  items,
  currentIndex,
  onClose,
  onNavigate,
  onRemoveItem,
  isSlideshow = false,
  slideshowSpeed,
  onSlideshowEnd,
}: {
  items: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onRemoveItem?: (id: number) => void;
  isSlideshow?: boolean;
  slideshowSpeed?: number;
  onSlideshowEnd?: () => void;
}) {
  const item = items[currentIndex];

  const [defaultSize, setDefaultSize] = useState<'fit' | 'original'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('defaultMediaSize') as 'fit' | 'original') || 'fit';
    }
    return 'fit';
  });

  const {
    scale,
    position,
    swipeOffset,
    isTracking,
    isDragging,
    swipeDuration,
    trackRef,
    hasDraggedRef,
    updateZoom,
    getOriginalScale,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetZoom
  } = useSwipeTrack(items, currentIndex, onNavigate, onClose, defaultSize);

  const [tags, setTags] = useState<TagType[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const fetchTags = useCallback(async () => {
    if (!item || !window.electronAPI) return;
    const res = await window.electronAPI.getTags(item.id);
    if (res.success) {
      setTags(res.tags);
    }
  }, [item]);

  useEffect(() => {
    if (item) {
      fetchTags();
      resetZoom();
      if (defaultSize === 'original') {
        const origScale = getOriginalScale();
        updateZoom(origScale);
      }
    }
  }, [item?.id, defaultSize]);

  // Slideshow State
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(slideshowSpeed || 4000);
  const slideshowStartTimeRef = useRef(Date.now());
  const slideshowElapsedRef = useRef(0);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSlideshow) return;
    if (item?.type === 'video') return; 

    if (slideshowPaused) {
       if (slideshowStartTimeRef.current !== 0) {
          slideshowElapsedRef.current += Date.now() - slideshowStartTimeRef.current;
          slideshowStartTimeRef.current = 0;
       }
       return;
    }

    slideshowStartTimeRef.current = Date.now();
    const remainingTime = Math.max(0, currentSpeed - slideshowElapsedRef.current);

    slideshowTimerRef.current = setTimeout(() => {
      if (currentIndex < items.length - 1) {
        onNavigate(currentIndex + 1);
      }
    }, remainingTime);

    return () => {
       if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current);
    };
  }, [isSlideshow, slideshowPaused, currentSpeed, item?.id, item?.type, currentIndex, onNavigate, items.length]);

  const handleVideoEnded = () => {
    if (isSlideshow && currentIndex < items.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim() && window.electronAPI) {
      const res = await window.electronAPI.addTag(item.id, newTag.trim());
      if (res.success && res.tag) {
        setTags(prev => {
          if (!prev.find(t => t.id === res.tag!.id)) return [...prev, res.tag!];
          return prev;
        });
        setNewTag('');
      } else {
        showToast(res.error || 'Failed to add tag');
      }
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.removeTag(item.id, tagId);
    if (res.success) {
      setTags(prev => prev.filter(t => t.id !== tagId));
    }
  };

  const handleAction = async (action: string) => {
    if (!window.electronAPI) return;
    
    switch(action) {
      case 'reveal':
        await window.electronAPI.revealInExplorer(item.filepath);
        break;
      case 'share':
        await window.electronAPI.shareMedia(item.filepath);
        setCopied(true);
        showToast("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${item.filename} from disk?`)) {
          const res = await window.electronAPI.deleteMedia(item.id, item.filepath);
          if (res.success) {
             onRemoveItem?.(item.id);
             showToast("Deleted successfully");
          } else {
             showToast(res.error || "Failed to delete");
          }
        }
        break;
      case 'rotate':
        if (item.type === 'image') {
          const res = await window.electronAPI.rotateMedia(item.id, item.filepath);
          if (res.success) {
             const reloadUrl = `media://${encodeURIComponent(item.filepath)}?t=${Date.now()}`;
             const els = document.querySelectorAll(`img[src^="media://${encodeURIComponent(item.filepath)}"]`);
             els.forEach((el: any) => el.src = reloadUrl);
          } else {
             showToast(res.error || "Failed to rotate");
          }
        }
        break;
      case 'wallpaper':
        if (item.type === 'image') {
           const res = await window.electronAPI.setWallpaper(item.filepath);
           if (res.success) showToast("Wallpaper set successfully!");
           else showToast(res.error || "Failed to set wallpaper");
        }
        break;
    }
  };

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 2500);
    };

    const toggleIdle = () => {
      setIsIdle(prev => !prev);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };

    handleActivity();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (isSidebarOpen || isInfoOpen) {
          setIsSidebarOpen(false);
          setIsInfoOpen(false);
          return;
        }
        if (document.fullscreenElement) document.exitFullscreen();
        else onClose();
      } else if (e.key === 'ArrowRight') {
        if (!e.shiftKey && currentIndex < items.length - 1) onNavigate(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        if (!e.shiftKey && currentIndex > 0) onNavigate(currentIndex - 1);
      } else if (e.key === 't') {
        setIsSidebarOpen(s => !s);
        if (!isSidebarOpen) setIsInfoOpen(false);
      } else if (e.key === 'i') {
        setIsInfoOpen(i => !i);
        if (!isInfoOpen) setIsSidebarOpen(false);
      } else if (e.key === '=' || e.key === '+') {
        updateZoom(Math.min(scale * 1.5, 10));
      } else if (e.key === '-') {
        updateZoom(Math.max(scale / 1.5, Math.min(1, getOriginalScale())));
      } else if (e.key === '0') {
        updateZoom(1);
      } else if (e.key === 'f') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.error(err));
        } else {
          document.documentElement.requestFullscreen().catch(err => console.error(err));
        }
      } else if (e.key === 'z') {
        setDefaultSize(prev => {
          const next = prev === 'fit' ? 'original' : 'fit';
          if (typeof window !== 'undefined') localStorage.setItem('defaultMediaSize', next);
          return next;
        });
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentIndex, items.length, isSidebarOpen, isInfoOpen, scale, updateZoom, getOriginalScale]);

  if (!item) return null;

  const trackItems = [
    currentIndex > 0 ? items[currentIndex - 1] : null,
    item,
    currentIndex < items.length - 1 ? items[currentIndex + 1] : null
  ];

  return (
    <div 
      className="fixed inset-0 z-40 bg-black overflow-hidden focus:outline-none select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
         setIsIdle(prev => !prev);
      }}
    >
      <MediaViewerHeader 
        item={item}
        scale={scale}
        isIdle={isIdle}
        copied={copied}
        isInfoOpen={isInfoOpen}
        isSidebarOpen={isSidebarOpen}
        onClose={onClose}
        updateZoom={updateZoom}
        getOriginalScale={getOriginalScale}
        handleAction={handleAction}
        setIsInfoOpen={setIsInfoOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <div 
        ref={trackRef}
        className="absolute inset-0 flex will-change-transform"
        style={{
          transform: `translate3d(calc(-100vw + ${swipeOffset.x}px), ${swipeOffset.y}px, 0)`,
          transition: isTracking ? 'none' : `transform ${swipeDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
        }}
      >
        {trackItems.map((trackItem, i) => (
          <div 
            key={trackItem ? trackItem.id : `empty-${i}`} 
            className="w-screen h-screen flex-shrink-0 relative flex items-center justify-center overflow-hidden"
          >
            {trackItem && (
              trackItem.type === 'video' ? (
                <VideoPlayer 
                  item={trackItem}
                  isCurrent={i === 1}
                  isIdle={isIdle}
                  isTracking={isTracking}
                  swipeOffset={swipeOffset}
                  isSlideshow={isSlideshow}
                  defaultSize={defaultSize}
                  onVideoEnded={handleVideoEnded}
                />
              ) : (
                <ImageViewer 
                  item={trackItem}
                  isCurrent={i === 1}
                  isIdle={isIdle}
                  scale={i === 1 ? scale : 1}
                  position={i === 1 ? position : {x:0, y:0}}
                  swipeOffset={swipeOffset}
                  isTracking={isTracking}
                  isDragging={isDragging}
                  defaultSize={defaultSize}
                />
              )
            )}
          </div>
        ))}
      </div>

      <MediaViewerSidebar 
        item={item}
        tags={tags}
        newTag={newTag}
        isSidebarOpen={isSidebarOpen}
        isInfoOpen={isInfoOpen}
        setNewTag={setNewTag}
        handleAddTag={handleAddTag}
        handleRemoveTag={handleRemoveTag}
        setIsSidebarOpen={setIsSidebarOpen}
        setIsInfoOpen={setIsInfoOpen}
      />

      <SlideshowHUD 
        isSlideshow={isSlideshow}
        isIdle={isIdle}
        slideshowPaused={slideshowPaused}
        currentSpeed={currentSpeed}
        setSlideshowPaused={setSlideshowPaused}
        setCurrentSpeed={setCurrentSpeed}
        onSlideshowEnd={onSlideshowEnd}
      />

      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm font-medium z-[100] animate-in fade-in slide-in-from-top-4 backdrop-blur-md shadow-2xl border border-white/10">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
