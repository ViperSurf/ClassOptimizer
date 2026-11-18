import React from 'react';
import { Course } from '../../@types/course';
import { CourseSelection, PriorityTier } from '../../@types/user';
import { GpaBadge, StatusBadge } from '../common/Badge';

interface Props {
  selections: CourseSelection[];
  courses: Course[];
  onChange: (sel: CourseSelection) => void;
  onRemove: (courseId: string) => void;
}

const TIERS: Array<{ id: PriorityTier; label: string; hint: string }> = [
  { id: 'MUST_TAKE', label: 'S — Must Take', hint: 'Required in every schedule' },
  { id: 'HIGH_PRIORITY', label: 'A — High Priority', hint: 'Required, ranked below S' },
  { id: 'BACKUP_OPTIONAL', label: 'B — Backup / Optional', hint: 'Included only when it fits' },
];

export function TierList({ selections, courses, onChange, onRemove }: Props) {
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  return (
    <div className="border-b border-slate-800 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your Courses by Priority Tier</h2>
      {selections.length === 0 && <p className="text-sm text-slate-500">No courses yet — add some from search above.</p>}
      {TIERS.map((tier) => {
        const items = selections.filter((s) => s.tier === tier.id);
        if (items.length === 0) return null;
        return (
          <div key={tier.id} className="mb-3">
            <h3 className="text-sm font-semibold text-slate-200">{tier.label} <span className="font-normal text-slate-500">· {tier.hint}</span></h3>
            <ul className="mt-1.5 space-y-2">
              {items.map((sel) => {
                const course = courseMap.get(sel.courseId);
                if (!course) return null;
                return (
                  <li key={sel.courseId} className="rounded-lg border border-slate-700 bg-slate-800/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{course.id} <span className="font-normal text-slate-300">{course.title}</span></span>
                      <button type="button" onClick={() => onRemove(sel.courseId)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <GpaBadge gpa={course.courseAverageGpa} />
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        Tier
                        <select value={sel.tier} onChange={(e) => onChange({ ...sel, tier: e.target.value as PriorityTier })}
                          className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-white">
                          {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        Credits
                        <button type="button" aria-label="Fewer credits" className="rounded border border-slate-600 px-1.5 text-white disabled:opacity-40"
                          disabled={sel.creditHoursSelected <= course.creditHoursMin}
                          onClick={() => onChange({ ...sel, creditHoursSelected: Math.max(course.creditHoursMin, sel.creditHoursSelected - 1) })}>−</button>
                        <span className="min-w-4 text-center text-white">{sel.creditHoursSelected}</span>
                        <button type="button" aria-label="More credits" className="rounded border border-slate-600 px-1.5 text-white disabled:opacity-40"
                          disabled={sel.creditHoursSelected >= course.creditHoursMax}
                          onClick={() => onChange({ ...sel, creditHoursSelected: Math.min(course.creditHoursMax, sel.creditHoursSelected + 1) })}>+</button>
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        <input type="checkbox" checked={sel.isCreditNoCredit}
                          onChange={(e) => onChange({ ...sel, isCreditNoCredit: e.target.checked })} />
                        CR/NC
                      </label>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        Backup if full:
                        <select value={sel.backupCourseId ?? ''} onChange={(e) => onChange({ ...sel, backupCourseId: e.target.value || undefined })}
                          className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-white">
                          <option value="">None</option>
                          {courses.filter((c) => c.id !== sel.courseId && !selections.some((s) => s.courseId === c.id)).map((c) => (
                            <option key={c.id} value={c.id}>{c.id}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {(sel.pinnedCrns.length > 0 || sel.excludedCrns.length > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        {sel.pinnedCrns.map((crn) => (
                          <button key={crn} type="button" title="Click to unpin"
                            onClick={() => onChange({ ...sel, pinnedCrns: sel.pinnedCrns.filter((x) => x !== crn) })}
                            className="rounded-full border border-sky-600 bg-sky-900/60 px-2 py-0.5 text-sky-200">📌 CRN {crn} ✕</button>
                        ))}
                        {sel.excludedCrns.map((crn) => (
                          <button key={crn} type="button" title="Click to un-exclude"
                            onClick={() => onChange({ ...sel, excludedCrns: sel.excludedCrns.filter((x) => x !== crn) })}
                            className="rounded-full border border-red-700 bg-red-900/50 px-2 py-0.5 text-red-200">Excluded {crn} ✕</button>
                        ))}
                      </div>
                    )}
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-slate-400">Sections ({course.sections.length}) — click a CRN to pin / exclude</summary>
                      <ul className="mt-1 space-y-1">
                        {course.sections.map((s) => (
                          <li key={s.crn} className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                            <span className="font-mono">{s.crn}</span>
                            <span>{s.type} {s.sectionNumber}</span>
                            <StatusBadge status={s.enrollmentStatus} />
                            <button type="button" className="rounded border border-slate-600 px-1.5 py-0.5 hover:border-sky-500"
                              onClick={() => onChange({ ...sel, pinnedCrns: sel.pinnedCrns.includes(s.crn) ? sel.pinnedCrns.filter((x) => x !== s.crn) : [...sel.pinnedCrns, s.crn] })}>
                              {sel.pinnedCrns.includes(s.crn) ? 'Unpin' : 'Pin'}
                            </button>
                            <button type="button" className="rounded border border-slate-600 px-1.5 py-0.5 hover:border-red-500"
                              onClick={() => onChange({ ...sel, excludedCrns: sel.excludedCrns.includes(s.crn) ? sel.excludedCrns.filter((x) => x !== s.crn) : [...sel.excludedCrns, s.crn] })}>
                              {sel.excludedCrns.includes(s.crn) ? 'Un-exclude' : 'Exclude'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
