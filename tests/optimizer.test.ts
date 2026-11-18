import { describe, expect, it } from 'vitest';
import { BuildingCoordinates, Course, DayCode, Section } from '../src/@types/course';
import { OptimizerConstraints } from '../src/@types/schedule';
import { CourseSelection, ElectivePool } from '../src/@types/user';
import { ScheduleOptimizer } from '../src/core/engine/optimizer';
import { partsOfTermOverlap } from '../src/core/engine/validator';

const BUILDINGS: Record<string, BuildingCoordinates> = {
  SIEBEL: { code: 'SIEBEL', name: 'Siebel Center', lat: 40.1138, lng: -88.2249, quad: 'North/Engineering' },
  ECEB: { code: 'ECEB', name: 'ECE Building', lat: 40.1149, lng: -88.228, quad: 'North/Engineering' },
};

let crnCounter = 10000;
function meeting(days: DayCode[], start: number, end: number, building = 'SIEBEL') {
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { daysOfWeek: days, startMinutes: start, endMinutes: end, startTime: fmt(start), endTime: fmt(end), buildingCode: building, buildingName: building, room: '100', instructors: ['Doe, J'] };
}
function section(courseId: string, num: string, opts: Partial<Section> & { days?: DayCode[]; start?: number; end?: number } = {}): Section {
  const { days, start, end, ...rest } = opts;
  return {
    crn: String(crnCounter++),
    courseId,
    sectionNumber: num,
    type: num.startsWith('A') && num.includes('D') ? 'DIS' : 'LEC',
    deliveryMode: 'In-Person',
    partOfTerm: '1',
    linkGroup: 'ALL',
    linkRole: 'STANDALONE',
    meetings: days ? [meeting(days, start ?? 600, end ?? 650)] : [],
    enrollmentStatus: 'Open',
    statusText: 'Open',
    restrictions: [],
    gradeMetric: { courseCode: courseId, instructor: 'Doe, J', averageGpa: 3.4, percentAs: 55, sampleSize: 300, gpaStdDev: 0.1, semestersSampled: 5 },
    ...rest,
  };
}
function course(id: string, sections: Section[], credits = 3): Course {
  const [subject, number] = id.split(' ');
  return {
    id, campusId: 'uiuc', term: '2026-fall', subject, number, title: `${id} Title`, description: 'Test course',
    creditHoursMin: credits, creditHoursMax: credits, genEdCategories: [], crossListedWith: [],
    offeringPattern: 'Fall & Spring', restrictions: [], prerequisitesText: '', unlocksCourses: [],
    courseAverageGpa: 3.4, sections,
  };
}
const BASE: OptimizerConstraints = {
  minCredits: 3, maxCredits: 18, minBreakMinutes: 0, earliestStartMinutes: 480, latestEndMinutes: 1260,
  protectMiddayLunch: false, minimizeSingleClassDays: false, includeClosedSections: false, blockedTimes: [], lockedCrns: [],
};
const sel = (courseId: string, extra: Partial<CourseSelection> = {}): CourseSelection => ({
  courseId, tier: 'MUST_TAKE', creditHoursSelected: 3, isCreditNoCredit: false, pinnedCrns: [], excludedCrns: [], ...extra,
});

