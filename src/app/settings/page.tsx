"use client";

import { useState, useEffect, useMemo } from "react";
import { Settings as SettingsIcon, ChevronLeft, Trash2, Plus, Keyboard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { InteractiveButton } from "@/components/InteractiveButton";
import { Sidebar, FolderNode } from "@/components/Sidebar";

type DirectoryItem = {
  id: number;
  path: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [mediaItems, setMediaItems] = useState<{filepath: string}[]>([]);
  const [scanningDirectories, setScanningDirectories] = useState<string[]>([]);
  const isScanning = scanningDirectories.length > 0;
  const [defaultMediaSize, setDefaultMediaSize] = useState('fit');

  const [folders, setFolders] = useState<string[]>([]);

  const fetchDirectories = async () => {
    if (!window.electronAPI) return;
    const [dirRes, folderRes] = await Promise.all([
      window.electronAPI.getDirectories(),
      window.electronAPI.getFolders()
    ]);
    if (dirRes.success) setDirectories(dirRes.directories);
    if (folderRes.success) setFolders(folderRes.folders);
  };

  const fetchMedia = async () => {
    if (!window.electronAPI) return;
    try {
      const data = await window.electronAPI.getMedia(1, 100000); 
      setMediaItems(data.items);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDirectories();
    fetchMedia();
    if (typeof window !== 'undefined') {
      setDefaultMediaSize(localStorage.getItem('defaultMediaSize') || 'fit');
    }
    if (window.electronAPI?.onScanStatus) {
      window.electronAPI.getScanStatus().then((status) => {
        setScanningDirectories(status.scanningDirectories);
      });
      window.electronAPI.onScanStatus((status) => {
        setScanningDirectories(status.scanningDirectories);
      });
    }
    if (window.electronAPI?.onLibraryUpdated) {
      window.electronAPI.onLibraryUpdated(() => {
        fetchDirectories();
        fetchMedia();
      });
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      interval = setInterval(() => {
        fetchDirectories();
        fetchMedia();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

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
      const rootDir = directories.find(d => folder.startsWith(d.path));
      if (!rootDir) return;

      const relativePath = folder.substring(rootDir.path.length).replace(/^[/\\]+/, '');
      if (!relativePath) return; // already handled by root insertion
      const parts = relativePath.split(/[/\\]/);
      
      let current = root;
      let currentPath = rootDir.path;
      
      const rootName = rootDir.path.split(/[/\\]/).filter(Boolean).pop() || rootDir.path;
      current = current[rootName].children;

      parts.forEach((part) => {
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

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;
    try {
      const selectedPath = await window.electronAPI.selectDirectory();
      if (selectedPath) {
        await window.electronAPI.addDirectory(selectedPath);
        await fetchDirectories();
        await window.electronAPI.scanDirectory(selectedPath);
        // setIsScanning(false) will be handled by onScanStatus event
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
    }
  };

  const handleRemoveDirectory = async (id: number) => {
    if (!window.electronAPI) return;
    if (confirm('Remove this folder and clear its media from the library?')) {
      await window.electronAPI.removeDirectory(id);
      fetchDirectories();
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-white">
      <Sidebar folderTree={folderTree} activeFolder="" onFolderSelect={() => {}} onOpenSettings={() => {}} scanningDirectories={scanningDirectories} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="flex items-center px-8 py-6 bg-zinc-900/50 border-b border-zinc-800 shrink-0">
          <SettingsIcon className="w-6 h-6 text-indigo-400 mr-3" />
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Settings & Folders
          </h1>
        </header>
  
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <section className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium text-white mb-1">Watched Folders</h2>
                  <p className="text-sm text-zinc-400">Add or remove folders for Nexus to automatically scan and organize.</p>
                </div>
                <div className="flex items-center gap-3">
                  <InteractiveButton
                    onClick={async () => {
                      if (!window.electronAPI) return;
                      for (const dir of directories) {
                        await window.electronAPI.scanDirectory(dir.path);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium text-white rounded-lg transition-all active:scale-95 shadow-sm"
                  >
                    {isScanning ? <span className="animate-pulse">Scanning...</span> : "Force Rescan Library"}
                  </InteractiveButton>
                  <InteractiveButton
                    onClick={handleSelectFolder}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
                  >
                    <Plus className="w-4 h-4" /> Add Root Folder
                  </InteractiveButton>
                </div>
              </div>

              <div className="space-y-3">
                {directories.map(dir => (
                  <div key={dir.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-4 rounded-xl group hover:border-white/10">
                    <span className="text-sm font-medium truncate pr-4 text-zinc-300 font-mono flex-1" title={dir.path}>{dir.path}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {scanningDirectories.includes(dir.path) && (
                        <InteractiveButton
                          onClick={async () => {
                            if (!window.electronAPI) return;
                            await window.electronAPI.stopScan(dir.path);
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all border border-zinc-700 hover:border-zinc-600 active:scale-95 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          Stop Scan
                        </InteractiveButton>
                      )}
                      <InteractiveButton 
                        onClick={() => handleRemoveDirectory(dir.id)}  
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove Folder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </InteractiveButton>
                    </div>
                  </div>
                ))}
                {directories.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                    <p className="text-sm text-zinc-500">No folders added yet. Click "Add Root Folder" to begin.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-medium text-white">Appearance</h2>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-xl">
                <div>
                  <p className="font-medium text-zinc-200">Default Media Size</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Choose how media fits the screen when opened.</p>
                </div>
                <select 
                  className="bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  value={defaultMediaSize}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDefaultMediaSize(val);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('defaultMediaSize', val);
                    }
                  }}
                >
                  <option value="fit">Fit to Screen</option>
                  <option value="original">Original Size</option>
                </select>
              </div>
            </section>

            <section className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Keyboard className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-medium text-white">Keyboard Shortcuts</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "Space or K", action: "Play/Pause Video" },
                  { key: "M", action: "Mute/Unmute Video" },
                  { key: "F", action: "Fullscreen Video" },
                  { key: "Up / Down Arrow", action: "Volume Up/Down" },
                  { key: "Left / Right Arrow", action: "Previous/Next Media" },
                  { key: "Shift + Left/Right", action: "Seek Video (5s)" },
                  { key: "Escape", action: "Close Media Viewer" },
                ].map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-sm text-zinc-400">{shortcut.action}</span>
                    <kbd className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-300 font-medium">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-zinc-900 border border-red-500/20 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-medium text-red-400 mb-1">Danger Zone</h2>
              <p className="text-sm text-zinc-400 mb-6">These actions cannot be undone.</p>
              
              <div className="flex items-center justify-between p-4 border border-red-500/10 bg-red-500/5 rounded-xl">
                <div>
                  <p className="font-medium text-zinc-200">Clear Entire Database</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Removes all media and tags from the library. Your actual files are kept safe.</p>
                </div>
                <InteractiveButton
                  onClick={async () => {
                    if (confirm("Are you sure? This will remove all items from the database (files are kept safe).")) {
                      await window.electronAPI?.clearDatabase();
                      setDirectories([]);
                    }
                  }}
                  className="px-4 py-2 bg-red-900/30 hover:bg-red-500/30 text-sm text-red-300 hover:text-red-200 border border-red-500/30 rounded-lg transition-all"
                >
                  Clear Database
                </InteractiveButton>
              </div>

              <div className="flex items-center justify-between p-4 border border-red-500/10 bg-red-500/5 rounded-xl mt-4">
                <div>
                  <p className="font-medium text-zinc-200">Close Library</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Disconnects the current library and returns you to the Welcome screen. Useful if you want to move the library folder.</p>
                </div>
                <InteractiveButton
                  onClick={async () => {
                    if (confirm("Are you sure you want to close this library? You can reopen it later from the Welcome screen.")) {
                      await window.electronAPI?.closeLibrary();
                      router.push('/welcome');
                    }
                  }}
                  className="px-4 py-2 bg-orange-900/30 hover:bg-orange-500/30 text-sm text-orange-300 hover:text-orange-200 border border-orange-500/30 rounded-lg transition-all whitespace-nowrap"
                >
                  Close Library
                </InteractiveButton>
              </div>

              <div className="flex items-center justify-between p-4 border border-red-500/10 bg-red-500/5 rounded-xl mt-4">
                <div>
                  <p className="font-medium text-zinc-200">Delete Library</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Permanently deletes the `.gallery-library` database folder from your drive. Your media files will NOT be deleted.</p>
                </div>
                <InteractiveButton
                  onClick={async () => {
                    if (confirm("WARNING: This will permanently delete your library database and all thumbnails from your disk. Your actual media files will remain untouched. Are you absolutely sure?")) {
                      const success = await window.electronAPI?.deleteLibrary();
                      if (success) {
                        router.push('/welcome');
                      } else {
                        alert("Failed to delete library directory.");
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-900/30 hover:bg-red-500/30 text-sm text-red-300 hover:text-red-200 border border-red-500/30 rounded-lg transition-all whitespace-nowrap"
                >
                  Delete Library
                </InteractiveButton>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
