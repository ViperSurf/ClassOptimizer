// src/core/utils/icsExport.ts
import { DayCode, TermDescriptor } from '../../@types/course';
import { ScheduleOption } from '../../@types/schedule';

const ICS_DAY_MAP: Record<DayCode, string> = {
  M: 'MO', T: 'TU', W: 'WE', R: 'TH', F: 'FR', S: 'SA', U: 'SU',
};

const JS_DAY_INDEX: Record<DayCode, number> = {
  U: 0, M: 1, T: 2, W: 3, R: 4, F: 5, S: 6,
};

function formatIcsDateTime(dateIso: string, minutesFromMidnight: number): string {
  const [yr, mo, da] = dateIso.split('-');
  const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0');
  const mm = String(minutesFromMidnight % 60).padStart(2, '0');
  return `${yr}${mo}${da}T${hh}${mm}00`;
}

function advanceToFirstMeetingDate(baseIsoDate: string, allowedDays: DayCode[]): string {
  const date = new Date(`${baseIsoDate}T12:00:00`);
  const allowedIndices = new Set(allowedDays.map((d) => JS_DAY_INDEX[d]));
  for (let offset = 0; offset < 7; offset++) {
    if (allowedIndices.has(date.getDay())) {
      return date.toISOString().slice(0, 10);
    }
    date.setDate(date.getDate() + 1);
  }
  return baseIsoDate;
}

export function generateIcsCalendar(option: ScheduleOption, term: TermDescriptor): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClassOptimizer//University Schedule Optimizer//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const bundle of option.bundles) {
    for (const sec of bundle.allSections) {
      if (sec.deliveryMode === 'Online Async') continue;

      // Part A stops at midterm; Part B starts at midterm; full-term and SF span the term.
      const partStartIso = sec.partOfTerm === 'B' ? term.midTermDate : term.startDate;
      const partEndIso = sec.partOfTerm === 'A' ? term.midTermDate : term.endDate;
      const untilToken = `${partEndIso.replace(/-/g, '')}T235959Z`;

      for (const m of sec.meetings) {
        if (m.startMinutes < 0 || m.daysOfWeek.length === 0) continue;
        const firstDateIso = advanceToFirstMeetingDate(partStartIso, m.daysOfWeek);
        const dtStart = formatIcsDateTime(firstDateIso, m.startMinutes);
        const dtEnd = formatIcsDateTime(firstDateIso, m.endMinutes);
        const byDay = m.daysOfWeek.map((d) => ICS_DAY_MAP[d]).join(',');

        lines.push(
          'BEGIN:VEVENT',
          `UID:${sec.crn}-${term.slug}-${byDay}@classoptimizer.local`,
          `SUMMARY:${bundle.courseId} (${sec.type} ${sec.sectionNumber})`,
          `LOCATION:${m.buildingName} ${m.room}`.trim(),
          `DESCRIPTION:CRN: ${sec.crn}\\nInstructor: ${m.instructors.join(', ') || 'Staff'}\\nTerm: ${term.label} (Part ${sec.partOfTerm})`,
          `DTSTART;TZID=America/Chicago:${dtStart}`,
          `DTEND;TZID=America/Chicago:${dtEnd}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${untilToken};BYDAY=${byDay}`,
          'END:VEVENT'
        );
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(option: ScheduleOption, term: TermDescriptor): void {
  const content = generateIcsCalendar(option, term);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `classoptimizer-${term.slug}-option-${option.rank}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
