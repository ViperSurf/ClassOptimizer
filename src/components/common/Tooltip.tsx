import React, { useState } from 'react';

export function Tooltip({ label, children }: { label: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-400 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {children}
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs font-normal normal-case tracking-normal text-slate-200 shadow-xl">
          {label}
        </span>
      )}
    </span>
  );
}
