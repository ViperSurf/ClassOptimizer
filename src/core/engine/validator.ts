// src/core/engine/validator.ts
import { BuildingCoordinates, DayCode, LinkedBundle, PartOfTerm, Section } from '../../@types/course';
import { BlockedTimeRange, OptimizerConstraints, WalkTransitionWarning } from '../../@types/schedule';

const EARTH_RADIUS_METERS = 6371000;
const WALKING_SPEED_METERS_PER_MIN = 78;
const DETOUR_CIRCUITY_FACTOR = 1.28;
const BUILDING_EXIT_ENTRY_BUFFER_MIN = 2;

export function estimateWalkingMinutes(
  b1Code: string,
  b2Code: string,
  buildings: Record<string, BuildingCoordinates>
): { minutes: number; meters: number } {
  if (!b1Code || !b2Code || b1Code === b2Code) {
    return { minutes: 0, meters: 0 };
  }
  const b1 = buildings[b1Code];
  const b2 = buildings[b2Code];
  if (!b1 || !b2) {
    return { minutes: 7, meters: 450 };
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b2.lat - b1.lat);
  const dLng = toRad(b2.lng - b1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(b1.lat)) * Math.cos(toRad(b2.lat)) * Math.sin(dLng / 2) ** 2;
  const straightMeters = 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const pathMeters = Math.round(straightMeters * DETOUR_CIRCUITY_FACTOR);
  const walkMinutes = Math.ceil(pathMeters / WALKING_SPEED_METERS_PER_MIN) + BUILDING_EXIT_ENTRY_BUFFER_MIN;
  return { minutes: walkMinutes, meters: pathMeters };
}

export function partsOfTermOverlap(p1: PartOfTerm, p2: PartOfTerm): boolean {
  if (p1 === 'SF' || p2 === 'SF') return false;
  if (p1 === '1' || p2 === '1') return true;
  return p1 === p2;
}

export function sectionsConflict(s1: Section, s2: Section, minBreakMinutes: number): boolean {
  if (s1.deliveryMode === 'Online Async' || s2.deliveryMode === 'Online Async') return false;
  if (!partsOfTermOverlap(s1.partOfTerm, s2.partOfTerm)) return false;
  for (const m1 of s1.meetings) {
    if (m1.startMinutes < 0 || m1.endMinutes < 0) continue;
    for (const m2 of s2.meetings) {
      if (m2.startMinutes < 0 || m2.endMinutes < 0) continue;
      const sharesDay = m1.daysOfWeek.some((d) => m2.daysOfWeek.includes(d));
      if (!sharesDay) continue;
      if (
        m1.startMinutes < m2.endMinutes + minBreakMinutes &&
        m2.startMinutes < m1.endMinutes + minBreakMinutes
      ) {
        return true;
      }
    }
  }
  return false;
}

export function sectionConflictsWithBlockedTime(s: Section, blockedTimes: BlockedTimeRange[]): boolean {
  if (s.deliveryMode === 'Online Async' || blockedTimes.length === 0) return false;
  for (const m of s.meetings) {
    if (m.startMinutes < 0) continue;
    for (const block of blockedTimes) {
      if (!m.daysOfWeek.includes(block.day)) continue;
      if (m.startMinutes < block.endMinutes && block.startMinutes < m.endMinutes) {
        return true;
      }
    }
  }
  return false;
}

export function sectionConflictsWithConstraints(s: Section, constraints: OptimizerConstraints): boolean {
  if (sectionConflictsWithBlockedTime(s, constraints.blockedTimes)) return true;
  for (const m of s.meetings) {
    if (m.startMinutes < 0) continue;
    if (m.startMinutes < constraints.earliestStartMinutes) return true;
    if (m.endMinutes > constraints.latestEndMinutes) return true;
  }
  return false;
}

export function satisfiesMiddayLunch(bundles: LinkedBundle[]): boolean {
  const LUNCH_START = 11 * 60 + 30;
  const LUNCH_END = 13 * 60 + 30;
  const MIN_LUNCH_DURATION = 45;
  const weekdays: DayCode[] = ['M', 'T', 'W', 'R', 'F'];
  for (const day of weekdays) {
    const intervals: Array<[number, number]> = [];
    for (const b of bundles) {
      for (const sec of b.allSections) {
        if (sec.deliveryMode === 'Online Async') continue;
        for (const m of sec.meetings) {
          if (m.startMinutes < 0 || !m.daysOfWeek.includes(day)) continue;
          const start = Math.max(LUNCH_START, m.startMinutes);
          const end = Math.min(LUNCH_END, m.endMinutes);
          if (start < end) intervals.push([start, end]);
        }
      }
    }
    if (intervals.length === 0) continue;
    intervals.sort((a, b) => a[0] - b[0]);
    let cursor = LUNCH_START;
    let maxFreeGap = 0;
    for (const [s, e] of intervals) {
      if (s > cursor) maxFreeGap = Math.max(maxFreeGap, s - cursor);
      cursor = Math.max(cursor, e);
    }
    maxFreeGap = Math.max(maxFreeGap, LUNCH_END - cursor);
    if (maxFreeGap < MIN_LUNCH_DURATION) return false;
  }
  return true;
}

export function computeWalkWarnings(
  bundles: LinkedBundle[],
  buildings: Record<string, BuildingCoordinates>
): WalkTransitionWarning[] {
  const warnings: WalkTransitionWarning[] = [];
  const weekdays: DayCode[] = ['M', 'T', 'W', 'R', 'F'];
  for (const day of weekdays) {
    const dayMeetings: Array<{
      courseId: string;
      partOfTerm: PartOfTerm;
      startMinutes: number;
      endMinutes: number;
      buildingCode: string;
      deliveryMode: string;
    }> = [];
    for (const b of bundles) {
      for (const s of b.allSections) {
        if (s.deliveryMode !== 'In-Person') continue;
        for (const m of s.meetings) {
          if (m.startMinutes >= 0 && m.daysOfWeek.includes(day)) {
            dayMeetings.push({
              courseId: b.courseId,
              partOfTerm: s.partOfTerm,
              startMinutes: m.startMinutes,
              endMinutes: m.endMinutes,
              buildingCode: m.buildingCode,
              deliveryMode: s.deliveryMode,
            });
          }
        }
      }
    }
    dayMeetings.sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 0; i < dayMeetings.length - 1; i++) {
      const prev = dayMeetings[i];
      const next = dayMeetings[i + 1];
      if (!partsOfTermOverlap(prev.partOfTerm, next.partOfTerm)) continue;
      const gap = next.startMinutes - prev.endMinutes;
      if (gap <= 20 && prev.buildingCode !== next.buildingCode) {
        const { minutes, meters } = estimateWalkingMinutes(prev.buildingCode, next.buildingCode, buildings);
        warnings.push({
          day,
          fromCourseId: prev.courseId,
          fromBuilding: prev.buildingCode,
          toCourseId: next.courseId,
          toBuilding: next.buildingCode,
          gapMinutes: gap,
          estimatedWalkMinutes: minutes,
          distanceMeters: meters,
          isTight: minutes > gap - 2,
        });
      }
    }
  }
  return warnings;
}
