import React from 'react';
import { ScheduleOption } from '../../@types/schedule';
import { Badge } from '../common/Badge';

export function AsyncTray({ option }: { option: ScheduleOption | null }) {
  if (!option) return null;
  const asyncBundles = option.bundles.flatMap((b) =>
    b.allSections.filter((s) => s.deliveryMode === 'Online Async' || s.meetings.every((m) => m.startMinutes < 0))
      .map((s) => ({ courseId: b.courseId, section: s }))
  );
  if (asyncBundles.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Online Async / ARR</span>
      {asyncBundles.map(({ courseId, section }) => (
        <Badge key={section.crn} tone="violet">{courseId} {section.type} {section.sectionNumber} · CRN {section.crn} · no set meeting time</Badge>
      ))}
    </div>
  );
}