describe('linked bundles', () => {
  it('never splits incompatible link groups (AL1 + BD1 is rejected)', () => {
    crnCounter = 20000;
    const cs225 = course('CS 225', [
      section('CS 225', 'AL1', { linkGroup: 'A', linkRole: 'PRIMARY', days: ['M', 'W', 'F'], start: 600, end: 650 }),
      section('CS 225', 'BL1', { linkGroup: 'B', linkRole: 'PRIMARY', days: ['M', 'W', 'F'], start: 720, end: 770 }),
      section('CS 225', 'AD1', { type: 'DIS', linkGroup: 'A', linkRole: 'SECONDARY', days: ['T'], start: 540, end: 590 }),
      section('CS 225', 'AD2', { type: 'DIS', linkGroup: 'A', linkRole: 'SECONDARY', days: ['T'], start: 660, end: 710 }),
      section('CS 225', 'BD1', { type: 'DIS', linkGroup: 'B', linkRole: 'SECONDARY', days: ['R'], start: 540, end: 590 }),
      section('CS 225', 'BD2', { type: 'DIS', linkGroup: 'B', linkRole: 'SECONDARY', days: ['R'], start: 660, end: 710 }),
    ], 4);
    const opt = new ScheduleOptimizer([cs225], BUILDINGS, [sel('CS 225', { creditHoursSelected: 4 })], [], BASE, 'Balanced');
    const bundles = opt.generateLinkedBundlesForCourse(cs225, [], []);
    expect(bundles.length).toBe(4); // AL1x{AD1,AD2} + BL1x{BD1,BD2}
    for (const b of bundles) {
      const groups = new Set(b.allSections.map((s) => s.linkGroup));
      expect(groups.size).toBe(1);
      const nums = b.allSections.map((s) => s.sectionNumber);
      expect(nums.includes('AL1') && nums.includes('BD1')).toBe(false);
      expect(nums.includes('BL1') && nums.includes('AD1')).toBe(false);
    }
    const { options } = opt.solve();
    expect(options.length).toBeGreaterThan(0);
  });
});

describe('Part of Term overlap', () => {
  it('A vs B are disjoint; A vs full-term overlaps; SF never overlaps', () => {
    expect(partsOfTermOverlap('A', 'B')).toBe(false);
    expect(partsOfTermOverlap('B', 'A')).toBe(false);
    expect(partsOfTermOverlap('A', 'A')).toBe(true);
    expect(partsOfTermOverlap('1', 'B')).toBe(true);
    expect(partsOfTermOverlap('SF', '1')).toBe(false);
    expect(partsOfTermOverlap('SF', 'SF')).toBe(false);
  });

  it('allows a Part A and a Part B course at the same clock time in one schedule', () => {
    const a = course('CS 199', [section('CS 199', 'A1', { partOfTerm: 'A', days: ['M', 'W', 'F'], start: 600, end: 650 })], 2);
    const b = course('PHIL 102', [section('PHIL 102', 'A1', { partOfTerm: 'B', days: ['M', 'W', 'F'], start: 600, end: 650 })]);
    const opt = new ScheduleOptimizer([a, b], BUILDINGS, [sel('CS 199', { creditHoursSelected: 2 }), sel('PHIL 102')], [], BASE, 'Balanced');
    const { options, conflictDiagnosis } = opt.solve();
    expect(conflictDiagnosis).toBeNull();
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].activeCourseIds.sort()).toEqual(['CS 199', 'PHIL 102']);
  });
});

describe('elective pools', () => {
  it('evaluates all candidates when the first pool candidate conflicts', () => {
    const core = course('CS 225', [section('CS 225', 'A1', { days: ['M', 'W', 'F'], start: 600, end: 650 })], 4);
    const c411 = course('CS 411', [section('CS 411', 'A1', { days: ['M', 'W', 'F'], start: 600, end: 650 })]); // conflicts with core
    const c425 = course('CS 425', [section('CS 425', 'A1', { days: ['T', 'R'], start: 750, end: 825 })]);
    const c440 = course('CS 440', [section('CS 440', 'A1', { days: ['M', 'W', 'F'], start: 900, end: 950 })]);
    const pool: ElectivePool = { id: 'p1', name: 'Tech Elective', courseIds: ['CS 411', 'CS 425', 'CS 440'], pickCount: 1 };
    const opt = new ScheduleOptimizer([core, c411, c425, c440], BUILDINGS, [sel('CS 225', { creditHoursSelected: 4 })], [pool], BASE, 'Balanced');
    const { options } = opt.solve();
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(o.activeCourseIds).toContain('CS 225');
      expect(o.activeCourseIds).not.toContain('CS 411');
      expect(o.activeCourseIds.some((id) => id === 'CS 425' || id === 'CS 440')).toBe(true);
    }
  });
});

