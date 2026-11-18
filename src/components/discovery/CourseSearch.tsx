import React, { useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Course, LinkedBundle } from '../../@types/course';
import { GpaBadge } from '../common/Badge';

export type SearchChip = 'all' | 'double-dip' | 'fits' | 'high-gpa' | 'eight-week';

export interface CourseSearchHandle { focus: () => void; }

interface Props {
  courses: Course[];
  selectedIds: Set<string>;
  currentBundles: LinkedBundle[];
  isBundleCompatible: (course: Course) => boolean;
  onAdd: (courseId: string) => void;
}

export const CourseSearch = forwardRef<CourseSearchHandle, Props>(function CourseSearch(
  { courses, selectedIds, currentBundles, isBundleCompatible, onAdd }, ref
) {
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<SearchChip>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));
  void currentBundles;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (selectedIds.has(c.id)) return false;
      if (q && !`${c.id} ${c.title} ${c.description}`.toLowerCase().includes(q)) return false;
      if (chip === 'double-dip' && c.genEdCategories.length < 2) return false;
      if (chip === 'high-gpa' && !((c.courseAverageGpa ?? 0) >= 3.5)) return false;
      if (chip === 'eight-week' && !c.sections.some((s) => s.partOfTerm === 'A' || s.partOfTerm === 'B')) return false;
      if (chip === 'fits' && !isBundleCompatible(c)) return false;
      return true;
    }).slice(0, 60);
  }, [courses, query, chip, selectedIds, isBundleCompatible]);

  const chips: Array<{ id: SearchChip; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'double-dip', label: 'Double-Dip Gen-Eds' },
    { id: 'fits', label: 'Fits Current Schedule' },
    { id: 'high-gpa', label: 'High GPA' },
    { id: 'eight-week', label: '8-Week' },
  ];

  return (
    <div className="border-b border-slate-800 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Find Courses <span className="normal-case text-slate-500">(press /)</span></h2>
      <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search CS 225, data structures, philosophy…"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c.id} type="button" onClick={() => setChip(c.id)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${chip === c.id ? 'border-sky-500 bg-sky-900/70 text-sky-200' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {results.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-850 bg-slate-900 p-2.5 hover:border-slate-600">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{c.id}</span>
                <span className="truncate text-sm text-slate-300">{c.title}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span>{c.creditHoursMin === c.creditHoursMax ? `${c.creditHoursMin} cr` : `${c.creditHoursMin}–${c.creditHoursMax} cr`}</span>
                <span>· {c.sections.length} sections</span>
                {c.genEdCategories.length > 0 && <span>· {c.genEdCategories.join(', ')}</span>}
              </div>
              <div className="mt-1"><GpaBadge gpa={c.courseAverageGpa} /></div>
            </div>
            <button type="button" onClick={() => onAdd(c.id)}
              className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500">Add</button>
          </li>
        ))}
        {results.length === 0 && <li className="p-2 text-sm text-slate-500">No courses match this search.</li>}
      </ul>
    </div>
  );
});
