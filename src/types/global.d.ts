export {};

declare global {
  interface Window {
    electronAPI: {
      ping: (message: string) => Promise<string>;
      selectDirectory: () => Promise<string | null>;
      scanDirectory: (dirPath: string) => Promise<{ status: string }>;
      stopScan: (dirPath: string) => Promise<{ success: boolean }>;
      getScanStatus: () => Promise<{ scanningDirectories: string[] }>;
      getFolders: () => Promise<{ success: boolean; folders: string[] }>;
      getMedia: (page: number, limit: number, searchQuery?: string, activeFolder?: string, filterType?: string, sortBy?: string, startDate?: string, endDate?: string) => Promise<{
        items: Array<{
          id: number;
          filepath: string;
          filename: string;
          type: string;
          thumbnail_path: string;
          width: number;
          height: number;
          duration: number;
          created_at: string;
          size: number;
        }>;
        total: number;
        page: number;
        totalPages: number;
      }>;
      clearDatabase: () => Promise<{ success: boolean }>;
      addTag: (mediaId: number, tagName: string) => Promise<{ success: boolean; tag?: { id: number, name: string }; error?: string }>;
      addTagMultiple: (mediaIds: number[], tagName: string) => Promise<{ success: boolean; tag?: { id: number, name: string }; error?: string }>;
      removeTag: (mediaId: number, tagId: number) => Promise<{ success: boolean; error?: string }>;
      getTags: (mediaId: number) => Promise<{ success: boolean; tags: Array<{ id: number, name: string }> }>;
      addDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      removeDirectory: (id: number) => Promise<{ success: boolean; error?: string }>;
      getDirectories: () => Promise<{ success: boolean; directories: Array<{ id: number, path: string }> }>;
      revealInExplorer: (filepath: string) => Promise<{ success: boolean }>;
      deleteMedia: (id: number, filepath: string) => Promise<{ success: boolean; error?: string }>;
      deleteMediaMultiple: (items: {id: number, filepath: string}[]) => Promise<{ success: boolean; error?: string }>;
      copyMediaMultiple: (filepaths: string[], destination: string) => Promise<{ success: boolean; error?: string }>;
      copyMediaClipboardMultiple: (filepaths: string[]) => Promise<{ success: boolean; error?: string }>;
      rotateMedia: (id: number, filepath: string) => Promise<{ success: boolean; error?: string }>;
      setWallpaper: (filepath: string) => Promise<{ success: boolean; error?: string }>;
      shareMedia: (filepath: string) => Promise<{ success: boolean; error?: string }>;
      onLibraryUpdated: (callback: () => void) => void;
      onScanStatus: (callback: (status: { scanningDirectories: string[] }) => void) => void;
    };
  }
}
