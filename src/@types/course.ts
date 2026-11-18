export type CampusId = 'uiuc' | 'uic' | 'uis';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type TermSlug = `${number}-${Season}`;
export type DeliveryMode = 'In-Person' | 'Online Sync' | 'Online Async';
export type PartOfTerm = '1' | 'A' | 'B' | 'SF';
export type SectionType = 'LEC' | 'DIS' | 'LAB' | 'LBD' | 'Q' | 'ONL' | 'IND' | 'CONF' | 'PKG';
export type EnrollmentStatus = 'Open' | 'Closed' | 'Waitlist' | 'Unknown';
export type DayCode = 'M' | 'T' | 'W' | 'R' | 'F' | 'S' | 'U';

export interface TermDescriptor {
  slug: TermSlug;
  year: number;
  season: Season;
  label: string;
  campusId: CampusId;
  isCurrent: boolean;
  isUpcomingRegistration: boolean;
  startDate: string;
  midTermDate: string;
  endDate: string;
  lastUpdatedIso: string;
  courseCount: number;
  bundlePath: string;
  sha256: string;
}

export interface TermManifest {
  generatedAtIso: string;
  defaultTermByCampus: Record<CampusId, TermSlug>;
  terms: TermDescriptor[];
}

export interface BuildingCoordinates {
  code: string;
  name: string;
  lat: number;
  lng: number;
  quad: 'North/Engineering' | 'Main Quad' | 'South Quad' | 'Research Park' | 'Off-Campus';
}

export interface GradeDisparityMetric {
  courseCode: string;
  instructor: string;
  averageGpa: number;
  percentAs: number;
  sampleSize: number;
  gpaStdDev: number;
  semestersSampled: number;
}

export interface MeetingTime {
  daysOfWeek: DayCode[];
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  buildingCode: string;
  buildingName: string;
  room: string;
  instructors: string[];
}

export interface Section {
  crn: string;
  courseId: string;
  sectionNumber: string;
  sectionTitle?: string;
  type: SectionType;
  deliveryMode: DeliveryMode;
  partOfTerm: PartOfTerm;
  linkGroup: string;
  linkRole: 'STANDALONE' | 'PRIMARY' | 'SECONDARY';
  meetings: MeetingTime[];
  enrollmentStatus: EnrollmentStatus;
  statusText: string;
  creditHours?: number;
  restrictions: string[];
  notes?: string;
  gradeMetric?: GradeDisparityMetric;
}

export interface LinkedBundle {
  bundleId: string;
  courseId: string;
  primarySection: Section;
  secondarySections: Section[];
  allSections: Section[];
  containsClosed: boolean;
  effectiveGpa: number | null;
}

export interface Course {
  id: string;
  campusId: CampusId;
  term: TermSlug;
  subject: string;
  number: string;
  title: string;
  description: string;
  creditHoursMin: number;
  creditHoursMax: number;
  genEdCategories: string[];
  crossListedWith: string[];
  offeringPattern: 'Fall Only' | 'Spring Only' | 'Fall & Spring' | 'Periodic';
  restrictions: string[];
  prerequisitesText: string;
  unlocksCourses: string[];
  courseAverageGpa: number | null;
  sections: Section[];
}

export interface TermCatalogBundle {
  campusId: CampusId;
  term: TermSlug;
  label: string;
  generatedAtIso: string;
  startDate: string;
  midTermDate: string;
  endDate: string;
  courses: Course[];
}
