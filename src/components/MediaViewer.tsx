"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { InteractiveButton } from './InteractiveButton';
import { X, ChevronLeft, ChevronRight, Tag as TagIcon, Info, RotateCw, Trash2, Monitor, ExternalLink, Play, Pause, Volume2, VolumeX, Expand, ZoomIn, ZoomOut, MoreVertical, FolderOpen, Copy, Check } from 'lucide-react';
import clsx from 'clsx';

type MediaItem = {
  id: number;
  filepath: string;
  filename: string;
  type: string;
  thumbnail_path: string;
  width: number;
  height: number;
  duration?: number;
  size?: number;
  created_at?: string;
};

type TagType = {
  id: number;
  name: string;
};

export function MediaViewer({
  items,
  currentIndex,
  isSlideshow = false,
  slideshowSpeed = 4000,
  onClose,
  onNavigate,
  onSlideshowEnd
}: {
  items: MediaItem[];
  currentIndex: number;
  isSlideshow?: boolean;
  slideshowSpeed?: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onSlideshowEnd?: () => void;
}) {
  const item = items[currentIndex];
  const [tags, setTags] = useState<TagType[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [seekOffset, setSeekOffset] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [freezeFrameUrl, setFreezeFrameUrl] = useState<string | null>(null);

  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedSeekRef = useRef<number>(0);
  const isHoldingSeekRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const accumulatedWheelRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const isSnappedRef = useRef(false);

  const trackRef = useRef<HTMLDivElement>(null);
  
  // Photo state
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [isTracking, setIsTracking] = useState(false);
  const [swipeDuration, setSwipeDuration] = useState(300);

  const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNavigateRef = useRef<number | null>(null);

  const triggerSwipe = useCallback((direction: 1 | -1) => {
    let resolvedCurrentIndex = currentIndex;
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = null;
      if (pendingNavigateRef.current !== null) {
        setIsTracking(true);
        flushSync(() => {
          onNavigate(pendingNavigateRef.current!);
        });
        setSwipeOffset({ x: 0, y: 0 });
        resolvedCurrentIndex = pendingNavigateRef.current;
        pendingNavigateRef.current = null;
      }
    }

    if (direction === -1 && resolvedCurrentIndex <= 0) return;
    if (direction === 1 && resolvedCurrentIndex >= items.length - 1) return;
    
    setSwipeDuration(150);
    setIsTracking(false);
    setSwipeOffset({ x: direction === 1 ? -window.innerWidth : window.innerWidth, y: 0 });
    pendingNavigateRef.current = resolvedCurrentIndex + direction;
    
    swipeTimeoutRef.current = setTimeout(() => {
      if (pendingNavigateRef.current !== null) {
        setIsTracking(true);
        flushSync(() => {
          setSwipeOffset({ x: 0, y: 0 });
          onNavigate(pendingNavigateRef.current!);
        });
        pendingNavigateRef.current = null;
      }
      swipeTimeoutRef.current = null;
    }, 150);
  }, [currentIndex, items.length, onNavigate]);
  
  const [defaultSize, setDefaultSize] = useState<'fit' | 'original'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('defaultMediaSize') as 'fit' | 'original') || 'fit';
    }
    return 'fit';
  });

  const getOriginalScale = useCallback((width?: number, height?: number) => {
    const w = width || item?.width;
    const h = height || item?.height;
    if (!w || !h) return 1;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const imgRatio = w / h;
    const containerRatio = cw / ch;
    
    let renderedWidth;
    if (imgRatio > containerRatio) {
      renderedWidth = cw;
    } else {
      renderedWidth = ch * imgRatio;
    }
    return w / renderedWidth;
  }, [item]);

  const getBounds = useCallback((currentScale: number) => {
    if (!item || !item.width || !item.height || currentScale <= 1) return { maxX: 0, maxY: 0 };
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const imgRatio = item.width / item.height;
    const windowRatio = windowW / windowH;
    
    let visualW, visualH;
    if (imgRatio > windowRatio) {
      visualW = windowW;
      visualH = windowW / imgRatio;
    } else {
      visualH = windowH;
      visualW = windowH * imgRatio;
    }
    
    const maxX = Math.max(0, (visualW * currentScale - windowW) / 2);
    const maxY = Math.max(0, (visualH * currentScale - windowH) / 2);
    return { maxX, maxY };
  }, [item]);

  const clampPosition = useCallback((pos: { x: number, y: number }, currentScale: number) => {
    if (currentScale <= 1) return { x: 0, y: 0 };
    const { maxX, maxY } = getBounds(currentScale);
    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y))
    };
  }, [getBounds]);

  const updateZoom = useCallback((newScale: number) => {
    setScale(newScale);
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    } else {
      setPosition(prev => clampPosition(prev, newScale));
    }
  }, [clampPosition]);

  const applyRubberBand = useCallback((value: number, max: number) => {
    if (value > max) {
      return max + (value - max) * 0.3;
    } else if (value < -max) {
      return -max + (value + max) * 0.3;
    }
    return value;
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (defaultSize === 'original') {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        const origScale = getOriginalScale(img.naturalWidth, img.naturalHeight);
        setScale(origScale);
      }
    }
  }, [defaultSize, getOriginalScale]);

  // Reset states when item changes
  useEffect(() => {
    if (defaultSize === 'original') {
      setScale(getOriginalScale());
    } else {
      setScale(1);
    }
    setPosition({ x: 0, y: 0 });
    setIsPlaying(true);
    setProgress(0);
    setSeekOffset(0);
    setFreezeFrameUrl(null);
    accumulatedSeekRef.current = 0;
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    
    // Reset slideshow elapsed
    slideshowElapsedRef.current = 0;
    slideshowStartTimeRef.current = Date.now();
  }, [item?.id]);

  // Slideshow State
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(slideshowSpeed || 4000);
  const slideshowStartTimeRef = useRef(Date.now());
  const slideshowElapsedRef = useRef(0);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSlideshow) return;

    if (item?.type === 'video') {
       return; // Videos handle their own advancing via onEnded
    }

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
      triggerSwipe(1);
    }, remainingTime);

    return () => {
       if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current);
    };
  }, [isSlideshow, slideshowPaused, currentSpeed, item?.id, item?.type, currentIndex, onNavigate]);

  const handleVideoEnded = () => {
    if (isSlideshow) {
      triggerSwipe(1);
    }
  };

  // Idle state (hide UI and cursor)
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

  const fetchTags = useCallback(async () => {
    if (!item || !window.electronAPI) return;
    const res = await window.electronAPI.getTags(item.id);
    if (res.success) {
      setTags(res.tags);
    }
  }, [item]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim() && window.electronAPI) {
      const res = await window.electronAPI.addTag(item.id, newTag);
      if (res.success && res.tag) {
        setTags((prev) => [...prev, res.tag!]);
        setNewTag('');
      }
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.removeTag(item.id, tagId);
    if (res.success) {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    }
  };

  const handleAction = async (action: string) => {
    if (!window.electronAPI) return;
    switch (action) {
      case 'reveal':
        await window.electronAPI.revealInExplorer(item.filepath);
        break;
      case 'wallpaper':
        await window.electronAPI.setWallpaper(item.filepath);
        break;
      case 'share':
        await window.electronAPI.shareMedia(item.filepath);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;
      case 'rotate':
        await window.electronAPI.rotateMedia(item.id, item.filepath);
        // Force reload image
        if (imgRef.current) {
          imgRef.current.src = `media://${encodeURIComponent(item.filepath)}?t=${Date.now()}`;
        }
        // Dispatch event for grid to refresh
        window.dispatchEvent(new CustomEvent('media-rotated', { detail: { id: item.id } }));
        break;
      case 'delete':
        if (confirm('Are you sure you want to permanently delete this file?')) {
          await window.electronAPI.deleteMedia(item.id, item.filepath);
          window.dispatchEvent(new CustomEvent('media-deleted', { detail: { id: item.id } }));
          onClose(); // In a real app we'd remove it from the list and go to next
        }
        break;
    }
  };

  // Video Controls
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (item?.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [item?.id, isPlaying, item?.type]);

  // Pause all inactive videos
  useEffect(() => {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      if (v !== videoRef.current) {
        v.pause();
      }
    });
  }, [item?.id]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newVol = volume > 0 ? 0 : 1;
      videoRef.current.volume = newVol;
      setVolume(newVol);
    }
  }, [volume]);

  const isStreamingVideo = item?.type === 'video';

  const captureFrame = useCallback(() => {
    if (videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          setFreezeFrameUrl(canvas.toDataURL('image/jpeg'));
        }
      } catch (e) {
        console.error('Failed to capture frame', e);
      }
    }
  }, []);

  const executeSeek = useCallback(() => {
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    const deltaToApply = accumulatedSeekRef.current;
    if (deltaToApply === 0) return;
    
    accumulatedSeekRef.current = 0;

    if (isStreamingVideo) {
      captureFrame();
      setSeekOffset(prev => {
        const dur = item?.duration || (videoRef.current ? videoRef.current.duration : Infinity);
        const currentAbs = prev + (videoRef.current?.currentTime || 0);
        return Math.max(0, Math.min(dur, currentAbs + deltaToApply));
      });
    } else if (videoRef.current) {
      videoRef.current.currentTime += deltaToApply;
    }
  }, [isStreamingVideo, item?.duration, captureFrame]);

  const applySeek = useCallback((delta: number) => {
    accumulatedSeekRef.current += delta;
    const totalDelta = accumulatedSeekRef.current;
    showToast(`Seek ${totalDelta > 0 ? '+' : ''}${totalDelta}s`);

    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
    seekTimeoutRef.current = setTimeout(executeSeek, 600);
  }, [executeSeek, showToast]);

  // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
          return;
        }
  
        if (e.key === 'Escape') onClose();
        
        if (e.key === 'ArrowLeft') {
          if (item?.type === 'video' && (e.shiftKey || e.ctrlKey || e.altKey)) {
            e.preventDefault();
            if (e.repeat) isHoldingSeekRef.current = true;
            applySeek(-5);
          } else {
            triggerSwipe(-1);
          }
        }
        
        if (e.key === 'ArrowRight') {
          if (item?.type === 'video' && (e.shiftKey || e.ctrlKey || e.altKey)) {
            e.preventDefault();
            if (e.repeat) isHoldingSeekRef.current = true;
            applySeek(5);
          } else {
            triggerSwipe(1);
          }
        }

        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.error(err));
          } else {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
          }
        }

        if (item?.type === 'video') {
          if (e.key === ' ' || e.key.toLowerCase() === 'k') {
            e.preventDefault();
            togglePlay();
          }
          if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            toggleMute();
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setVolume(v => {
              const newVol = Math.min(1, v + 0.1);
              if (videoRef.current) videoRef.current.volume = newVol;
              showToast(`Volume: ${Math.round(newVol * 100)}%`);
              return newVol;
            });
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setVolume(v => {
              const newVol = Math.max(0, v - 0.1);
              if (videoRef.current) videoRef.current.volume = newVol;
              showToast(`Volume: ${Math.round(newVol * 100)}%`);
              return newVol;
            });
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (accumulatedSeekRef.current !== 0) {
            if (isHoldingSeekRef.current) {
              executeSeek();
              isHoldingSeekRef.current = false;
            } else {
              if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
              seekTimeoutRef.current = setTimeout(executeSeek, 300);
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [currentIndex, items.length, onClose, onNavigate, item, togglePlay, toggleMute, applySeek, executeSeek]);

  // Image Dragging & Touch Gestures
  const hasDraggedRef = useRef(false);
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    initialDistance: 0,
    initialScale: 1,
    isPinching: false,
    isSwipingX: false,
    isSwipingY: false,
    startTime: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    hasDraggedRef.current = false;
    if (scale <= 1) return;
    setIsDragging(true);
    setIsTracking(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    hasDraggedRef.current = true;
    const { maxX, maxY } = getBounds(scale);
    const rawX = e.clientX - dragStartRef.current.x;
    const rawY = e.clientY - dragStartRef.current.y;
    setPosition({
      x: applyRubberBand(rawX, maxX),
      y: applyRubberBand(rawY, maxY)
    });
  };
  const handleMouseUp = () => {
    if (isDragging) setPosition(prev => clampPosition(prev, scale));
    setIsDragging(false);
    setIsTracking(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Instantly resolve any pending swipe animation if the user touches again rapidly
    let resumedX = 0;
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = null;
      if (pendingNavigateRef.current !== null) {
        if (trackRef.current) {
          const style = window.getComputedStyle(trackRef.current);
          if (style.transform && style.transform !== 'none') {
            const matrix = new DOMMatrix(style.transform);
            const currentX = matrix.m41;
            if (pendingNavigateRef.current > currentIndex) resumedX = currentX + window.innerWidth;
            else if (pendingNavigateRef.current < currentIndex) resumedX = currentX - window.innerWidth;
          }
        }
        flushSync(() => {
          setSwipeOffset({ x: resumedX, y: 0 });
          onNavigate(pendingNavigateRef.current!);
        });
        pendingNavigateRef.current = null;
      }
    }

    hasDraggedRef.current = false;
    setIsTracking(true);
    const touches = e.touches;
    touchStateRef.current.startTime = Date.now();
    touchStateRef.current.isSwipingX = false;
    touchStateRef.current.isSwipingY = false;
    
    if (touches.length === 1) {
      touchStateRef.current.startX = touches[0].clientX - resumedX;
      touchStateRef.current.startY = touches[0].clientY;
      touchStateRef.current.lastX = touches[0].clientX;
      touchStateRef.current.lastY = touches[0].clientY;
      touchStateRef.current.isPinching = false;
      
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = { x: touches[0].clientX - position.x, y: touches[0].clientY - position.y };
      }

      if (resumedX !== 0) {
        touchStateRef.current.isSwipingX = true;
        setSwipeOffset({ x: resumedX, y: 0 });
      } else {
        setSwipeOffset({ x: 0, y: 0 });
      }
    } else if (touches.length === 2 && item?.type === 'image') {
      touchStateRef.current.isPinching = true;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      touchStateRef.current.initialDistance = Math.hypot(dx, dy);
      touchStateRef.current.initialScale = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touches = e.touches;
    if (touches.length === 1 && !touchStateRef.current.isPinching) {
      touchStateRef.current.lastX = touches[0].clientX;
      touchStateRef.current.lastY = touches[0].clientY;
      
      const dx = touches[0].clientX - touchStateRef.current.startX;
      const dy = touches[0].clientY - touchStateRef.current.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      if (absDx > 5 || absDy > 5) {
        hasDraggedRef.current = true;
      }
      
      if (scale <= 1 && !touchStateRef.current.isSwipingX && !touchStateRef.current.isSwipingY) {
        if (absDx > 10 && absDy < 30) touchStateRef.current.isSwipingX = true;
        else if (absDy > 10 && absDx < 30) touchStateRef.current.isSwipingY = true;
      }
      
      if (touchStateRef.current.isSwipingX) {
        let actualDx = dx;
        // Rubber band resistance if no prev/next
        if ((dx > 0 && currentIndex === 0) || (dx < 0 && currentIndex === items.length - 1)) {
          actualDx = dx * 0.3;
        }
        setSwipeOffset({ x: actualDx, y: 0 });
      } else if (touchStateRef.current.isSwipingY) {
        setSwipeOffset({ x: 0, y: Math.max(0, dy) }); // Only allow swipe down to close
      } else if (isDragging && scale > 1) {
        const { maxX, maxY } = getBounds(scale);
        const rawX = touches[0].clientX - dragStartRef.current.x;
        const rawY = touches[0].clientY - dragStartRef.current.y;
        setPosition({
          x: applyRubberBand(rawX, maxX),
          y: applyRubberBand(rawY, maxY)
        });
      }
    } else if (touches.length === 2 && touchStateRef.current.isPinching) {
      hasDraggedRef.current = true;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const newDistance = Math.hypot(dx, dy);
      const ratio = newDistance / Math.max(1, touchStateRef.current.initialDistance);
      
      const origScale = getOriginalScale();
      const minScale = Math.min(1, origScale);
      const newScale = Math.min(Math.max(minScale, touchStateRef.current.initialScale * ratio), 10);
      updateZoom(newScale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isDragging) setPosition(prev => clampPosition(prev, scale));
    setIsDragging(false);
    if (touchStateRef.current.isPinching) {
      if (e.touches.length === 0) touchStateRef.current.isPinching = false;
      setIsTracking(false);
      return;
    }
    
    if (touchStateRef.current.isSwipingX) {
      const dx = touchStateRef.current.lastX - touchStateRef.current.startX;
      const absDx = Math.abs(dx);
      const timeElapsed = Date.now() - touchStateRef.current.startTime;
      const velocity = absDx / timeElapsed;
      
      // Fluid swipe navigation
      if (absDx > window.innerWidth / 6 || velocity > 0.3) {
        let direction = 0;
        if (dx > 0 && currentIndex > 0) direction = -1; // Prev
        else if (dx < 0 && currentIndex < items.length - 1) direction = 1; // Next
        
        if (direction === -1) {
          setIsTracking(false); // Enable transition for slide out
          setSwipeOffset({ x: window.innerWidth, y: 0 }); // Slide out right
          pendingNavigateRef.current = currentIndex - 1;
        } else if (direction === 1) {
          setIsTracking(false); // Enable transition for slide out
          setSwipeOffset({ x: -window.innerWidth, y: 0 }); // Slide out left
          pendingNavigateRef.current = currentIndex + 1;
        }
        
        if (direction !== 0) {
          const remainingDistance = window.innerWidth - absDx;
          const timeToFinish = velocity > 0 ? remainingDistance / velocity : 300;
          const duration = Math.max(150, Math.min(timeToFinish, 400));
          setSwipeDuration(duration);

          swipeTimeoutRef.current = setTimeout(() => {
            if (pendingNavigateRef.current !== null) {
              setIsTracking(true); // Disable transition for jump
              flushSync(() => {
                setSwipeOffset({ x: 0, y: 0 }); // Snap back to center instantly
                onNavigate(pendingNavigateRef.current!);
              });
              pendingNavigateRef.current = null;
            }
            swipeTimeoutRef.current = null;
          }, duration);
          touchStateRef.current.isSwipingX = false;
          return;
        }
      }
      
      setIsTracking(false);
      setSwipeOffset({ x: 0, y: 0 });
      touchStateRef.current.isSwipingX = false;
    } else if (touchStateRef.current.isSwipingY) {
      const dy = touchStateRef.current.lastY - touchStateRef.current.startY;
      if (dy > window.innerHeight / 6 || dy / (Date.now() - touchStateRef.current.startTime) > 0.3) {
        onClose();
      }
      setIsTracking(false);
      setSwipeOffset({ x: 0, y: 0 });
      touchStateRef.current.isSwipingY = false;
    } else {
      setIsTracking(false);
    }
    
    // Tap logic is now fully handled by standard onClick (handleContentClick)
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) return;
    
    // Don't toggle UI on video click (it toggles play/pause instead)
    if ((e.target as HTMLElement).tagName === 'VIDEO') return;

    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
      setIsIdle(prev => !prev);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (item?.type !== 'image') return;
    
    const now = Date.now();
    if (now - lastWheelTimeRef.current > 200) {
      accumulatedWheelRef.current = 0;
      isSnappedRef.current = false;
    }
    lastWheelTimeRef.current = now;

    if (isSnappedRef.current) {
      accumulatedWheelRef.current += e.deltaY;
      if (Math.abs(accumulatedWheelRef.current) < 150) {
        return;
      }
      // Broke out of snap
      isSnappedRef.current = false;
      accumulatedWheelRef.current = 0;
    }
    
    const origScale = getOriginalScale();
    const minScale = Math.min(1, origScale);
    
    // Logarithmic zooming
    const zoomFactor = Math.exp(-e.deltaY * 0.002);
    let newScale = scale * zoomFactor;

    // Snap to 1 when crossing
    if (scale < 1 && newScale >= 1) {
      newScale = 1;
      isSnappedRef.current = true;
      accumulatedWheelRef.current = 0;
    } else if (scale > 1 && newScale <= 1) {
      newScale = 1;
      isSnappedRef.current = true;
      accumulatedWheelRef.current = 0;
    }

    newScale = Math.min(Math.max(minScale, newScale), 10);
    updateZoom(newScale);
  };

  // Video Controls
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const dur = item.duration || videoRef.current.duration;
      if (!dur || dur === Infinity) return;
      // Absolute time relative to the original file
      const currentAbsoluteTime = isStreamingVideo ? (seekOffset + videoRef.current.currentTime) : videoRef.current.currentTime;
      setProgress((currentAbsoluteTime / dur) * 100);
    }
  };
  
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const dur = item.duration || (videoRef.current ? videoRef.current.duration : 0);
    if (!dur || dur === Infinity) return;
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newTime = pos * dur;
      
      if (isStreamingVideo) {
        captureFrame();
        setSeekOffset(newTime);
      } else {
        videoRef.current.currentTime = newTime;
      }
      setProgress(pos * 100);
    }
  };

  if (!item) return null;

  const renderMediaContent = (mediaItem: MediaItem | undefined, offset: number) => {
    if (!mediaItem) return null;
    
    const isCurrent = offset === 0;
    const itemIsStreaming = mediaItem.type === 'video';
    const itemMediaUrl = itemIsStreaming 
      ? `http://localhost:4000/?path=${encodeURIComponent(mediaItem.filepath)}&startTime=${isCurrent ? seekOffset : 0}`
      : `media://${encodeURIComponent(mediaItem.filepath)}`;
      
    if (mediaItem.type === 'video') {
      return (
        <>
          <video
            ref={isCurrent ? videoRef : undefined}
            src={itemMediaUrl}
            poster={`media://${encodeURIComponent(mediaItem.thumbnail_path)}`}
            crossOrigin="anonymous"
            autoPlay={isCurrent}
            loop={isCurrent ? !isSlideshow : false}
            onEnded={isCurrent ? handleVideoEnded : undefined}
            onTimeUpdate={isCurrent ? handleTimeUpdate : undefined}
            onLoadedData={isCurrent ? () => setFreezeFrameUrl(null) : undefined}
            onSeeked={isCurrent ? () => setFreezeFrameUrl(null) : undefined}
            onPlaying={isCurrent ? () => setFreezeFrameUrl(null) : undefined}
            onClick={isCurrent ? togglePlay : undefined}
            className={clsx(
              "absolute inset-0 w-full h-full", 
              defaultSize === 'original' ? 'object-none' : 'object-contain', 
              isIdle && "cursor-none",
              !isTracking && "transition-transform duration-200 ease-out"
            )}
            style={{ 
              opacity: isCurrent && swipeOffset.y > 0 ? 1 - (swipeOffset.y / window.innerHeight) : 1,
              viewTransitionName: isCurrent ? `media-${mediaItem.id}` : undefined
            } as React.CSSProperties}
          />
          {isCurrent && freezeFrameUrl && (
            <img 
              src={freezeFrameUrl} 
              alt="frozen frame"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}
        </>
      );
    } else {
      return (
        <img
          ref={isCurrent ? imgRef : undefined}
          src={itemMediaUrl}
          alt={mediaItem.filename}
          draggable={false}
          onLoad={isCurrent ? handleImageLoad : undefined}
          style={{ 
            transform: isCurrent ? `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)` : undefined,
            cursor: isCurrent ? (isIdle ? 'none' : (scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default')) : 'default',
            opacity: isCurrent && swipeOffset.y > 0 ? 1 - (swipeOffset.y / window.innerHeight) : 1,
            viewTransitionName: isCurrent ? `media-${mediaItem.id}` : undefined
          } as React.CSSProperties}
          className={clsx(
            "absolute inset-0 w-full h-full object-contain",
            !isTracking && "transition-transform duration-200 ease-out"
          )}
        />
      );
    }
  };

  return (
    <div className={clsx("fixed inset-0 z-[100] flex bg-black overflow-hidden transition-all duration-500", isIdle && "cursor-none")}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 text-white px-4 py-2 rounded-full shadow-2xl font-medium text-sm">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div 
        className="flex-1 relative flex items-center justify-center bg-black group overflow-hidden touch-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleContentClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={trackRef}
          className={clsx(
            "absolute inset-0 w-full h-full flex",
            isTracking ? "transition-none" : "ease-out"
          )}
          style={{ 
            transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
            transitionProperty: isTracking ? 'none' : 'transform',
            transitionDuration: isTracking ? '0ms' : `${swipeDuration}ms`
          }}
        >
          {[
            currentIndex > 0 ? { mediaItem: items[currentIndex - 1], offset: -1 } : null,
            { mediaItem: item, offset: 0 },
            currentIndex < items.length - 1 ? { mediaItem: items[currentIndex + 1], offset: 1 } : null
          ].map(entry => {
            if (!entry) return null;
            const { mediaItem, offset } = entry;
            return (
              <div 
                key={mediaItem.id} 
                className={clsx(
                  "absolute inset-0 w-full h-full",
                  offset === -1 ? "-translate-x-full" : offset === 1 ? "translate-x-full" : ""
                )}
              >
                {renderMediaContent(mediaItem, offset)}
              </div>
            );
          })}
        </div>

        {/* Top Header Controls */}
        <div className={clsx("absolute top-0 inset-x-0 p-6 flex justify-between items-start transition-opacity duration-300 pointer-events-none z-30 bg-gradient-to-b from-black/80 to-transparent pb-12", isIdle && "opacity-0")}>
          <div className="flex items-center gap-4 pointer-events-auto">
            <InteractiveButton
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white  shadow-lg"
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
                <InteractiveButton onClick={() => updateZoom(Math.min(scale * 1.5, 10))} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
                  <ZoomIn className="w-4 h-4" />
                </InteractiveButton>
                <InteractiveButton onClick={() => {
                  const origScale = getOriginalScale();
                  updateZoom(Math.max(scale / 1.5, Math.min(1, origScale)));
                }} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
                  <ZoomOut className="w-4 h-4" />
                </InteractiveButton>
                <div className="w-px h-6 bg-white/20 my-auto mx-1" />
                <InteractiveButton onClick={() => handleAction('rotate')} title="Rotate" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
                  <RotateCw className="w-4 h-4" />
                </InteractiveButton>
                <InteractiveButton onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(err => console.error(err));
                  } else {
                    document.documentElement.requestFullscreen().catch(err => console.error(err));
                  }
                }} title="Fullscreen" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
                  <Expand className="w-4 h-4" />
                </InteractiveButton>
                <InteractiveButton onClick={() => handleAction('wallpaper')} title="Set as Wallpaper" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
                  <Monitor className="w-4 h-4" />
                </InteractiveButton>
              </>
            )}
            
            <InteractiveButton onClick={() => handleAction('share')} title="Copy to Clipboard" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </InteractiveButton>
            <InteractiveButton onClick={() => handleAction('reveal')} title="Reveal in Explorer" className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white ">
              <FolderOpen className="w-4 h-4" />
            </InteractiveButton>
            
            <div className="w-px h-6 bg-white/20 my-auto mx-1" />
            
            <InteractiveButton onClick={() => { setIsInfoOpen(!isInfoOpen); if (!isInfoOpen) setIsSidebarOpen(false); }} className={clsx("p-3 backdrop-blur-md rounded-full text-white ", isInfoOpen ? "bg-indigo-500 hover:bg-indigo-600" : "bg-white/10 hover:bg-white/20")} title="Info">
              <Info className="w-4 h-4" />
            </InteractiveButton>

            <InteractiveButton onClick={() => { setIsSidebarOpen(!isSidebarOpen); if (!isSidebarOpen) setIsInfoOpen(false); }} className={clsx("p-3 backdrop-blur-md rounded-full text-white ", isSidebarOpen ? "bg-indigo-500 hover:bg-indigo-600" : "bg-white/10 hover:bg-white/20")} title="Tags">
              <TagIcon className="w-4 h-4" />
            </InteractiveButton>
            
            <InteractiveButton onClick={() => handleAction('delete')} className="p-3 bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-md rounded-full  ml-2" title="Delete">
              <Trash2 className="w-4 h-4" />
            </InteractiveButton>
          </div>
        </div>

        {/* Video Controls Footer */}
        {item.type === 'video' && (
          <div className={clsx("absolute bottom-0 inset-x-0 p-4 transition-opacity duration-300 z-30 bg-gradient-to-t from-black via-black/80 to-transparent pt-16", isIdle && "opacity-0")}>
            <div className="w-full flex items-center gap-4">
              <InteractiveButton onClick={togglePlay} className="text-white hover:text-indigo-400 drop-shadow-md">
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </InteractiveButton>
              
              <div className="text-xs text-zinc-300 font-mono w-24 text-center">
                {(() => {
                  const dur = item.duration || (videoRef.current ? videoRef.current.duration : 0);
                  const currentSec = (progress / 100) * dur;
                  const format = (s: number) => {
                    if (isNaN(s) || s === Infinity) return '0:00';
                    const h = Math.floor(s / 3600);
                    const m = Math.floor((s % 3600) / 60);
                    const sec = Math.floor(s % 60);
                    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                    return `${m}:${sec.toString().padStart(2, '0')}`;
                  };
                  return `${format(currentSec)} / ${format(dur)}`;
                })()}
              </div>
              
              <div 
                className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative overflow-hidden group/seek shadow-inner"
                onClick={handleSeek}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-indigo-500 group-hover/seek:bg-indigo-400 "
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-black/40 transition-all cursor-pointer relative group/volume">
                <InteractiveButton onClick={toggleMute} className="text-white hover:text-indigo-400 drop-shadow-md">
                  {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </InteractiveButton>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-9 h-28 opacity-0 pointer-events-none scale-95 origin-bottom group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto group-hover/volume:scale-100 transition-all duration-300 flex justify-center items-center bg-black/60 rounded-full py-3 shadow-lg backdrop-blur-sm z-50">
                  <div className="absolute -bottom-4 left-0 right-0 h-6 bg-transparent" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      const newVol = parseFloat(e.target.value);
                      setVolume(newVol);
                      if (videoRef.current) {
                        videoRef.current.volume = newVol;
                      }
                    }}
                    className="w-20 h-1.5 -rotate-90 origin-center accent-indigo-500 bg-white/20 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
              </div>
              <InteractiveButton onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(err => console.error(err));
                } else {
                  document.documentElement.requestFullscreen().catch(err => console.error(err));
                }
              }} className="text-white hover:text-indigo-400 drop-shadow-md">
                <Expand className="w-5 h-5" />
              </InteractiveButton>
            </div>
          </div>
        )}

        {/* Slideshow HUD */}
        {isSlideshow && (
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
        )}
      {/* Navigation Overlays */}
      {currentIndex > 0 && (
        <div className="absolute inset-y-0 left-0 w-32 flex items-center justify-start pl-6 group/navleft z-20">
          <InteractiveButton
            onClick={(e) => { e.stopPropagation(); triggerSwipe(-1); }}
            className={clsx(
              "group p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 shadow-lg rounded-full text-white transition-all pointer-events-auto",
              isIdle ? "opacity-0" : "opacity-0 group-hover/navleft:opacity-100"
            )}
          >
            <ChevronLeft className="w-8 h-8 transition-transform duration-300 group-hover:-translate-x-1" />
          </InteractiveButton>
        </div>
      )}
      {currentIndex < items.length - 1 && (
        <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-end pr-6 group/navright z-20">
          <InteractiveButton
            onClick={(e) => { e.stopPropagation(); triggerSwipe(1); }}
            className={clsx(
              "group p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 shadow-lg rounded-full text-white transition-all pointer-events-auto",
              isIdle ? "opacity-0" : "opacity-0 group-hover/navright:opacity-100"
            )}
          >
            <ChevronRight className="w-8 h-8 transition-transform duration-300 group-hover:translate-x-1" />
          </InteractiveButton>
        </div>
      )}
    </div>

      {/* Right Sidebar (Info) */}
      <div className={clsx(
        "absolute top-0 bottom-0 right-0 w-80 bg-black/80 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-2xl z-50 transition-all duration-300 ease-out",
        isInfoOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
      )}>
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-400" />
                Info
              </h3>
              <InteractiveButton onClick={() => setIsInfoOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </InteractiveButton>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar text-sm">
            <div className="space-y-4">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Filename</p>
                <p className="text-zinc-200 break-all">{item.filename}</p>
              </div>
              
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Path</p>
                <p className="text-zinc-200 break-all text-xs opacity-70">{item.filepath}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Type</p>
                  <p className="text-zinc-200 capitalize">{item.type}</p>
                </div>
                
                {item.created_at && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Date</p>
                    <p className="text-zinc-200">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-zinc-400 font-medium border-b border-white/5 pb-2">Properties</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Dimensions</p>
                  <p className="text-zinc-200">{(item.width && item.height) ? `${item.width} × ${item.height}` : 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Size</p>
                  <p className="text-zinc-200">
                    {item.size ? (
                      item.size < 1024 ? item.size + ' B' :
                      item.size < 1024 * 1024 ? (item.size / 1024).toFixed(1) + ' KB' :
                      item.size < 1024 * 1024 * 1024 ? (item.size / (1024 * 1024)).toFixed(1) + ' MB' :
                      (item.size / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
                    ) : 'Unknown'}
                  </p>
                </div>
                {item.duration ? (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Duration</p>
                    <p className="text-zinc-200">{Math.round(item.duration)}s</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      {/* Right Sidebar (Tags) */}
      <div className={clsx(
        "absolute top-0 bottom-0 right-0 w-80 bg-black/80 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-2xl z-50 transition-all duration-300 ease-out",
        isSidebarOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
      )}>
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-indigo-400" />
                Tags
              </h3>
              <InteractiveButton onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </InteractiveButton>
            </div>
            
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag and press Enter..."
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-wrap gap-2 content-start custom-scrollbar">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-sm text-zinc-300  group cursor-default"
              >
                {tag.name}
                <InteractiveButton
                  onClick={() => handleRemoveTag(tag.id)}
                  className="text-zinc-500 hover:text-red-400 focus:outline-none p-0.5 rounded "
                >
                  <X className="w-3.5 h-3.5" />
                </InteractiveButton>
              </span>
            ))}
            {tags.length === 0 && (
              <div className="flex flex-col items-center justify-center w-full mt-10 text-zinc-600 gap-3">
                <TagIcon className="w-8 h-8 opacity-20" />
                <p className="text-sm">No tags added yet</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
