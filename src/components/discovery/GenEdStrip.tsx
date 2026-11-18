import React from 'react';
import { ScheduleOption } from '../../@types/schedule';
import { Course } from '../../@types/course';

const SHORT: Record<string, string> = {
  'Composition I': 'Comp I',
  'Advanced Composition': 'Adv Comp',
  'Quantitative Reasoning I': 'Quant I',
  'Quantitative Reasoning II': 'Quant II',
  'Humanities & the Arts': 'Hum & Arts',
  'Social & Behavioral Sciences': 'Soc & Behav',
  'Natural Sciences & Technology': 'Nat Sci & Tech',
  'Cultural Studies - Western': 'Western',
  'Cultural Studies - Non-Western': 'Non-Western',
  'Cultural Studies - US Minority': 'US Minority',
};
export const ALL_GEN_EDS = Object.keys(SHORT);

export function GenEdStrip({ fulfilled, option, courses }: { fulfilled: string[]; option: ScheduleOption | null; courses: Course[] }) {
  const inOption = new Set<string>();
  if (option) {
    for (const id of option.activeCourseIds) {
      const c = courses.find((x) => x.id === id);
      c?.genEdCategories.forEach((g) => inOption.add(g));
    }
  }
  return (
    <div className="border-b border-slate-800 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Gen-Ed Progress</h2>
      <div className="flex flex-wrap gap-1.5">
        {ALL_GEN_EDS.map((cat) => {
          const done = fulfilled.includes(cat);
          const active = inOption.has(cat);
          return (
            <span key={cat} title={cat}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                done ? 'border-emerald-700 bg-emerald-900/60 text-emerald-300'
                : active ? 'border-sky-600 bg-sky-900/60 text-sky-200 ring-1 ring-sky-500'
                : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
              {done ? '✓ ' : active ? '● ' : ''}{SHORT[cat]}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">✓ completed · ● fulfilled by the schedule option you are viewing</p>
    </div>
  );
}
