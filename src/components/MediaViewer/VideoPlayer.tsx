import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { Play, Pause, Volume2, VolumeX, Expand } from 'lucide-react';
import { InteractiveButton } from '../InteractiveButton';
import { MediaItem } from './types';

export function VideoPlayer({
  item,
  isCurrent,
  isIdle,
  isTracking,
  swipeOffset,
  isSlideshow,
  defaultSize,
  onVideoEnded
}: {
  item: MediaItem;
  isCurrent: boolean;
  isIdle: boolean;
  isTracking: boolean;
  swipeOffset: { x: number, y: number };
  isSlideshow: boolean;
  defaultSize: 'original' | 'fit';
  onVideoEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [freezeFrameUrl, setFreezeFrameUrl] = useState<string | null>(null);
  const [startTimeOffset, setStartTimeOffset] = useState(0);

  // Reset offset when item changes
  useEffect(() => {
    setStartTimeOffset(0);
    setProgress(0);
  }, [item.id]);

  // Sync isPlaying with actual video element
  useEffect(() => {
    if (isCurrent && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, isCurrent, item.id, startTimeOffset]);

  // Pause all inactive videos
  useEffect(() => {
    if (!isCurrent && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isCurrent]);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      const newVol = volume > 0 ? 0 : 1;
      videoRef.current.volume = newVol;
      setVolume(newVol);
    }
  }, [volume]);

  useEffect(() => {
    if (!isCurrent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const dur = item.duration;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume(prev => {
          const next = Math.min(1, prev + 0.1);
          if (videoRef.current) videoRef.current.volume = next;
          return next;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume(prev => {
          const next = Math.max(0, prev - 0.1);
          if (videoRef.current) videoRef.current.volume = next;
          return next;
        });
      } else if (e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (!dur) return;
        if (videoRef.current) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              setFreezeFrameUrl(canvas.toDataURL());
            }
          } catch (err) {}

          const current = startTimeOffset + videoRef.current.currentTime;
          const newTime = Math.min(dur, current + 5);
          setStartTimeOffset(newTime);
          setProgress((newTime / dur) * 100);
        }
      } else if (e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!dur) return;
        if (videoRef.current) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              setFreezeFrameUrl(canvas.toDataURL());
            }
          } catch (err) {}

          const current = startTimeOffset + videoRef.current.currentTime;
          const newTime = Math.max(0, current - 5);
          setStartTimeOffset(newTime);
          setProgress((newTime / dur) * 100);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCurrent, togglePlay, toggleMute, startTimeOffset, item.duration]);

  // toggleMute was moved up

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const dur = item.duration;
      if (!dur) return;
      const current = startTimeOffset + videoRef.current.currentTime;
      const p = Math.min((current / dur) * 100, 100);
      setProgress(p || 0);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const dur = item.duration;
    if (!dur) return;
    if (videoRef.current) {
      // Capture current frame before seeking to prevent black screen flash
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          setFreezeFrameUrl(canvas.toDataURL());
        }
      } catch (err) {
        // Ignore cross-origin canvas errors if they happen
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = pos * dur;
      setStartTimeOffset(newTime);
      setProgress(pos * 100);
    }
  };

  const itemMediaUrl = `http://localhost:4000/?path=${encodeURIComponent(item.filepath)}&startTime=${startTimeOffset}`;

  return (
    <>
      <video
        ref={videoRef}
        src={itemMediaUrl}
        poster={`media://${encodeURIComponent(item.thumbnail_path)}`}
        crossOrigin="anonymous"
        autoPlay={isCurrent}
        loop={isCurrent ? !isSlideshow : false}
        onEnded={isCurrent ? onVideoEnded : undefined}
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
          viewTransitionName: isCurrent ? `media-${item.id}` : undefined
        } as React.CSSProperties}
      />
      {isCurrent && freezeFrameUrl && (
        <img 
          src={freezeFrameUrl} 
          alt="frozen frame"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      )}

      {isCurrent && (
        <div className={clsx("absolute bottom-0 inset-x-0 p-4 transition-opacity duration-300 z-30 bg-gradient-to-t from-black via-black/80 to-transparent pt-16 pointer-events-none", isIdle && "opacity-0")}>
          <div className="w-full flex items-center gap-4 pointer-events-auto">
            <InteractiveButton onClick={togglePlay} className="text-white hover:text-indigo-400 drop-shadow-md">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </InteractiveButton>
            
            <div className="text-xs text-zinc-300 font-mono w-24 text-center">
              {(() => {
                const dur = item.duration || 0;
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
                className="absolute left-0 top-0 bottom-0 bg-indigo-500 group-hover/seek:bg-indigo-400"
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
    </>
  );
}
