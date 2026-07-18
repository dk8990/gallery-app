"use client";

import { Folder, FolderOpen, ChevronRight, Settings, Compass, LayoutGrid, Loader2 } from 'lucide-react';
import { InteractiveButton } from './InteractiveButton';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState } from 'react';

export type FolderNode = {
  name: string;
  path: string;
  children: Record<string, FolderNode>;
};

function FolderTreeItem({ 
  node, 
  activeFolder, 
  onSelect,
  isSettings,
  scanningDirectories
}: { 
  node: FolderNode, 
  activeFolder: string, 
  onSelect: (path: string) => void,
  isSettings: boolean,
  scanningDirectories?: string[]
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`folder_tree_${node.path}`) === 'true';
    }
    return false;
  });

  const toggleOpen = () => {
    if (!hasChildren) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`folder_tree_${node.path}`, nextState.toString());
    }
  };
  const hasChildren = Object.keys(node.children).length > 0;
  const isActive = activeFolder === node.path;
  
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1">
        <button 
          onClick={toggleOpen}
          className={clsx(
            "w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors shrink-0",
            !hasChildren && "invisible"
          )}
        >
          {hasChildren && <ChevronRight className={clsx("w-3.5 h-3.5 text-zinc-500 transition-transform duration-200", isOpen && "rotate-90")} />}
        </button>
        <InteractiveButton 
          onClick={() => {
             onSelect(node.path);
          }}
          className={twMerge(
            clsx(
              "flex-1 flex items-center justify-start gap-2 px-2 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95 text-left truncate",
              (isActive && !isSettings)
                ? "bg-indigo-500/15 text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )
          )}
        >
          {isOpen ? <FolderOpen className="w-4 h-4 shrink-0" /> : <Folder className="w-4 h-4 shrink-0" />}
          <span className="truncate">{node.name}</span>
          {scanningDirectories?.includes(node.path) && (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0 ml-auto" />
          )}
        </InteractiveButton>
      </div>
      {isOpen && hasChildren && (
        <div className="border-l border-white/10 ml-2.5 pl-1 mt-0.5 space-y-0.5">
          {Object.values(node.children)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => (
            <FolderTreeItem key={child.path} node={child} activeFolder={activeFolder} onSelect={onSelect} isSettings={isSettings} scanningDirectories={scanningDirectories} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ 
  folderTree = {},
  activeFolder = '',
  onFolderSelect = () => {},
  onOpenSettings = () => {},
  scanningDirectories = []
}: { 
  folderTree?: Record<string, FolderNode>;
  activeFolder?: string;
  onFolderSelect?: (path: string) => void;
  onOpenSettings?: () => void;
  scanningDirectories?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname === '/settings';

  const handleFolderSelect = (path: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('activeFolder', path);
    }
    if (isSettings) {
      router.push('/');
    } else {
      onFolderSelect(path);
    }
  };

  return (
    <aside className="w-64 bg-zinc-900/50 backdrop-blur-xl border-r border-zinc-800/50 h-screen flex flex-col pt-6 flex-shrink-0">
      <div className="px-6 pb-6">
        <h1 className="text-xl font-bold bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm flex items-center gap-2">
          <Compass className="w-6 h-6 text-indigo-400" />
          Nexus
        </h1>
      </div>
      
      <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar">
        <InteractiveButton
          onClick={() => handleFolderSelect('')}
          className={twMerge(
            clsx(
              "w-full flex items-center justify-start gap-3 px-3 py-2 mb-4 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95",
              (activeFolder === '' && !isSettings)
                ? "bg-indigo-500/15 text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )
          )}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          All Folders
        </InteractiveButton>

        <div className="px-3 pb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Folders
        </div>
        <div className="px-1">
          {Object.values(folderTree)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(node => (
              <FolderTreeItem key={node.path} node={node} activeFolder={activeFolder} onSelect={handleFolderSelect} isSettings={isSettings} scanningDirectories={scanningDirectories} />
            ))}
          {Object.keys(folderTree).length === 0 && (
            <p className="text-xs text-zinc-600 px-2 mt-2">No folders added.</p>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-zinc-800/50">
        <InteractiveButton 
          onClick={isSettings ? undefined : onOpenSettings}
          className={twMerge(
            clsx(
              "w-full flex items-center justify-start gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 active:scale-95 group",
              isSettings 
                ? "bg-indigo-500/15 text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )
          )}
        >
          <Settings className={clsx("w-4 h-4 transition-transform duration-300", !isSettings && "group-hover:rotate-45")} />
          Settings
        </InteractiveButton>
      </div>
    </aside>
  );
}
