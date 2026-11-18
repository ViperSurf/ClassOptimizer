import React from 'react';
import { OptimizerConstraints, PriorityFocus, ScheduleOption } from '../../@types/schedule';
import { Tooltip } from '../common/Tooltip';
import { Badge } from '../common/Badge';

interface Props {
  focus: PriorityFocus;
  onFocusChange: (f: PriorityFocus) => void;
  option: ScheduleOption | null;
  optionIndex: number;
  optionCount: number;
  onPrev: () => void;
  onNext: () => void;
  solveTimeMs: number;
  isSolving: boolean;
  constraints: OptimizerConstraints;
  onConstraintsChange: (c: OptimizerConstraints) => void;
}

const FOCI: Array<{ id: PriorityFocus; tip: string }> = [
  { id: 'Balanced', tip: 'Weights: GPA 40%, Times 35%, Walking 25%.' },
  { id: 'Max GPA', tip: 'Weights: GPA 70%, Times 15%, Walking 15%. Uses historical instructor GPA data.' },
  { id: 'Best Times', tip: 'Weights: Times 70%, GPA 15%, Walking 15%. Penalizes classes before 9 AM and after 5 PM.' },
  { id: 'Shortest Walk', tip: 'Weights: Walking 70%, GPA 15%, Times 15%. Minimizes back-to-back building changes.' },
];

export function TopControlStrip(p: Props) {
  const c = p.constraints;
  const set = (patch: Partial<OptimizerConstraints>) => p.onConstraintsChange({ ...c, ...patch });
  return (
    <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center" role="group" aria-label="Priority focus">
          {FOCI.map((f) => (
            <span key={f.id} className="flex items-center">
              <button type="button" onClick={() => p.onFocusChange(f.id)}
                className={`border px-3 py-1.5 text-sm font-medium first:rounded-l-lg last:rounded-r-lg ${p.focus === f.id ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'}`}>
                {f.id}
              </button>
              <Tooltip label={f.tip} />
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={p.onPrev} disabled={p.optionCount === 0} className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white disabled:opacity-40" aria-label="Previous schedule option">←</button>
          <span className="text-sm text-slate-200">
            {p.optionCount > 0 ? `Option ${p.optionIndex + 1} of ${p.optionCount}` : 'No options yet'}
          </span>
          <button type="button" onClick={p.onNext} disabled={p.optionCount === 0} className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white disabled:opacity-40" aria-label="Next schedule option">→</button>
          <span className="text-xs text-slate-500">{p.isSolving ? 'Solving…' : `solved in ${p.solveTimeMs.toFixed(1)} ms`}</span>
        </div>
      </div>
      {p.option && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="blue">Score {p.option.score.toFixed(0)}/100</Badge>
          <Badge>{p.option.totalCredits} credits</Badge>
          <Badge tone={p.option.gpaConfidenceRatio >= 0.75 ? 'green' : 'amber'}>
            Expected GPA {p.option.expectedGpa.toFixed(2)} · {Math.round(p.option.gpaConfidenceRatio * 100)}% data coverage
          </Badge>
          <Badge>{p.option.weeklyContactHours} contact hrs/wk</Badge>
          <Badge>{p.option.earliestClassTime} – {p.option.latestClassTime}</Badge>
          {p.option.maxWalkingMinutes > 0 && <Badge tone={p.option.hasTightWalks ? 'red' : 'slate'}>Max walk {p.option.maxWalkingMinutes} min{p.option.hasTightWalks ? ' · Tight!' : ''}</Badge>}
          {p.option.containsClosedSections && <Badge tone="red">Contains closed sections (Plan B)</Badge>}
          {p.option.substitutedBackups.map((s) => (
            <Badge key={s.primaryCourseId} tone="violet">Backup used: {s.backupCourseId} for {s.primaryCourseId}</Badge>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={c.protectMiddayLunch} onChange={(e) => set({ protectMiddayLunch: e.target.checked })} />
          Protect Lunch 11:30–13:30 (≥45m)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={c.includeClosedSections} onChange={(e) => set({ includeClosedSections: e.target.checked })} />
          Plan B: Include Closed Sections
        </label>
        <label className="flex items-center gap-1.5">
          Min break
          <select value={c.minBreakMinutes} onChange={(e) => set({ minBreakMinutes: Number(e.target.value) })}
            className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-white">
            {[0, 10, 15, 30].map((m) => <option key={m} value={m}>{m}m</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Credits
          <input type="number" value={c.minCredits} min={0} max={30} onChange={(e) => set({ minCredits: Number(e.target.value) || 0 })}
            className="w-14 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-white" aria-label="Minimum credits" />
          –
          <input type="number" value={c.maxCredits} min={1} max={30} onChange={(e) => set({ maxCredits: Number(e.target.value) || 18 })}
            className="w-14 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-white" aria-label="Maximum credits" />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={c.minimizeSingleClassDays} onChange={(e) => set({ minimizeSingleClassDays: e.target.checked })} />
          Avoid single-class days
        </label>
      </div>
    </div>
  );
}
