import React, { useEffect } from 'react';

export function UndoSnackbar({ label, onUndo, onDismiss }: { label: string | null; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    if (!label) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [label, onDismiss]);
  if (!label) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 shadow-2xl" role="status">
      <span className="text-sm text-slate-200">{label}</span>
      <button type="button" onClick={onUndo} className="rounded-md bg-sky-600 px-2.5 py-1 text-sm font-semibold text-white hover:bg-sky-500">
        Undo (Ctrl+Z)
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-slate-400 hover:text-slate-100">✕</button>
    </div>
  );
}
