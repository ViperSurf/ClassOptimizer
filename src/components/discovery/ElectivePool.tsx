import React, { useState } from 'react';
import { Course } from '../../@types/course';
import { ElectivePool as Pool } from '../../@types/user';

interface Props {
  pools: Pool[];
  courses: Course[];
  selectedIds: Set<string>;
  onAddPool: (pool: Pool) => void;
  onRemovePool: (poolId: string) => void;
  onChangePool: (pool: Pool) => void;
}

export function ElectivePool({ pools, courses, selectedIds, onAddPool, onRemovePool, onChangePool }: Props) {
  const [name, setName] = useState('Tech Elective');
  const [pickCount, setPickCount] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const candidates = courses.filter((c) => !selectedIds.has(c.id));

  return (
    <div className="p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Elective Pools — Pick K of M</h2>
      <p className="mb-2 text-[11px] text-slate-500">The solver evaluates every candidate combination against your other courses — it never just takes the first K.</p>
      {pools.map((pool) => (
        <div key={pool.id} className="mb-2 rounded-lg border border-violet-800 bg-violet-950/40 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-violet-200">{pool.name}</span>
            <button type="button" onClick={() => onRemovePool(pool.id)} className="text-xs text-red-400 hover:text-red-300">Delete pool</button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <label className="flex items-center gap-1">Pick
              <button type="button" className="rounded border border-slate-600 px-1.5 text-white disabled:opacity-40" disabled={pool.pickCount <= 1}
                onClick={() => onChangePool({ ...pool, pickCount: Math.max(1, pool.pickCount - 1) })}>−</button>
              <span className="text-white">{pool.pickCount}</span>
              <button type="button" className="rounded border border-slate-600 px-1.5 text-white disabled:opacity-40" disabled={pool.pickCount >= pool.courseIds.length}
                onClick={() => onChangePool({ ...pool, pickCount: Math.min(pool.courseIds.length, pool.pickCount + 1) })}>+</button>
              of {pool.courseIds.length}
            </label>
            <span>{pool.courseIds.join(', ')}</span>
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2.5">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pool name"
            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white" />
          <label className="flex items-center gap-1 text-xs text-slate-300">Pick
            <input type="number" min={1} max={Math.max(1, picked.length)} value={pickCount}
              onChange={(e) => setPickCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white" />
          </label>
        </div>
        <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
          {candidates.map((c) => {
            const active = picked.includes(c.id);
            return (
              <button key={c.id} type="button"
                onClick={() => setPicked(active ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${active ? 'border-violet-500 bg-violet-900/70 text-violet-100' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
                {c.id}
              </button>
            );
          })}
        </div>
        <button type="button" disabled={picked.length < 2}
          onClick={() => {
            onAddPool({ id: `pool-${Date.now()}`, name: name.trim() || 'Elective Pool', courseIds: [...picked], pickCount: Math.min(pickCount, picked.length) });
            setPicked([]);
          }}
          className="mt-2 w-full rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40">
          Create pool (pick {Math.min(pickCount, Math.max(picked.length, 1))} of {picked.length})
        </button>
      </div>
    </div>
  );
}
