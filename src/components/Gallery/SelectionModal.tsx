import React, { useState } from 'react';
import { CheckCircle2, X, Trash2, Copy, Tag } from 'lucide-react';
import { InteractiveButton } from '../InteractiveButton';
import { MediaItem } from './useMediaLibrary';

export function SelectionModal({
  selectedMediaIds,
  setSelectedMediaIds,
  setIsSelectionModalOpen,
  mediaItems,
  setMediaItems,
  fetchMedia,
}: {
  selectedMediaIds: Set<number>;
  setSelectedMediaIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setIsSelectionModalOpen: (v: boolean) => void;
  mediaItems: MediaItem[];
  setMediaItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  fetchMedia: (page: number, append: boolean) => void;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isTagAdded, setIsTagAdded] = useState(false);

  return (
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
                if (!window.electronAPI) return;
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
                if (!window.electronAPI) return;
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
                if (e.key === 'Enter' && tagInput.trim() && window.electronAPI) {
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
                if (tagInput.trim() && window.electronAPI) {
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
  );
}
