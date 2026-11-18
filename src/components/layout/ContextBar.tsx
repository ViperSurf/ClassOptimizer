import React from 'react';
import { AcademicStanding, StudentContext } from '../../@types/user';
import { CampusId, TermDescriptor, TermSlug } from '../../@types/course';
import { Badge } from '../common/Badge';

interface Props {
  context: StudentContext;
  availableTerms: TermDescriptor[];
  onContextChange: (ctx: StudentContext) => void;
  onTermChange: (term: TermSlug) => void;
}

const COLLEGES = ['Grainger College of Engineering', 'College of Liberal Arts & Sciences', 'Gies College of Business', 'College of Education', 'College of ACES', 'School of Information Sciences'];
const MAJORS = ['Computer Science', 'Computer Engineering', 'Electrical Engineering', 'Mathematics', 'Statistics', 'Economics', 'Psychology', 'Undeclared'];

export function ContextBar({ context, availableTerms, onContextChange, onTermChange }: Props) {
  const set = (patch: Partial<StudentContext>) => onContextChange({ ...context, ...patch });
  return (
    <div className="space-y-3 border-b border-slate-800 p-4">
      <div>
        <h1 className="text-xl font-bold text-white">ClassOptimizer</h1>
        <p className="text-xs text-slate-400">Constraint-based schedule optimizer · linked sections · walking time · GPA data</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Semester</span>
        <select
          value={context.term}
          onChange={(e) => { const slug = e.target.value as TermSlug; set({ term: slug }); onTermChange(slug); }}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {availableTerms.map((t) => (
            <option key={t.slug} value={t.slug}>{t.label} — {t.courseCount} courses</option>
          ))}
        </select>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {availableTerms.filter((t) => t.slug === context.term).map((t) => (
            <span key={t.slug} className="flex gap-1.5">
              {t.isCurrent && <Badge tone="green">Current Term</Badge>}
              {t.isUpcomingRegistration && <Badge tone="blue">Registration Open</Badge>}
              {!t.isCurrent && !t.isUpcomingRegistration && <Badge tone="slate">Future Term</Badge>}
            </span>
          ))}
        </span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Campus</span>
          <select value={context.campusId} onChange={(e) => set({ campusId: e.target.value as CampusId })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
            <option value="uiuc">UIUC</option><option value="uic">UIC</option><option value="uis">UIS</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Standing</span>
          <select value={context.standing} onChange={(e) => set({ standing: e.target.value as AcademicStanding })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
            {(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as AcademicStanding[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">College</span>
          <select value={context.college} onChange={(e) => set({ college: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
            {COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Major</span>
          <select value={context.major} onChange={(e) => set({ major: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
            {MAJORS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
