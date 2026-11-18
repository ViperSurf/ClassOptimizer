// src/core/engine/scoring.ts
import { BuildingCoordinates, Course, LinkedBundle } from '../../@types/course';
import { OptimizerConstraints, PriorityFocus, ScheduleOption } from '../../@types/schedule';
import { CourseSelection } from '../../@types/user';
import { computeWalkWarnings } from './validator';

function formatMinutesTo24h(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function scoreScheduleOption(
  bundles: LinkedBundle[],
  id: string,
  courseMap: Map<string, Course>,
  selections: CourseSelection[],
  buildings: Record<string, BuildingCoordinates>,
  constraints: OptimizerConstraints,
  focus: PriorityFocus
): ScheduleOption {
  let totalCredits = 0;
  let totalContactMinutes = 0;
  let weightedGpaSum = 0;
  let gpaCredits = 0;
  let coursesWithGpa = 0;
  let earliestMin = 24 * 60;
  let latestMin = 0;
  const dayClassCount = new Map<string, number>();

  for (const b of bundles) {
    const course = courseMap.get(b.courseId);
    const sel = selections.find((s) => s.courseId === b.courseId);
    const creds = sel?.creditHoursSelected ?? course?.creditHoursMin ?? 3;
    totalCredits += creds;
    if (typeof b.effectiveGpa === 'number') {
      coursesWithGpa++;
      if (!sel?.isCreditNoCredit) {
        weightedGpaSum += b.effectiveGpa * creds;
        gpaCredits += creds;
      }
    }
    for (const sec of b.allSections) {
      for (const m of sec.meetings) {
        if (m.startMinutes >= 0 && m.endMinutes > m.startMinutes) {
          const duration = m.endMinutes - m.startMinutes;
          totalContactMinutes += duration * m.daysOfWeek.length;
          earliestMin = Math.min(earliestMin, m.startMinutes);
          latestMin = Math.max(latestMin, m.endMinutes);
          for (const d of m.daysOfWeek) {
            dayClassCount.set(d, (dayClassCount.get(d) ?? 0) + 1);
          }
        }
      }
    }
  }

  const expectedGpa = gpaCredits > 0 ? Number((weightedGpaSum / gpaCredits).toFixed(2)) : 3.45;
  const walkWarnings = computeWalkWarnings(bundles, buildings);
  const maxWalkingMinutes = walkWarnings.reduce((max, w) => Math.max(max, w.estimatedWalkMinutes), 0);
  const hasTightWalks = walkWarnings.some((w) => w.isTight);
  const gpaScore = Math.min(100, Math.max(0, ((expectedGpa - 2.5) / 1.5) * 100));

  let timeScore = 100;
  if (earliestMin < 540) timeScore -= (540 - earliestMin) * 0.35;
  if (latestMin > 1020) timeScore -= (latestMin - 1020) * 0.25;
  if (constraints.minimizeSingleClassDays) {
    for (const count of dayClassCount.values()) {
      if (count === 1) timeScore -= 8;
    }
  }
  timeScore = Math.max(0, Math.min(100, timeScore));

  let walkScore = 100 - maxWalkingMinutes * 2.5 - (hasTightWalks ? 25 : 0);
  walkScore = Math.max(0, Math.min(100, walkScore));

  const weights =
    focus === 'Max GPA'
      ? { gpa: 0.70, time: 0.15, walk: 0.15 }
      : focus === 'Best Times'
      ? { gpa: 0.15, time: 0.70, walk: 0.15 }
      : focus === 'Shortest Walk'
      ? { gpa: 0.15, time: 0.15, walk: 0.70 }
      : { gpa: 0.40, time: 0.35, walk: 0.25 };

  const compositeScore = Number(
    (gpaScore * weights.gpa + timeScore * weights.time + walkScore * weights.walk).toFixed(1)
  );

  const substitutedBackups = selections
    .filter(
      (s) =>
        s.backupCourseId &&
        !bundles.some((b) => b.courseId === s.courseId) &&
        bundles.some((b) => b.courseId === s.backupCourseId)
    )
    .map((s) => ({ primaryCourseId: s.courseId, backupCourseId: s.backupCourseId! }));

  return {
    id,
    rank: 1,
    score: compositeScore,
    bundles,
    activeCourseIds: bundles.map((b) => b.courseId),
    substitutedBackups,
    totalCredits,
    weeklyContactHours: Number((totalContactMinutes / 60).toFixed(1)),
    expectedGpa,
    gpaConfidenceRatio: bundles.length > 0 ? coursesWithGpa / bundles.length : 1,
    earliestClassTime: earliestMin < 24 * 60 ? formatMinutesTo24h(earliestMin) : 'ARR',
    latestClassTime: latestMin > 0 ? formatMinutesTo24h(latestMin) : 'ARR',
    maxWalkingMinutes,
    walkWarnings,
    hasTightWalks,
    containsClosedSections: bundles.some((b) => b.containsClosed),
  };
}
