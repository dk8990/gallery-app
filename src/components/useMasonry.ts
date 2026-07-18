import { useMemo, useState, useEffect, RefObject } from 'react';

export type MasonryItem<T> = {
  item: T;
  top: number;
  left: number;
  width: number;
  height: number;
};

export function useMasonry<T extends { width?: number; height?: number; isHeader?: boolean }>(
  items: T[],
  containerWidth: number,
  columnCount: number,
  gap: number
) {
  return useMemo(() => {
    if (!containerWidth || items.length === 0) return { positionedItems: [], totalHeight: 0 };

    const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
    const columnHeights = Array(columnCount).fill(0);
    const positionedItems: MasonryItem<T>[] = [];

    for (const item of items) {
      if (item.isHeader) {
        // Headers span the full width
        const maxCol = Math.max(...columnHeights);
        const top = maxCol + (maxCol > 0 ? gap : 0);
        const height = 48; // Fixed height for headers
        positionedItems.push({
          item,
          top,
          left: 0,
          width: containerWidth,
          height,
        });
        columnHeights.fill(top + height + gap);
        continue;
      }

      // Find the shortest column
      let shortestCol = 0;
      let minHeight = columnHeights[0];
      for (let i = 1; i < columnCount; i++) {
        if (columnHeights[i] < minHeight) {
          minHeight = columnHeights[i];
          shortestCol = i;
        }
      }

      // Handle items with 0 width/height (fallback to square)
      const aspect = item.width && item.height ? item.height / item.width : 1;
      const height = columnWidth * aspect;

      const top = columnHeights[shortestCol];
      const left = shortestCol * (columnWidth + gap);

      positionedItems.push({
        item,
        top,
        left,
        width: columnWidth,
        height,
      });

      columnHeights[shortestCol] = top + height + gap;
    }

    const totalHeight = Math.max(...columnHeights);

    return { positionedItems, totalHeight };
  }, [items, containerWidth, columnCount, gap]);
}

export function useVirtualMasonry<T>(
  positionedItems: MasonryItem<T>[],
  scrollContainerRef: RefObject<HTMLElement | null>,
  overscan = 1000
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(1000);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => setScrollTop(container.scrollTop);
    const handleResize = () => setContainerHeight(container.clientHeight);

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    
    handleScroll();
    handleResize();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [scrollContainerRef]);

  const visibleItems = useMemo(() => {
    const viewTop = scrollTop - overscan;
    const viewBottom = scrollTop + containerHeight + overscan;

    // For 100k items, a linear scan is ~2ms. We can optimize with binary search later if needed.
    return positionedItems.filter(
      (p) => p.top + p.height >= viewTop && p.top <= viewBottom
    );
  }, [positionedItems, scrollTop, containerHeight, overscan]);

  return visibleItems;
}
