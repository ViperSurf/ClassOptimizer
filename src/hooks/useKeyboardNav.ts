// src/hooks/useKeyboardNav.ts
import { useEffect } from 'react';

interface KeyboardNavHandlers {
  onFocusSearch?: () => void;
  onPrevOption?: () => void;
  onNextOption?: () => void;
  onUndo?: () => void;
}

export function useKeyboardNav({ onFocusSearch, onPrevOption, onNextOption, onUndo }: KeyboardNavHandlers) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if (isTyping) return;
      if (e.key === '/') { e.preventDefault(); onFocusSearch?.(); }
      else if (e.key === 'ArrowLeft') { onPrevOption?.(); }
      else if (e.key === 'ArrowRight') { onNextOption?.(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFocusSearch, onPrevOption, onNextOption, onUndo]);
}
