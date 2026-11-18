import React from 'react';
import { Course } from '../../@types/course';
import { ScheduleOption } from '../../@types/schedule';

interface Props {
  open: boolean;
  option: ScheduleOption | null;
  courses: Course[];
  onClose: () => void;
}

export function CheatSheetModal({ open, option, courses, onClose }: Props) {
  if (!open) return null;
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const rows = option?.bundles.map((b) => {
    const course = courseMap.get(b.courseId);
    const chosen = new Set(b.allSections.map((s) => s.crn));
    const backups = (course?.sections ?? []).filter((s) => !chosen.has(s.crn) && s.enrollmentStatus === 'Open').slice(0, 3);
    const notes = [...(course?.restrictions ?? []), ...b.allSections.flatMap((s) => s.restrictions)].filter(Boolean);
    return { bundle: b, backups, notes };
  }) ?? [];
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-white text-black" role="dialog" aria-modal="true" aria-label="Registration cheat sheet">
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black">7:00 AM Registration Cheat Sheet</h2>
            <p className="mt-1 text-lg">High-contrast mode. Keep this open next to Banner. Work top to bottom, fast.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border-2 border-black px-3 py-1.5 text-lg font-bold">Close ✕</button>
        </div>
        <ol className="mt-4 list-decimal space-y-1 pl-6 text-lg">
          <li>Open Banner XE → Registration → <strong>Enter CRNs</strong> tab.</li>
          <li>Paste the Banner Autofill snippet from ClassOptimizer into the browser console, or type each CRN below.</li>
          <li>Click <strong>Add to Summary</strong>, review, then <strong>Submit</strong>.</li>
          <li>If a section is full at 7:00:01 AM, swap in its backup CRN from the right column and resubmit.</li>
        </ol>
        <table className="mt-5 w-full border-collapse text-left text-lg">
          <thead>
            <tr className="border-b-4 border-black">
              <th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Enter these CRNs</th><th className="py-2 pr-3">Backup CRNs</th><th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bundle, backups, notes }) => (
              <tr key={bundle.bundleId} className="border-b-2 border-gray-400 align-top">
                <td className="py-2 pr-3 font-bold">{bundle.courseId}</td>
                <td className="py-2 pr-3 font-mono text-xl font-bold">{bundle.allSections.map((s) => s.crn).join('  ')}</td>
                <td className="py-2 pr-3 font-mono">{backups.length ? backups.map((s) => `${s.crn} (${s.sectionNumber})`).join(', ') : '—'}</td>
                <td className="py-2 text-base">{notes.length ? notes.join('; ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="mt-4 text-lg">No schedule option selected yet.</p>}
      </div>
    </div>
  );
}
