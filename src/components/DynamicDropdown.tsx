"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import clsx from "clsx";
import { InteractiveButton } from "./InteractiveButton";

interface DynamicDropdownProps {
  triggerContent: ReactNode;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  dropdownClassName?: string;
}

export function DynamicDropdown({ triggerContent, children, isOpen, onToggle, className, dropdownClassName }: DynamicDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [alignment, setAlignment] = useState<"center" | "left" | "right">("center");

  useEffect(() => {
    if (isOpen && containerRef.current && dropdownRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      const centerLeft = containerRect.left + (containerRect.width / 2) - (dropdownRect.width / 2);
      const centerRight = centerLeft + dropdownRect.width;

      if (centerRight > viewportWidth - 10) {
        setAlignment("right");
      } else if (centerLeft < 10) {
        setAlignment("left");
      } else {
        setAlignment("center");
      }
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <InteractiveButton
        onClick={onToggle}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 transition-all text-sm relative",
          isOpen
            ? "z-50 bg-zinc-800 border border-white/20 rounded-lg text-white"
            : "bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-lg text-zinc-300",
          className
        )}
      >
        {triggerContent}
      </InteractiveButton>

      <div
          ref={dropdownRef}
          className={clsx(
            "absolute z-40 transition-all",
            !isOpen && "pointer-events-none",
            alignment === "center" && "left-1/2 -translate-x-1/2",
            alignment === "left" && "left-0",
            alignment === "right" && "right-0"
          )}
          style={{ top: 'calc(100% + 8px)' }}
        >
          <div
            className={clsx(
              "origin-bottom dropdown-3d",
              isOpen ? "dropdown-3d-open pointer-events-auto" : "dropdown-3d-closed pointer-events-none"
            )}
          >
            <div
              className={clsx(
                "bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden rounded-xl",
                dropdownClassName
              )}
            >
              {children}
            </div>
          </div>
        </div>
    </div>
  );
}
