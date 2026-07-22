import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

export type MediaItem = {
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

export type DirectoryItem = {
  id: number;
  path: string;
};

export function useMediaLibrary() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  
  const [activeFolder, setActiveFolderState] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activeFolder') || '';
    }
    return '';
  });

  const setActiveFolder = useCallback((path: string) => {
    setActiveFolderState(path);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('activeFolder', path);
    }
  }, []);

  const pathname = usePathname();

  // Sync state with sessionStorage in case we navigated back from settings
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname === '/') {
      const stored = sessionStorage.getItem('activeFolder') || '';
      if (stored !== activeFolder) {
        setActiveFolderState(stored);
      }
    }
  }, [pathname, activeFolder]);

  const [filterType, setFilterType] = useState<'All' | 'video' | 'image'>('All');
  const [sortBy, setSortBy] = useState<'Newest' | 'Oldest' | 'Largest' | 'Smallest' | 'Random'>('Newest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [scanningDirectories, setScanningDirectories] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [lastLibraryUpdate, setLastLibraryUpdate] = useState(0);
  
  const currentTotalRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchMedia = useCallback(async (pageNum = 1, append = false) => {
    if (!window.electronAPI) return;
    try {
      setIsLoading(true);
      const data = await window.electronAPI.getMedia(
        pageNum, 50, debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate
      );
      
      if (append) {
        setMediaItems(prev => {
          const newItems = data.items.filter(i => !prev.some(p => p.id === i.id));
          return [...prev, ...newItems];
        });
      } else {
        setMediaItems(data.items);
      }
      setTotal(data.total);
      currentTotalRef.current = data.total;
      setPage(data.page);
      setHasMore(data.page < data.totalPages);
      setPendingRefresh(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate]);

  const checkNewMedia = useCallback(async (isScrolled: boolean, isActiveMedia: boolean) => {
    if (!window.electronAPI || isActiveMedia) return;
    try {
      const data = await window.electronAPI.getMedia(
        1, 1, debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate
      );
      if (data.total !== currentTotalRef.current) {
        if (isScrolled) {
          setPendingRefresh(true);
        } else {
          fetchMedia(1, false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate, fetchMedia]);

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
    setPage(1);
    fetchMedia(1, false);
  }, [debouncedSearch, activeFolder, filterType, sortBy, startDate, endDate, fetchMedia]);

  useEffect(() => {
    fetchDirectories();
  }, [fetchDirectories]);

  useEffect(() => {
    if (window.electronAPI?.onLibraryUpdated) {
      window.electronAPI.onLibraryUpdated(() => {
        fetchDirectories();
        setLastLibraryUpdate(Date.now());
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
  }, [fetchDirectories]);

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

  return {
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
  };
}
