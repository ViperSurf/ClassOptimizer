import React from 'react';

export function TwoPaneLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full flex-col border-r border-slate-800 bg-slate-900 lg:w-[420px] lg:shrink-0 xl:w-[460px] lg:overflow-y-auto">
        {left}
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden bg-slate-950">{right}</main>
    </div>
  );
}
