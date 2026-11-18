import { CampusId, TermSlug } from './course';
import { OptimizerConstraints, PriorityFocus } from './schedule';

export type AcademicStanding = 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate';
export type PriorityTier = 'MUST_TAKE' | 'HIGH_PRIORITY' | 'BACKUP_OPTIONAL';

export interface StudentContext {
  campusId: CampusId;
  term: TermSlug;
  college: string;
  major: string;
  standing: AcademicStanding;
  fulfilledGenEds: string[];
}

export interface CourseSelection {
  courseId: string;
  tier: PriorityTier;
  creditHoursSelected: number;
  isCreditNoCredit: boolean;
  pinnedCrns: string[];
  excludedCrns: string[];
  backupCourseId?: string;
}

export interface ElectivePool {
  id: string;
  name: string;
  courseIds: string[];
  pickCount: number;
}

export interface SharedPlanState {
  version: 2;
  context: StudentContext;
  selections: CourseSelection[];
  electivePools: ElectivePool[];
  constraints: OptimizerConstraints;
  focus: PriorityFocus;
  advisorNote?: string;
}

export interface UndoEntry {
  id: string;
  label: string;
  timestamp: number;
  previousState: {
    selections: CourseSelection[];
    electivePools: ElectivePool[];
    constraints: OptimizerConstraints;
  };
}
