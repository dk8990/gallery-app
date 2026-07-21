"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { flushSync } from 'react-dom';
import { Sidebar, FolderNode } from "@/components/Sidebar";
import { DynamicDropdown } from "@/components/DynamicDropdown";
import { useMasonry, useVirtualMasonry } from "@/components/useMasonry";
import { PlayCircle, Settings, X, Plus, Trash2, Filter, ArrowUpDown, Play, Shuffle, Search, CheckCircle2, Circle, Copy, Tag } from "lucide-react";
import { MediaViewer } from "@/components/MediaViewer";
import { InteractiveButton } from "@/components/InteractiveButton";
import clsx from "clsx";
import { useRouter } from "next/navigation";

type MediaItem = {
  id: number;
  filepath: string;
  filename: string;
  type: string;
  thumbnail_path: string;
  width: number;
  height: number;
  created_at: string;
  size: number;
  duration: number;
  _ts?: number;
};

type DirectoryItem = {
  id: number;
  path: string;
};

export default function Home() {
  const router = useRouter();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeMediaId, setActiveMediaId] = useState<number | null>(null);
  const [transitionId, setTransitionId] = useState<number | null>(null);
  
  const viewerIndex = useMemo(() => {
    if (activeMediaId === null) return null;
    const idx = mediaItems.findIndex(m => m.id === activeMediaId);
    return idx !== -1 ? idx : null;
  }, [activeMediaId, mediaItems]);
  
  // Selection state
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<number>>(new Set());
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isTagAdded, setIsTagAdded] = useState(false);
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
  
  // Folder tree state
  const [activeFolder, setActiveFolderState] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activeFolder') || '';
    }
    return '';
  });

  const setActiveFolder = (path: string) => {
    setActiveFolderState(path);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('activeFolder', path);
    }
  };
  
  // Header state
  const [filterType, setFilterType] = useState<'All' | 'video' | 'image'>('All');
  const [sortBy, setSortBy] = useState<'Newest' | 'Oldest' | 'Largest' | 'Smallest' | 'Random'>('Newest');
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'filter' | 'sort' | 'slideshow' | 'date' | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [scanningDirectories, setScanningDirectories] = useState<string[]>([]);

  const fetchMedia = useCallback(async (pageNum = 1, append = false) => {
    if (!window.electronAPI) return;
    try {
      setIsLoading(true);
      const data = await window.electronAPI.getMedia(pageNum, 50, debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate);
      if (append) {
        setMediaItems(prev => {
          const newItems = data.items.filter(i => !prev.some(p => p.id === i.id));
          return [...prev, ...newItems];
        });
      } else {
        setMediaItems(data.items);
      }
      setTotal(data.total);
      setPage(data.page);
      setHasMore(data.page < data.totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate]);

  const fetchDirectories = useCallback(async () => {
    if (!window.electronAPI) return;
    const [dirRes, folderRes] = await Promise.all([
      window.electronAPI.getDirectories(),
      window.electronAPI.getFolders()
    ]);
    if (dirRes.success) setDirectories(dirRes.directories);
    if (folderRes.success) setFolders(folderRes.folders);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    fetchMedia(1, false);
  }, [debouncedSearch, activeFolder, filterType, sortBy, scanningDirectories.length, startDate, endDate, fetchMedia]);

  useEffect(() => {
    fetchDirectories();
    let interval: NodeJS.Timeout;
    if (scanningDirectories.length > 0) {
      interval = setInterval(() => fetchMedia(1, false), 3000);
    }
    return () => clearInterval(interval);
  }, [scanningDirectories.length, fetchMedia, fetchDirectories]);

  useEffect(() => {
    if (window.electronAPI?.onLibraryUpdated) {
      window.electronAPI.onLibraryUpdated(() => {
        fetchDirectories();
        fetchMedia(1, false);
      });
    }
    if (window.electronAPI?.onScanStatus) {
      window.electronAPI.getScanStatus().then((status) => {
        setScanningDirectories(status.scanningDirectories);
      });
      window.electronAPI.onScanStatus((status) => {
        setScanningDirectories(status.scanningDirectories);
      });
    }
  }, [fetchMedia, fetchDirectories]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(scrollRef.current);
    const handleRotated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMediaItems(prev => prev.map(item => {
        if (item.id === detail.id) {
          return { ...item, _ts: Date.now() } as MediaItem; // force remount/reload
        }
        return item;
      }));
    };
    
    const handleDeleted = () => {
      fetchMedia(1, false);
    };

    window.addEventListener('media-rotated', handleRotated);
    window.addEventListener('media-deleted', handleDeleted);

    return () => {
      observer.disconnect();
      window.removeEventListener('media-rotated', handleRotated);
      window.removeEventListener('media-deleted', handleDeleted);
    };
  }, []);

  // Slideshow Logic moved below

  const folderTree = useMemo(() => {
    const root: Record<string, FolderNode> = {};
    
    // First, ensure all root directories are present in the tree
    directories.forEach(rootDir => {
      const rootName = rootDir.path.split(/[/\\]/).filter(Boolean).pop() || rootDir.path;
      if (!root[rootName]) {
        root[rootName] = { name: rootName, path: rootDir.path, children: {} };
      }
    });

    folders.forEach(folder => {
      // Find matching root directory
      const rootDir = directories.find(d => folder.startsWith(d.path));
      if (!rootDir) return;

      const relativePath = folder.substring(rootDir.path.length).replace(/^[/\\]+/, '');
      if (!relativePath) return; // already handled by root insertion
      const parts = relativePath.split(/[/\\]/);
      
      let current = root;
      let currentPath = rootDir.path;
      
      // We also want the rootDir to be the top level node
      const rootName = rootDir.path.split(/[/\\]/).filter(Boolean).pop() || rootDir.path;
      current = current[rootName].children;

      parts.forEach((part, i) => {
        if (!part) return;
        currentPath += (currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\') + part;
        if (!current[part]) {
          current[part] = { name: part, path: currentPath, children: {} };
        }
        current = current[part].children;
      });
    });
    return root;
  }, [folders, directories]);

  const itemsWithHeaders = useMemo(() => {
    if (sortBy !== 'Newest' && sortBy !== 'Oldest') return mediaItems;
    const result: (MediaItem | { id: string; isHeader: boolean; title: string })[] = [];
    let lastMonth = '';
    
    for (const item of mediaItems) {
      if (!item.created_at) {
        result.push(item);
        continue;
      }
      const date = new Date(item.created_at);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      if (monthYear !== lastMonth) {
        result.push({ id: `header-${monthYear}-${item.id}`, isHeader: true, title: monthYear });
        lastMonth = monthYear;
      }
      result.push(item);
    }
    return result;
  }, [mediaItems, sortBy]);

  // Filter and Sort (now done exclusively on backend)
  
  const columns = containerWidth < 600 ? 2 : containerWidth < 900 ? 3 : containerWidth < 1200 ? 4 : 5;
  const gap = 16;
  const { positionedItems, totalHeight } = useMasonry(itemsWithHeaders, containerWidth, columns, gap);
  const visibleItems = useVirtualMasonry(positionedItems, scrollRef);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 500) {
      if (hasMore && !isLoading) {
        fetchMedia(page + 1, true);
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">
      <Sidebar 
        folderTree={folderTree} 
        activeFolder={activeFolder} 
        onFolderSelect={setActiveFolder} 
        onOpenSettings={() => router.push('/settings')}
        scanningDirectories={scanningDirectories}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
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
            {/* Search Input */}
            <div className="relative">
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
            </div>

            {/* Filter Dropdown */}
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

            {/* Sort Dropdown */}
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
                        setPage(1);
                        fetchMedia(1, false);
                        scrollRef.current?.scrollTo(0, 0);
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

            {/* Date Filter Dropdown */}
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
            
            {/* Slideshow Button */}
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

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pt-28 px-8 pb-8">
          {mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <p className="text-lg">No media found.</p>
            </div>
          ) : (
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
          )}
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
      </main>



      {viewerIndex !== null && (
        <MediaViewer
          items={mediaItems}
          currentIndex={viewerIndex}
          isSlideshow={isSlideshow}
          slideshowSpeed={4000}
          onClose={() => {
            if (document.startViewTransition && viewerIndex !== null) {
              const currentId = mediaItems[viewerIndex].id;
              flushSync(() => {
                setTransitionId(currentId);
              });
              document.startViewTransition(() => {
                flushSync(() => {
                  setActiveMediaId(null);
                  setIsSlideshow(false);
                });
              }).finished.finally(() => {
                setTransitionId(null);
              });
            } else {
              setActiveMediaId(null);
              setIsSlideshow(false);
            }
          }}
          onNavigate={(i) => {
            if (i >= 0 && i < mediaItems.length) {
              setActiveMediaId(mediaItems[i].id);
            }
            if (i >= mediaItems.length - 1 && hasMore && !isLoading) {
              fetchMedia(page + 1, true);
            }
          }}
          onSlideshowEnd={() => setIsSlideshow(false)}
        />
      )}

      {/* Selection Management Modal */}
      {isSelectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsSelectionModalOpen(false)} />
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                {selectedMediaIds.size} Items Selected
              </h2>
              <InteractiveButton onClick={() => setIsSelectionModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </InteractiveButton>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {mediaItems.filter(m => selectedMediaIds.has(m.id)).map(item => (
                  <div key={item.id} className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-white/5">
                    <img src={`media://${encodeURIComponent(item.thumbnail_path)}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setSelectedMediaIds(prev => {
                        const next = new Set(prev);
                        next.delete(item.id);
                        if (next.size === 0) setIsSelectionModalOpen(false);
                        return next;
                      })}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full transition-all z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-zinc-900/50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-3">
                <InteractiveButton 
                  onClick={async () => {
                    if (confirm(`Are you sure you want to permanently delete ${selectedMediaIds.size} items?`)) {
                      const itemsToDelete = mediaItems.filter(m => selectedMediaIds.has(m.id)).map(m => ({ id: m.id, filepath: m.filepath }));
                      await window.electronAPI.deleteMediaMultiple(itemsToDelete);
                      setSelectedMediaIds(new Set());
                      setIsSelectionModalOpen(false);
                      setMediaItems(prev => prev.filter(m => !selectedMediaIds.has(m.id)));
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </InteractiveButton>
                
                <InteractiveButton 
                  onClick={async () => {
                    const files = mediaItems.filter(m => selectedMediaIds.has(m.id)).map(m => m.filepath);
                    await window.electronAPI.copyMediaClipboardMultiple(files);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 rounded-lg transition-colors"
                >
                  {isCopied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} 
                  Copy To Clipboard
                </InteractiveButton>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Tag name..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="px-3 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent relative z-10"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      await window.electronAPI.addTagMultiple(Array.from(selectedMediaIds), tagInput.trim());
                      setTagInput('');
                      setIsTagAdded(true);
                      setTimeout(() => setIsTagAdded(false), 2000);
                      fetchMedia(1, false);
                    }
                  }}
                />
                <InteractiveButton 
                  onClick={async () => {
                    if (tagInput.trim()) {
                      await window.electronAPI.addTagMultiple(Array.from(selectedMediaIds), tagInput.trim());
                      setTagInput('');
                      setIsTagAdded(true);
                      setTimeout(() => setIsTagAdded(false), 2000);
                      fetchMedia(1, false);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                >
                  {isTagAdded ? <CheckCircle2 className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                  Add Tag
                </InteractiveButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
