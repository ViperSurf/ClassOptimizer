import React from 'react';

const TONES: Record<string, string> = {
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
  green: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  red: 'bg-red-900/60 text-red-300 border-red-700',
  amber: 'bg-amber-900/60 text-amber-300 border-amber-700',
  blue: 'bg-sky-900/60 text-sky-300 border-sky-700',
  violet: 'bg-violet-900/60 text-violet-300 border-violet-700',
};

export function Badge({ children, tone = 'slate', title }: { children: React.ReactNode; tone?: keyof typeof TONES; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone] ?? TONES.slate}`}>
      {children}
    </span>
  );
}

export function GpaBadge({ gpa, sampleSize }: { gpa: number | null | undefined; sampleSize?: number }) {
  if (typeof gpa !== 'number') return <Badge tone="slate">No GPA data</Badge>;
  const tone = gpa >= 3.5 ? 'green' : gpa >= 3.0 ? 'blue' : gpa >= 2.7 ? 'amber' : 'red';
  const confidence = typeof sampleSize === 'number' ? (sampleSize >= 100 ? 'High confidence' : sampleSize >= 30 ? 'Medium confidence' : 'Low confidence') : undefined;
  return <Badge tone={tone} title={confidence}>GPA {gpa.toFixed(2)}{confidence ? ` · ${confidence}` : ''}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'Open' ? 'green' : status === 'Closed' ? 'red' : status === 'Waitlist' ? 'amber' : 'slate';
  return <Badge tone={tone}>{status}</Badge>;
}
