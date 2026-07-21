import { useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { MediaItem } from './types';

export function useSwipeTrack(
  items: MediaItem[],
  currentIndex: number,
  onNavigate: (index: number) => void,
  onClose: () => void,
  defaultSize: 'original' | 'fit'
) {
  const item = items[currentIndex];
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [isTracking, setIsTracking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDuration, setSwipeDuration] = useState(300);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStateRef = useRef({
    startX: 0, startY: 0,
    lastX: 0, lastY: 0,
    startTime: 0,
    isSwipingX: false, isSwipingY: false,
    isPinching: false,
    initialDistance: 0, initialScale: 1
  });
  const hasDraggedRef = useRef(false);
  const pendingNavigateRef = useRef<number | null>(null);
  const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getOriginalScale = useCallback(() => {
    if (!item || !item.width || !item.height) return 1;
    if (defaultSize === 'original') return 1;
    const windowRatio = window.innerWidth / window.innerHeight;
    const imageRatio = item.width / item.height;
    if (imageRatio > windowRatio) {
      return window.innerWidth / item.width;
    } else {
      return window.innerHeight / item.height;
    }
  }, [item, defaultSize]);

  const getBounds = useCallback((currentScale: number) => {
    if (!item || !item.width || !item.height) return { maxX: 0, maxY: 0 };
    
    let baseWidth = window.innerWidth;
    let baseHeight = window.innerHeight;
    
    if (defaultSize === 'fit') {
      const windowRatio = window.innerWidth / window.innerHeight;
      const imageRatio = item.width / item.height;
      if (imageRatio > windowRatio) {
        baseWidth = window.innerWidth;
        baseHeight = window.innerWidth / imageRatio;
      } else {
        baseHeight = window.innerHeight;
        baseWidth = window.innerHeight * imageRatio;
      }
    } else {
      baseWidth = item.width;
      baseHeight = item.height;
    }

    const scaledWidth = baseWidth * currentScale;
    const scaledHeight = baseHeight * currentScale;

    const maxX = Math.max(0, (scaledWidth - window.innerWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - window.innerHeight) / 2);

    return { maxX, maxY };
  }, [item, defaultSize]);

  const clampPosition = useCallback((pos: {x: number, y: number}, currentScale: number) => {
    const { maxX, maxY } = getBounds(currentScale);
    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y))
    };
  }, [getBounds]);

  const updateZoom = useCallback((newScale: number, clientX?: number, clientY?: number) => {
    if (!item || item.type !== 'image') return;
    
    setScale(prevScale => {
      const minScale = Math.min(1, getOriginalScale());
      const clampedScale = Math.max(minScale, Math.min(newScale, 10));
      
      if (clampedScale <= 1.01 && clampedScale >= 0.99) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }

      if (clientX !== undefined && clientY !== undefined) {
        setPosition(prevPos => {
          const cx = clientX - window.innerWidth / 2;
          const cy = clientY - window.innerHeight / 2;
          const scaleRatio = clampedScale / prevScale;
          
          const newX = cx - (cx - prevPos.x) * scaleRatio;
          const newY = cy - (cy - prevPos.y) * scaleRatio;
          
          return clampPosition({ x: newX, y: newY }, clampedScale);
        });
      } else {
        setPosition(prev => clampPosition(prev, clampedScale));
      }
      
      return clampedScale;
    });
  }, [item, getOriginalScale, clampPosition]);

  const applyRubberBand = (value: number, max: number) => {
    if (Math.abs(value) <= max) return value;
    const excess = Math.abs(value) - max;
    const sign = Math.sign(value);
    const dampening = 0.3; // Magic number for standard rubber band feel
    return sign * (max + excess * dampening);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!item || item.type !== 'image') return;
    e.preventDefault();
    
    // Always zoom on wheel/pinch
    const zoomSensitivity = 0.005;
    const delta = -e.deltaY;
    const newScale = scale * Math.exp(delta * zoomSensitivity);
    updateZoom(newScale, e.clientX, e.clientY);
  }, [item, scale, updateZoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || scale <= 1 || item?.type !== 'image') return;
    e.preventDefault();
    hasDraggedRef.current = false;
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
        if ((dx > 0 && currentIndex === 0) || (dx < 0 && currentIndex === items.length - 1)) {
          actualDx = dx * 0.3;
        }
        setSwipeOffset({ x: actualDx, y: 0 });
      } else if (touchStateRef.current.isSwipingY) {
        setSwipeOffset({ x: 0, y: Math.max(0, dy) });
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
      
      if (absDx > window.innerWidth / 6 || velocity > 0.3) {
        let direction = 0;
        if (dx > 0 && currentIndex > 0) direction = -1;
        else if (dx < 0 && currentIndex < items.length - 1) direction = 1;
        
        if (direction === -1) {
          setIsTracking(false);
          setSwipeOffset({ x: window.innerWidth, y: 0 });
          pendingNavigateRef.current = currentIndex - 1;
        } else if (direction === 1) {
          setIsTracking(false);
          setSwipeOffset({ x: -window.innerWidth, y: 0 });
          pendingNavigateRef.current = currentIndex + 1;
        }
        
        if (direction !== 0) {
          const remainingDistance = window.innerWidth - absDx;
          const timeToFinish = velocity > 0 ? remainingDistance / velocity : 300;
          const duration = Math.max(150, Math.min(timeToFinish, 400));
          setSwipeDuration(duration);

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
  };

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  return {
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
  };
}
