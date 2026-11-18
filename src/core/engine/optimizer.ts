// src/core/engine/optimizer.ts
import { BuildingCoordinates, Course, LinkedBundle, Section } from '../../@types/course';
import {
  ConflictDiagnosis,
  ConflictResolutionAction,
  OptimizerConstraints,
  PriorityFocus,
  ScheduleOption,
} from '../../@types/schedule';
import { CourseSelection, ElectivePool } from '../../@types/user';
import {
  computeWalkWarnings,
  satisfiesMiddayLunch,
  sectionConflictsWithBlockedTime,
  sectionsConflict,
} from './validator';
import { scoreScheduleOption } from './scoring';

export { computeWalkWarnings };

interface ChoiceSlot {
  slotId: string;
  isOptional: boolean;
  bundles: LinkedBundle[];
  creditMap: Map<string, number>;
}

export class ScheduleOptimizer {
  private courseMap: Map<string, Course>;
  private buildings: Record<string, BuildingCoordinates>;
  private selections: CourseSelection[];
  private pools: ElectivePool[];
  private constraints: OptimizerConstraints;
  private focus: PriorityFocus;

  constructor(
    courses: Course[],
    buildings: Record<string, BuildingCoordinates>,
    selections: CourseSelection[],
    pools: ElectivePool[],
    constraints: OptimizerConstraints,
    focus: PriorityFocus
  ) {
    this.courseMap = new Map(courses.map((c) => [c.id, c]));
    this.buildings = buildings;
    this.selections = selections;
    this.pools = pools;
    this.constraints = constraints;
    this.focus = focus;
  }

  public solve(): { options: ScheduleOption[]; conflictDiagnosis: ConflictDiagnosis | null } {
    const slots = this.buildChoiceSlots();
    if (slots.length === 0) {
      return { options: [], conflictDiagnosis: null };
    }
    const emptyRequiredSlot = slots.find((s) => !s.isOptional && s.bundles.length === 0);
    if (emptyRequiredSlot) {
      return { options: [], conflictDiagnosis: this.diagnoseZeroScheduleFailure(slots) };
    }
    const requiredSlots = slots.filter((s) => !s.isOptional).sort((a, b) => a.bundles.length - b.bundles.length);
    const optionalSlots = slots.filter((s) => s.isOptional);
    const orderedSlots = [...requiredSlots, ...optionalSlots];
    const rawSolutions: LinkedBundle[][] = [];
    const MAX_SOLUTIONS = 120;
    this.backtrack(0, orderedSlots, [], new Set<string>(), 0, rawSolutions, MAX_SOLUTIONS);
    if (rawSolutions.length === 0) {
      return { options: [], conflictDiagnosis: this.diagnoseZeroScheduleFailure(orderedSlots) };
    }
    const scoredOptions = rawSolutions.map((bundles, idx) =>
      scoreScheduleOption(bundles, `opt-${idx + 1}`, this.courseMap, this.selections, this.buildings, this.constraints, this.focus)
    );
    const ranked = scoredOptions.sort((a, b) => b.score - a.score).slice(0, 25).map((opt, idx) => ({ ...opt, rank: idx + 1 }));
    return { options: ranked, conflictDiagnosis: null };
  }

  private buildChoiceSlots(): ChoiceSlot[] {
    const slots: ChoiceSlot[] = [];
    for (const sel of this.selections) {
      const primaryCourse = this.courseMap.get(sel.courseId);
      if (!primaryCourse) continue;
      const creditMap = new Map<string, number>();
      creditMap.set(primaryCourse.id, sel.creditHoursSelected || primaryCourse.creditHoursMin);
      let bundles = this.generateLinkedBundlesForCourse(primaryCourse, sel.pinnedCrns, sel.excludedCrns);
      let substituted = false;
      if (bundles.length === 0 && sel.backupCourseId) {
        const backupCourse = this.courseMap.get(sel.backupCourseId);
        if (backupCourse) {
          creditMap.set(backupCourse.id, backupCourse.creditHoursMin);
          bundles = this.generateLinkedBundlesForCourse(backupCourse, [], []);
          substituted = bundles.length > 0;
        }
      }
      void substituted;
      slots.push({ slotId: `course:${sel.courseId}`, isOptional: sel.tier === 'BACKUP_OPTIONAL', bundles, creditMap });
    }
    for (const pool of this.pools) {
      const poolBundles: LinkedBundle[] = [];
      const creditMap = new Map<string, number>();
      for (const cid of pool.courseIds) {
        const c = this.courseMap.get(cid);
        if (!c) continue;
        creditMap.set(c.id, c.creditHoursMin);
        poolBundles.push(...this.generateLinkedBundlesForCourse(c, [], []));
      }
      const pickCount = Math.max(1, Math.min(pool.pickCount, pool.courseIds.length));
      for (let k = 0; k < pickCount; k++) {
        slots.push({ slotId: `pool:${pool.id}:${k}`, isOptional: false, bundles: poolBundles, creditMap });
      }
    }
    return slots;
  }

