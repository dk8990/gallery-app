import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { InteractiveButton } from '../InteractiveButton';
import { MediaItem, TagType } from './types';

export function MediaViewerSidebar({
  item,
  tags,
  newTag,
  isSidebarOpen,
  isInfoOpen,
  setNewTag,
  handleAddTag,
  handleRemoveTag,
  setIsSidebarOpen,
  setIsInfoOpen
}: {
  item: MediaItem;
  tags: TagType[];
  newTag: string;
  isSidebarOpen: boolean;
  isInfoOpen: boolean;
  setNewTag: (t: string) => void;
  handleAddTag: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleRemoveTag: (id: number) => void;
  setIsSidebarOpen: (v: boolean) => void;
  setIsInfoOpen: (v: boolean) => void;
}) {
  return (
    <>
      <div className={clsx(
        "absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 z-50 transition-transform duration-300 flex flex-col pointer-events-auto",
        isInfoOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
      )}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
          <h3 className="font-semibold text-white">Media Info</h3>
          <InteractiveButton onClick={() => setIsInfoOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </InteractiveButton>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">File Name</p>
              <p className="text-sm text-zinc-200 break-all">{item.filename}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Location</p>
              <p className="text-sm text-zinc-200 break-all font-mono text-xs">{item.filepath}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Resolution</p>
              <p className="text-sm text-zinc-200">{item.width || 'Unknown'} x {item.height || 'Unknown'}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Type</p>
              <p className="text-sm text-zinc-200">{item.type.toUpperCase()}</p>
            </div>
            {item.size && (
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Size</p>
                <p className="text-sm text-zinc-200">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
            {item.duration && item.duration > 0 && (
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Duration</p>
                <p className="text-sm text-zinc-200">{Math.round(item.duration)}s</p>
              </div>
            )}
            {item.created_at && (
              <div className="bg-zinc-800/50 rounded-xl p-4 col-span-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Created</p>
                <p className="text-sm text-zinc-200">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={clsx(
        "absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 z-50 transition-transform duration-300 flex flex-col pointer-events-auto",
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
      )}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
          <h3 className="font-semibold text-white">Tags</h3>
          <InteractiveButton onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </InteractiveButton>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add a tag and press Enter..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600 shadow-inner"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full text-sm font-medium border border-indigo-500/30 group transition-colors hover:bg-indigo-500/30">
                <span>{tag.name}</span>
                <InteractiveButton onClick={() => handleRemoveTag(tag.id)} className="p-0.5 hover:bg-indigo-500/40 rounded-full transition-colors ml-1 opacity-50 group-hover:opacity-100">
                  <X className="w-3 h-3" />
                </InteractiveButton>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-zinc-500 text-sm text-center w-full mt-4">No tags added yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
