import React from 'react';
import clsx from 'clsx';
import { MediaItem } from './types';

export function ImageViewer({
  item,
  isCurrent,
  isIdle,
  scale,
  position,
  swipeOffset,
  isTracking,
  isDragging,
  defaultSize
}: {
  item: MediaItem;
  isCurrent: boolean;
  isIdle: boolean;
  scale: number;
  position: { x: number; y: number };
  swipeOffset: { x: number; y: number };
  isTracking: boolean;
  isDragging: boolean;
  defaultSize: 'original' | 'fit';
}) {
  const itemMediaUrl = `media://${encodeURIComponent(item.filepath)}`;

  return (
    <img
      src={itemMediaUrl}
      alt={item.filename}
      className={clsx(
        "absolute inset-0 w-full h-full", 
        defaultSize === 'original' ? 'object-none' : 'object-contain', 
        isIdle && "cursor-none",
        isCurrent && isDragging ? 'cursor-grabbing' : (isCurrent && scale > 1 ? 'cursor-grab' : '')
      )}
      style={{
        transform: isCurrent ? `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})` : 'none',
        transition: (!isTracking && !isDragging) ? 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
        opacity: isCurrent && swipeOffset.y > 0 ? 1 - (swipeOffset.y / window.innerHeight) : 1,
        willChange: isCurrent ? 'transform' : 'auto',
        viewTransitionName: isCurrent ? `media-${item.id}` : undefined
      } as React.CSSProperties}
      draggable={false}
    />
  );
}
