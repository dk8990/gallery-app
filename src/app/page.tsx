"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { flushSync } from 'react-dom';
import { Sidebar, FolderNode } from "@/components/Sidebar";
import { useMasonry, useVirtualMasonry } from "@/components/useMasonry";
import { ArrowUp, FolderPlus } from "lucide-react";
import { InteractiveButton } from "@/components/InteractiveButton";
import { MediaViewer } from "@/components/MediaViewer";
import { useRouter } from "next/navigation";
import { useMediaLibrary, MediaItem } from "@/components/Gallery/useMediaLibrary";
import { GalleryToolbar } from "@/components/Gallery/GalleryToolbar";
import { GalleryGrid } from "@/components/Gallery/GalleryGrid";
import { SelectionModal } from "@/components/Gallery/SelectionModal";

export default function Home() {
  const router = useRouter();

  const {
    mediaItems, setMediaItems,
    itemsWithHeaders,
    total,
    activeFolder, setActiveFolder,
    filterType, setFilterType,
    sortBy, setSortBy,
    startDate, setStartDate,
    endDate, setEndDate,
    searchQuery, setSearchQuery,
    directories, folders, scanningDirectories,
    page, hasMore, isLoading,
    pendingRefresh, setPendingRefresh,
    lastLibraryUpdate,
    fetchMedia, checkNewMedia, fetchDirectories
  } = useMediaLibrary();

  const [containerWidth, setContainerWidth] = useState(0);
  const [activeMediaId, setActiveMediaId] = useState<number | null>(null);
  const [transitionId, setTransitionId] = useState<number | null>(null);
  
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'filter' | 'sort' | 'slideshow' | 'date' | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<number>>(new Set());
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLibraryReady, setIsLibraryReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewerIndex = useMemo(() => {
    if (activeMediaId === null) return null;
    const idx = mediaItems.findIndex(m => m.id === activeMediaId);
    return idx !== -1 ? idx : null;
  }, [activeMediaId, mediaItems]);

  const prevActiveMediaIdRef = useRef(activeMediaId);
  useEffect(() => {
    if (prevActiveMediaIdRef.current !== null && activeMediaId === null) {
      checkNewMedia(isScrolled, false);
    }
    prevActiveMediaIdRef.current = activeMediaId;
  }, [activeMediaId, checkNewMedia, isScrolled]);

  useEffect(() => {
    const checkLibrary = async () => {
      try {
        const libPath = await window.electronAPI.getCurrentLibrary();
        if (!libPath) {
          router.replace('/welcome');
        } else {
          setIsLibraryReady(true);
        }
      } catch (e) {
        console.error('Failed to check library:', e);
      }
    };
    checkLibrary();
  }, [router]);

  // Early return removed to fix Rules of Hooks

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scanningDirectories.length > 0 && activeMediaId === null) {
      interval = setInterval(() => checkNewMedia(isScrolled, false), 3000);
    }
    return () => clearInterval(interval);
  }, [scanningDirectories.length, checkNewMedia, activeMediaId, isScrolled]);

  useEffect(() => {
    if (lastLibraryUpdate > 0) {
      checkNewMedia(isScrolled, activeMediaId !== null);
    }
  }, [lastLibraryUpdate, checkNewMedia, isScrolled, activeMediaId]);

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
          return { ...item, _ts: Date.now() } as MediaItem;
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
  }, [fetchMedia, setMediaItems, isLibraryReady]);

  const folderTree = useMemo(() => {
    const root: Record<string, FolderNode> = {};
    directories.forEach(rootDir => {
      const rootName = rootDir.path.split(/[/\\]/).filter(Boolean).pop() || rootDir.path;
      if (!root[rootName]) {
        root[rootName] = { name: rootName, path: rootDir.path, children: {} };
      }
    });

    folders.forEach(folder => {
      const rootDir = directories.find(d => folder.startsWith(d.path));
      if (!rootDir) return;

      const relativePath = folder.substring(rootDir.path.length).replace(/^[/\\]+/, '');
      if (!relativePath) return;
      const parts = relativePath.split(/[/\\]/);

      let current = root;
      let currentPath = rootDir.path;

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

  const columns = containerWidth < 600 ? 2 : containerWidth < 900 ? 3 : containerWidth < 1200 ? 4 : 5;
  const gap = 16;
  const { positionedItems, totalHeight } = useMasonry(itemsWithHeaders, containerWidth, columns, gap);
  const visibleItems = useVirtualMasonry(positionedItems, scrollRef, 1000, isLibraryReady);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setIsScrolled(target.scrollTop > 100);

    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 800) {
      if (hasMore && !isLoading) {
        fetchMedia(page + 1, true);
      }
    }
  };

  if (!isLibraryReady) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Loading Library...</div>;
  }

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
        <GalleryToolbar
          total={total}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterType={filterType}
          setFilterType={setFilterType}
          sortBy={sortBy}
          setSortBy={setSortBy}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          mediaItems={mediaItems}
          setActiveMediaId={setActiveMediaId}
          setIsSlideshow={setIsSlideshow}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onRandomSort={() => {
            fetchMedia(1, false);
            scrollRef.current?.scrollTo(0, 0);
          }}
        />

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pt-28 px-8 pb-8">
          {pendingRefresh && viewerIndex === null && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-slide-up flex items-center bg-indigo-500/20 backdrop-blur-xl rounded-full shadow-2xl shadow-black/50 border border-indigo-400/30 transition-all hover:scale-105 hover:bg-indigo-500/30 hover:border-indigo-400/40">
              <button
                onClick={() => {
                  if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                  fetchMedia(1, false);
                  setPendingRefresh(false);
                }}
                className="flex items-center gap-3 px-6 py-3 text-white text-sm font-semibold transition-colors active:scale-95"
              >
                <ArrowUp className="w-4 h-4" />
                Library updated
              </button>
            </div>
          )}

          {mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
              {directories.length === 0 ? (
                <>
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-2">
                    <FolderPlus className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-medium text-zinc-300">Your library is empty</h3>
                  <p className="text-zinc-500 max-w-sm text-center">You haven't added any folders to scan yet. Head over to Settings to add your media folders.</p>
                  <InteractiveButton 
                    onClick={() => router.push('/settings')}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-full transition-all shadow-lg shadow-indigo-900/20"
                  >
                    Go to Settings
                  </InteractiveButton>
                </>
              ) : (
                <p className="text-lg">No media found.</p>
              )}
            </div>
          ) : (
            <GalleryGrid
              itemsWithHeaders={itemsWithHeaders}
              visibleItems={visibleItems}
              totalHeight={totalHeight}
              containerRef={containerRef}
              selectedMediaIds={selectedMediaIds}
              setSelectedMediaIds={setSelectedMediaIds}
              isSelectionModalOpen={isSelectionModalOpen}
              setIsSelectionModalOpen={setIsSelectionModalOpen}
              setActiveMediaId={setActiveMediaId}
              setIsSlideshow={setIsSlideshow}
              setTransitionId={setTransitionId}
              transitionId={transitionId}
              viewerIndex={viewerIndex}
            />
          )}
        </div>
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
          onRemoveItem={(id: number) => {
             setMediaItems(prev => prev.filter(m => m.id !== id));
          }}
          onSlideshowEnd={() => setIsSlideshow(false)}
        />
      )}

      {isSelectionModalOpen && (
        <SelectionModal 
          selectedMediaIds={selectedMediaIds}
          setSelectedMediaIds={setSelectedMediaIds}
          setIsSelectionModalOpen={setIsSelectionModalOpen}
          mediaItems={mediaItems}
          setMediaItems={setMediaItems}
          fetchMedia={fetchMedia}
        />
      )}
    </div>
  );
}