  public generateLinkedBundlesForCourse(
    course: Course,
    pinnedCrns: string[] = [],
    excludedCrns: string[] = []
  ): LinkedBundle[] {
    const lockedSet = new Set([...this.constraints.lockedCrns, ...pinnedCrns]);
    const excludedSet = new Set(excludedCrns);
    const eligibleSections = course.sections.filter((sec) => {
      if (excludedSet.has(sec.crn)) return false;
      if (lockedSet.has(sec.crn)) return true;
      if (!this.constraints.includeClosedSections && sec.enrollmentStatus === 'Closed') return false;
      if (sectionConflictsWithBlockedTime(sec, this.constraints.blockedTimes)) return false;
      return true;
    });
    const coursePinnedCrns = course.sections.map((s) => s.crn).filter((crn) => lockedSet.has(crn));
    const primaries = eligibleSections.filter((s) => s.linkRole === 'PRIMARY' || s.linkRole === 'STANDALONE');
    const secondaries = eligibleSections.filter((s) => s.linkRole === 'SECONDARY');
    const bundles: LinkedBundle[] = [];
    for (const pri of primaries) {
      if (pri.linkRole === 'STANDALONE') {
        if (coursePinnedCrns.length > 0 && !coursePinnedCrns.includes(pri.crn)) continue;
        bundles.push(this.createBundle(course, pri, []));
        continue;
      }
      // Linked bundles: a secondary is compatible only when its linkGroup matches the
      // primary's linkGroup (or either side is 'ALL'). AL1 (A) never pairs with BD1 (B).
      const matchingSubs = secondaries.filter(
        (sub) => sub.linkGroup === pri.linkGroup || sub.linkGroup === 'ALL' || pri.linkGroup === 'ALL'
      );
      const subsByType = new Map<string, Section[]>();
      for (const sub of matchingSubs) {
        const list = subsByType.get(sub.type) ?? [];
        list.push(sub);
        subsByType.set(sub.type, list);
      }
      const subTypeGroups = Array.from(subsByType.values());
      if (subTypeGroups.length === 0) continue;
      const subCombos = this.cartesianSections(subTypeGroups);
      for (const combo of subCombos) {
        const allSecs = [pri, ...combo];
        if (coursePinnedCrns.length > 0 && !coursePinnedCrns.every((pCrn) => allSecs.some((s) => s.crn === pCrn))) continue;
        if (this.hasInternalConflict(allSecs)) continue;
        bundles.push(this.createBundle(course, pri, combo));
      }
    }
    return bundles;
  }

  private createBundle(course: Course, primary: Section, secondaries: Section[]): LinkedBundle {
    const allSections = [primary, ...secondaries];
    const allCrns = allSections.map((s) => s.crn).sort();
    const gpas = allSections.map((s) => s.gradeMetric?.averageGpa).filter((g): g is number => typeof g === 'number');
    const effectiveGpa = gpas.length > 0 ? gpas.reduce((a, b) => a + b, 0) / gpas.length : course.courseAverageGpa;
    return {
      bundleId: `${course.id}:${allCrns.join('-')}`,
      courseId: course.id,
      primarySection: primary,
      secondarySections: secondaries,
      allSections,
      containsClosed: allSections.some((s) => s.enrollmentStatus === 'Closed'),
      effectiveGpa,
    };
  }

  private cartesianSections(groups: Section[][]): Section[][] {
    return groups.reduce<Section[][]>((acc, group) => acc.flatMap((prev) => group.map((item) => [...prev, item])), [[]]);
  }

