import React, { useRef, useState } from 'react';
import { DayCode } from '../../@types/course';
import { BlockedTimeRange, ScheduleOption } from '../../@types/schedule';
import { DAY_LABELS, DAY_ORDER, minutesTo12h } from '../../core/utils/timeUtils';

const START = 8 * 60;
const END = 21 * 60;
const PX_PER_MIN = 0.8; // 48px per hour
const HEIGHT = (END - START) * PX_PER_MIN;
const COLORS = ['bg-sky-700', 'bg-emerald-700', 'bg-violet-700', 'bg-amber-700', 'bg-rose-700', 'bg-cyan-700', 'bg-indigo-700', 'bg-teal-700'];

interface Props {
  option: ScheduleOption | null;
  blockedTimes: BlockedTimeRange[];
  onBlock: (day: DayCode, startMinutes: number, endMinutes: number) => void;
  onRemoveBlock: (id: string) => void;
  onPinCrn: (courseId: string, crn: string) => void;
}

export function WeeklyGrid({ option, blockedTimes, onBlock, onRemoveBlock, onPinCrn }: Props) {
  const [drag, setDrag] = useState<{ day: DayCode; start: number; current: number } | null>(null);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const colorFor = (courseId: string) => {
    let h = 0;
    for (let i = 0; i < courseId.length; i++) h = (h * 31 + courseId.charCodeAt(i)) >>> 0;
    return COLORS[h % COLORS.length];
  };

  const minutesFromEvent = (day: DayCode, e: React.PointerEvent) => {
    const el = colRefs.current[day];
    if (!el) return START;
    const rect = el.getBoundingClientRect();
    const y = Math.min(Math.max(e.clientY - rect.top, 0), HEIGHT);
    const raw = START + y / PX_PER_MIN;
    return Math.round(raw / 15) * 15;
  };

  const blocksForDay = (day: DayCode) => {
    if (!option) return [];
    const out: Array<{ key: string; courseId: string; crn: string; label: string; sub: string; start: number; end: number; part: string; gpa: number | null }> = [];
    for (const b of option.bundles) {
      for (const sec of b.allSections) {
        if (sec.deliveryMode === 'Online Async') continue;
        for (const m of sec.meetings) {
          if (m.startMinutes < 0 || !m.daysOfWeek.includes(day)) continue;
          out.push({
            key: `${sec.crn}-${day}`,
            courseId: b.courseId,
            crn: sec.crn,
            label: `${b.courseId} ${sec.type} ${sec.sectionNumber}`,
            sub: `${m.buildingName ? m.buildingName.split(' ').slice(0, 2).join(' ') : ''} ${m.room} · CRN ${sec.crn}${m.instructors[0] ? ` · ${m.instructors[0]}` : ''}`,
            start: m.startMinutes, end: m.endMinutes,
            part: sec.partOfTerm,
            gpa: sec.gradeMetric?.averageGpa ?? b.effectiveGpa,
          });
        }
      }
    }
    return out;
  };

  return (
    <div className="flex-1 overflow-auto p-3">
      <p className="mb-2 text-[11px] text-slate-500">Drag on empty space to block busy time · Click a class block to pin that CRN · Click a blocked range to remove it</p>
      <div className="grid min-w-[760px] grid-cols-[52px_repeat(7,1fr)] gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800">
        <div className="bg-slate-900" />
        {DAY_ORDER.map((d) => (
          <div key={d} className="bg-slate-900 px-2 py-1.5 text-center text-xs font-semibold text-slate-200">{DAY_LABELS[d]}</div>
        ))}
        <div className="relative bg-slate-950" style={{ height: HEIGHT }}>
          {Array.from({ length: END / 60 - START / 60 + 1 }, (_, i) => START / 60 + i).map((h) => (
            <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-500" style={{ top: (h * 60 - START) * PX_PER_MIN }}>
              {minutesTo12h(h * 60)}
            </div>
          ))}
        </div>
        {DAY_ORDER.map((day) => (
          <div
            key={day}
            ref={(el) => { colRefs.current[day] = el; }}
            className="relative touch-none select-none bg-slate-950"
            style={{ height: HEIGHT, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(100,116,139,0.18) 47px, rgba(100,116,139,0.18) 48px)' }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.block) return;
              const m = minutesFromEvent(day, e);
              setDrag({ day, start: m, current: m });
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => { if (drag && drag.day === day) setDrag({ ...drag, current: minutesFromEvent(day, e) }); }}
            onPointerUp={() => {
              if (drag && drag.day === day) {
                const s = Math.min(drag.start, drag.current);
                const en = Math.max(drag.start, drag.current);
                if (en - s >= 15) onBlock(day, s, Math.max(en, s + 15));
              }
              setDrag(null);
            }}
          >
            {blockedTimes.filter((b) => b.day === day).map((b) => (
              <button key={b.id} type="button" data-block="1" title="Click to remove this blocked time"
                onClick={() => onRemoveBlock(b.id)}
                className="absolute left-0.5 right-0.5 z-10 rounded border border-dashed border-red-500/70 bg-red-950/50 px-1 text-left text-[10px] text-red-300"
                style={{ top: (b.startMinutes - START) * PX_PER_MIN, height: Math.max(14, (b.endMinutes - b.startMinutes) * PX_PER_MIN) }}>
                Blocked {minutesTo12h(b.startMinutes)}–{minutesTo12h(b.endMinutes)} ✕
              </button>
            ))}
            {drag && drag.day === day && (
              <div className="absolute left-0.5 right-0.5 z-10 rounded bg-red-500/30"
                style={{ top: (Math.min(drag.start, drag.current) - START) * PX_PER_MIN, height: Math.max(8, Math.abs(drag.current - drag.start) * PX_PER_MIN) }} />
            )}
            {blocksForDay(day).map((blk) => (
              <button key={blk.key} type="button" data-block="1"
                title={`Click to pin CRN ${blk.crn}`}
                onClick={() => onPinCrn(blk.courseId, blk.crn)}
                className={`absolute left-0.5 right-0.5 z-20 overflow-hidden rounded px-1.5 py-0.5 text-left text-white shadow ${colorFor(blk.courseId)} hover:ring-2 hover:ring-white/60`}
                style={{ top: (Math.max(blk.start, START) - START) * PX_PER_MIN, height: Math.max(20, (blk.end - blk.start) * PX_PER_MIN) }}>
                <span className="block truncate text-[11px] font-bold leading-tight">{blk.label}
                  {blk.part === 'A' && <span className="ml-1 rounded bg-black/40 px-1">8w-A</span>}
                  {blk.part === 'B' && <span className="ml-1 rounded bg-black/40 px-1">8w-B</span>}
                </span>
                <span className="block truncate text-[10px] leading-tight opacity-90">{minutesTo12h(blk.start)}–{minutesTo12h(blk.end)} · {blk.sub}</span>
                {typeof blk.gpa === 'number' && <span className="block text-[10px] leading-tight opacity-90">Instructor GPA {blk.gpa.toFixed(2)}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      {option && option.walkWarnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {option.walkWarnings.map((w, i) => (
            <span key={i} className={`rounded-full border px-2 py-0.5 text-[11px] ${w.isTight ? 'border-red-700 bg-red-900/50 text-red-200' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
              {DAY_LABELS[w.day]}: {w.fromCourseId} → {w.toCourseId} · {w.estimatedWalkMinutes} min walk · {w.gapMinutes} min gap{w.isTight ? ' · Tight' : ''}
            </span>
          ))}
        </div>
      )}
      {!option && (
        <p className="mt-3 text-sm text-slate-500">Add courses on the left and valid schedule options will appear here.</p>
      )}
    </div>
  );
}
