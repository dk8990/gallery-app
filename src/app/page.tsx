"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { flushSync } from 'react-dom';
import { Sidebar, FolderNode } from "@/components/Sidebar";
import { useMasonry, useVirtualMasonry } from "@/components/useMasonry";
import { ArrowUp } from "lucide-react";
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
    let interval: NodeJS.Timeout;
    if (scanningDirectories.length > 0 && activeMediaId === null) {
      interval = setInterval(() => checkNewMedia(isScrolled, false), 3000);
    }
    return () => clearInterval(interval);
  }, [scanningDirectories.length, checkNewMedia, activeMediaId, isScrolled]);

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
  }, [fetchMedia, setMediaItems]);

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
  const visibleItems = useVirtualMasonry(positionedItems, scrollRef);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setIsScrolled(target.scrollTop > 100);

    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 800) {
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
          {pendingRefresh && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
              <button
                onClick={() => {
                  if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                  fetchMedia(1, false);
                  setPendingRefresh(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded-full shadow-xl shadow-black/50 border border-indigo-400/30 transition-all active:scale-95"
              >
                <ArrowUp className="w-4 h-4" />
                New items discovered
              </button>
            </div>
          )}

          {mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <p className="text-lg">No media found.</p>
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
