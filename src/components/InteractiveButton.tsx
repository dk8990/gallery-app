"use client";

import { useState, ButtonHTMLAttributes } from 'react';
import { Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface InteractiveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // If onClick returns a Promise, we handle loading and success automatically
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<any>;
  successDuration?: number; // How long to show the success state (ms)
  noScale?: boolean; // Disable hover/active scaling
}

export function InteractiveButton({
  children,
  onClick,
  className,
  successDuration = 1500,
  disabled,
  noScale = false,
  ...props
}: InteractiveButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick || status === 'loading') return;

    try {
      const result = onClick(e);
      if (result instanceof Promise) {
        const startTime = Date.now();
        
        // Only show loader if it takes more than 100ms
        const loaderTimeout = setTimeout(() => setStatus('loading'), 100);
        
        await result;
        clearTimeout(loaderTimeout);
        
        const elapsed = Date.now() - startTime;
        if (elapsed < 300) {
          // Action was very fast, skip success checkmark
          setStatus('idle');
        } else {
          setStatus('success');
          setTimeout(() => setStatus('idle'), successDuration);
        }
      }
    } catch (error) {
      console.error(error);
      setStatus('idle');
    }
  };

  const isWorking = status === 'loading' || status === 'success';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || status === 'loading'}
      className={clsx(
        "relative overflow-hidden transition-all duration-200 cursor-pointer",
        // The click effect (scale down slightly)
        !disabled && status !== 'loading' && !noScale && "active:scale-90",
        // The hover effect is removed as requested
        className
      )}
      {...props}
    >
      {/* Actual button content (hidden during loading/success) */}
      <span className={clsx("transition-opacity flex items-center gap-2 w-full h-full", 
        className?.includes('justify-') ? '' : 'justify-center',
        isWorking ? "opacity-0" : "opacity-100")}>
        {children}
      </span>

      {/* Loading state overlay */}
      {status === 'loading' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        </span>
      )}

      {/* Success state overlay */}
      {status === 'success' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className="w-4 h-4 text-green-400 animate-in zoom-in duration-200" />
        </span>
      )}
    </button>
  );
}