describe('MUS conflict diagnosis', () => {
  it('diagnoses two directly conflicting required courses with a DROP_COURSE resolution', () => {
    const a = course('MATH 241', [section('MATH 241', 'A1', { days: ['M', 'W', 'F'], start: 600, end: 650 })], 4);
    const b = course('STAT 400', [section('STAT 400', 'A1', { days: ['M', 'W', 'F'], start: 600, end: 650 })], 4);
    const opt = new ScheduleOptimizer([a, b], BUILDINGS, [sel('MATH 241', { creditHoursSelected: 4 }), sel('STAT 400', { creditHoursSelected: 4 })], [], BASE, 'Balanced');
    const { options, conflictDiagnosis } = opt.solve();
    expect(options).toEqual([]);
    expect(conflictDiagnosis).not.toBeNull();
    expect(conflictDiagnosis!.conflictingCourseIds).toEqual(expect.arrayContaining(['MATH 241', 'STAT 400']));
    expect(conflictDiagnosis!.humanReadableReason).toContain('MATH 241');
    expect(conflictDiagnosis!.resolutions.some((r) => r.type === 'DROP_COURSE')).toBe(true);
  });

  it('respects blocked times and closed sections', () => {
    const closedOnly = course('ECE 385', [section('ECE 385', 'A1', { enrollmentStatus: 'Closed', days: ['T'], start: 1080, end: 1250 })]);
    const opt = new ScheduleOptimizer([closedOnly], BUILDINGS, [sel('ECE 385')], [], BASE, 'Balanced');
    const { options, conflictDiagnosis } = opt.solve();
    expect(options).toEqual([]);
    expect(conflictDiagnosis!.resolutions.some((r) => r.type === 'ENABLE_CLOSED_SECTIONS')).toBe(true);
    const opt2 = new ScheduleOptimizer([closedOnly], BUILDINGS, [sel('ECE 385')], [], { ...BASE, includeClosedSections: true }, 'Balanced');
    expect(opt2.solve().options.length).toBeGreaterThan(0);
  });

  it('substitutes a backup course when the primary has no open bundles', () => {
    const primary = course('CS 411', [section('CS 411', 'A1', { enrollmentStatus: 'Closed', days: ['M'], start: 600, end: 650 })]);
    const backup = course('CS 412', [section('CS 412', 'A1', { days: ['T'], start: 600, end: 650 })]);
    const opt = new ScheduleOptimizer([primary, backup], BUILDINGS, [sel('CS 411', { backupCourseId: 'CS 412' })], [], BASE, 'Balanced');
    const { options } = opt.solve();
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].activeCourseIds).toContain('CS 412');
    expect(options[0].substitutedBackups).toEqual([{ primaryCourseId: 'CS 411', backupCourseId: 'CS 412' }]);
  });
});

describe('performance', () => {
  it('solves 6 courses + an elective pool quickly and finds options', () => {
    const mk = (id: string, days: DayCode[], start: number) => course(id, [
      section(id, 'A1', { days, start, end: start + 50 }),
      section(id, 'A2', { days, start: start + 120, end: start + 170 }),
    ]);
    const courses = [
      mk('CS 225', ['M', 'W', 'F'], 540), mk('MATH 241', ['M', 'W', 'F'], 660),
      mk('CS 374', ['T', 'R'], 570), mk('STAT 400', ['T', 'R'], 840),
      mk('PHIL 101', ['T', 'R'], 1020), mk('ECON 102', ['M', 'W', 'F'], 840),
      mk('CS 411', ['M', 'W'], 1020), mk('CS 425', ['T', 'R'], 660), mk('CS 440', ['W', 'F'], 1080),
    ];
    const sels = ['CS 225', 'MATH 241', 'CS 374', 'STAT 400', 'PHIL 101', 'ECON 102'].map((id) => sel(id));
    const pool: ElectivePool = { id: 'perf', name: 'CS Elective', courseIds: ['CS 411', 'CS 425', 'CS 440'], pickCount: 1 };
    const opt = new ScheduleOptimizer(courses, BUILDINGS, sels, [pool], { ...BASE, maxCredits: 24 }, 'Balanced');
    const t0 = performance.now();
    const { options } = opt.solve();
    const elapsed = performance.now() - t0;
    console.log(`[perf] 6 courses + pool solved in ${elapsed.toFixed(2)}ms, ${options.length} options`);
    expect(options.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
