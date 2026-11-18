// src/core/utils/timeUtils.ts
import { DayCode } from '../../@types/course';

export const DAY_ORDER: DayCode[] = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];
export const DAY_LABELS: Record<DayCode, string> = {
  M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', F: 'Fri', S: 'Sat', U: 'Sun',
};

/** "11:00" -> 660. Returns -1 for "ARR" / unparseable input. */
export function timeToMinutes(time: string): number {
  if (!time || time.trim().toUpperCase() === 'ARR') return -1;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 660 -> "11:00". Returns "ARR" for negative input. */
export function minutesToTime(minutes: number): string {
  if (minutes < 0) return 'ARR';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 660 -> "11:00 AM" */
export function minutesTo12h(minutes: number): string {
  if (minutes < 0) return 'ARR';
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${meridiem}`;
}

/** "02:50 PM" -> 890 */
export function parse12hToMinutes(raw: string): number {
  if (!raw || raw.toUpperCase().includes('ARR')) return -1;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeToMinutes(raw);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

// ---- Day bitmask helpers (bit 0 = Monday ... bit 6 = Sunday) ----
export function dayToBit(day: DayCode): number {
  const idx = DAY_ORDER.indexOf(day);
  return idx >= 0 ? 1 << idx : 0;
}

export function daysToMask(days: DayCode[]): number {
  return days.reduce((mask, d) => mask | dayToBit(d), 0);
}

export function maskHasDay(mask: number, day: DayCode): boolean {
  return (mask & dayToBit(day)) !== 0;
}

export function maskToDays(mask: number): DayCode[] {
  return DAY_ORDER.filter((d) => maskHasDay(mask, d));
}

export function masksShareDay(a: number, b: number): boolean {
  return (a & b) !== 0;
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd), with an optional required break. */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number, minBreakMinutes = 0): boolean {
  return aStart < bEnd + minBreakMinutes && bStart < aEnd + minBreakMinutes;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
