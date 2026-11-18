import { Course, DayCode, LinkedBundle, BuildingCoordinates } from './course';
import { CourseSelection, ElectivePool } from './user';

export type PriorityFocus = 'Balanced' | 'Max GPA' | 'Best Times' | 'Shortest Walk';

export interface BlockedTimeRange {
  id: string;
  day: DayCode;
  startMinutes: number;
  endMinutes: number;
  label?: string;
}

export interface OptimizerConstraints {
  minCredits: number;
  maxCredits: number;
  minBreakMinutes: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
  protectMiddayLunch: boolean;
  minimizeSingleClassDays: boolean;
  includeClosedSections: boolean;
  blockedTimes: BlockedTimeRange[];
  lockedCrns: string[];
}

export interface WalkTransitionWarning {
  day: DayCode;
  fromCourseId: string;
  fromBuilding: string;
  toCourseId: string;
  toBuilding: string;
  gapMinutes: number;
  estimatedWalkMinutes: number;
  distanceMeters: number;
  isTight: boolean;
}

export interface ScheduleOption {
  id: string;
  rank: number;
  score: number;
  bundles: LinkedBundle[];
  activeCourseIds: string[];
  substitutedBackups: Array<{ primaryCourseId: string; backupCourseId: string }>;
  totalCredits: number;
  weeklyContactHours: number;
  expectedGpa: number;
  gpaConfidenceRatio: number;
  earliestClassTime: string;
  latestClassTime: string;
  maxWalkingMinutes: number;
  walkWarnings: WalkTransitionWarning[];
  hasTightWalks: boolean;
  containsClosedSections: boolean;
}

export interface ConflictResolutionAction {
  type: 'UNPIN_CRN' | 'ENABLE_CLOSED_SECTIONS' | 'DROP_COURSE' | 'REMOVE_BLOCKED_TIME' | 'DISABLE_LUNCH_GUARD';
  label: string;
  targetId: string;
}

export interface ConflictDiagnosis {
  conflictingCourseIds: string[];
  humanReadableReason: string;
  resolutions: ConflictResolutionAction[];
}

export interface SolverInputPayload {
  requestId: number;
  courses: Course[];
  buildings: Record<string, BuildingCoordinates>;
  selections: CourseSelection[];
  electivePools: ElectivePool[];
  constraints: OptimizerConstraints;
  focus: PriorityFocus;
}

export interface SolverOutputPayload {
  requestId: number;
  executionTimeMs: number;
  options: ScheduleOption[];
  conflictDiagnosis: ConflictDiagnosis | null;
}

// Re-exported for convenience in utility modules
export type { Course, DayCode, LinkedBundle, BuildingCoordinates, CourseSelection, ElectivePool };
