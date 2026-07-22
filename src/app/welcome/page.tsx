"use client";

import { useRouter } from "next/navigation";
import { FolderPlus, FolderOpen, ShieldCheck } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();

  const handleCreateLibrary = async () => {
    try {
      const libPath = await window.electronAPI.createLibrary();
      if (libPath) {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenLibrary = async () => {
    try {
      const libPath = await window.electronAPI.openLibrary();
      if (libPath) {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 text-indigo-500 mb-6 border border-indigo-500/20 shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)]">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-5xl font-black mb-4 tracking-tight">Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Gallery</span></h1>
          <p className="text-xl text-zinc-400 font-light">Create a library on a portable drive or open an existing one to get started.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={handleCreateLibrary}
            className="group relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-8 text-left transition-all hover:border-indigo-500/50 hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.2)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <FolderPlus className="w-12 h-12 text-indigo-400 mb-6 transition-transform group-hover:scale-110 group-hover:text-indigo-300" />
              <h2 className="text-2xl font-bold mb-2">Create New Library</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">Select an empty folder on your hard drive or external portable drive to initialize a brand new Gallery Library.</p>
            </div>
          </button>

          <button
            onClick={handleOpenLibrary}
            className="group relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-8 text-left transition-all hover:border-cyan-500/50 hover:shadow-[0_0_40px_-10px_rgba(34,211,238,0.2)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10">
              <FolderOpen className="w-12 h-12 text-cyan-400 mb-6 transition-transform group-hover:scale-110 group-hover:text-cyan-300" />
              <h2 className="text-2xl font-bold mb-2">Open Existing</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">Have a library on a portable drive? Connect it and open the <code>.gallery-library</code> folder to pick up right where you left off.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