  private hasInternalConflict(sections: Section[]): boolean {
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        if (sectionsConflict(sections[i], sections[j], 0)) return true;
      }
    }
    return false;
  }

  private backtrack(
    slotIdx: number,
    slots: ChoiceSlot[],
    chosenBundles: LinkedBundle[],
    usedCourseIds: Set<string>,
    currentCredits: number,
    results: LinkedBundle[][],
    maxResults: number
  ): void {
    if (results.length >= maxResults) return;
    if (slotIdx === slots.length) {
      if (currentCredits >= this.constraints.minCredits || chosenBundles.length === slots.length) {
        if (!this.constraints.protectMiddayLunch || satisfiesMiddayLunch(chosenBundles)) {
          results.push([...chosenBundles]);
        }
      }
      return;
    }
    const slot = slots[slotIdx];
    for (const candidate of slot.bundles) {
      if (usedCourseIds.has(candidate.courseId)) continue;
      const candCourse = this.courseMap.get(candidate.courseId);
      if (candCourse?.crossListedWith.some((xId) => usedCourseIds.has(xId))) continue;
      const addedCredits = slot.creditMap.get(candidate.courseId) ?? 3;
      if (currentCredits + addedCredits > this.constraints.maxCredits) continue;
      if (this.isBundleCompatibleWithSchedule(candidate, chosenBundles)) {
        chosenBundles.push(candidate);
        usedCourseIds.add(candidate.courseId);
        this.backtrack(slotIdx + 1, slots, chosenBundles, usedCourseIds, currentCredits + addedCredits, results, maxResults);
        chosenBundles.pop();
        usedCourseIds.delete(candidate.courseId);
      }
    }
    if (slot.isOptional) {
      this.backtrack(slotIdx + 1, slots, chosenBundles, usedCourseIds, currentCredits, results, maxResults);
    }
  }

  public isBundleCompatibleWithSchedule(candidate: LinkedBundle, existing: LinkedBundle[]): boolean {
    for (const ext of existing) {
      for (const s1 of candidate.allSections) {
        for (const s2 of ext.allSections) {
          if (sectionsConflict(s1, s2, this.constraints.minBreakMinutes)) return false;
        }
      }
    }
    return true;
  }

  public diagnoseZeroScheduleFailure(slots?: ChoiceSlot[]): ConflictDiagnosis {
    const effectiveSlots = slots ?? this.buildChoiceSlots();
    const resolutions: ConflictResolutionAction[] = [];
    const conflictingCourseIds: string[] = [];
    for (const slot of effectiveSlots) {
      if (slot.bundles.length === 0) {
        const courseId = slot.slotId.replace('course:', '').split(':')[0];
        conflictingCourseIds.push(courseId);
        if (!this.constraints.includeClosedSections) {
          resolutions.push({ type: 'ENABLE_CLOSED_SECTIONS', label: `Include Closed/Waitlist sections for ${courseId} (Plan B Mode)`, targetId: courseId });
        }
        const sel = this.selections.find((s) => s.courseId === courseId);
        if (sel && sel.pinnedCrns.length > 0) {
          resolutions.push({ type: 'UNPIN_CRN', label: `Unpin locked CRN (${sel.pinnedCrns.join(', ')}) on ${courseId}`, targetId: courseId });
        }
        if (this.constraints.blockedTimes.length > 0) {
          resolutions.push({ type: 'REMOVE_BLOCKED_TIME', label: `Clear blocked busy times overlapping with ${courseId}`, targetId: this.constraints.blockedTimes[0].id });
        }
      }
    }
    for (let i = 0; i < effectiveSlots.length; i++) {
      for (let j = i + 1; j < effectiveSlots.length; j++) {
        const sA = effectiveSlots[i];
        const sB = effectiveSlots[j];
        if (sA.bundles.length === 0 || sB.bundles.length === 0) continue;
        let pairHasValidCombo = false;
        outer: for (const bA of sA.bundles) {
          for (const bB of sB.bundles) {
            if (bA.courseId === bB.courseId) continue;
            if (this.isBundleCompatibleWithSchedule(bA, [bB])) { pairHasValidCombo = true; break outer; }
          }
        }
        if (!pairHasValidCombo) {
          const cA = sA.bundles[0].courseId;
          const cB = sB.bundles[0].courseId;
          if (cA !== cB) {
            conflictingCourseIds.push(cA, cB);
            resolutions.push({ type: 'DROP_COURSE', label: `Move ${cB} to Backup/Optional tier (direct time conflict with ${cA})`, targetId: cB });
          }
        }
      }
    }
    if (this.constraints.protectMiddayLunch) {
      resolutions.push({ type: 'DISABLE_LUNCH_GUARD', label: 'Disable Midday Lunch Protection (11:30–13:30)', targetId: 'protectMiddayLunch' });
    }
    const uniqueCourses = Array.from(new Set(conflictingCourseIds));
    return {
      conflictingCourseIds: uniqueCourses,
      humanReadableReason:
        uniqueCourses.length >= 2
          ? `Direct schedule conflict detected between ${uniqueCourses.join(' and ')}.`
          : uniqueCourses.length === 1
          ? `No open sections of ${uniqueCourses[0]} fit your current time blocks or pinned CRNs.`
          : 'Your combined credit limits, lunch protection, or time blocks leave 0 valid permutations.',
      resolutions: resolutions.slice(0, 4),
    };
  }
}
