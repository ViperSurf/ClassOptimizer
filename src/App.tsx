import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TermSlug } from './@types/course';
import { ConflictResolutionAction, OptimizerConstraints, PriorityFocus } from './@types/schedule';
import { CourseSelection, ElectivePool as Pool, SharedPlanState, StudentContext, UndoEntry } from './@types/user';
import { ScheduleOptimizer } from './core/engine/optimizer';
import { decodePlanFromUrlHash, encodePlanToUrlHash } from './core/utils/compression';
import { useCatalogData } from './hooks/useCatalogData';
import { useOptimizer } from './hooks/useOptimizer';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { usePersistedState } from './hooks/usePersistedState';
import { TwoPaneLayout } from './components/layout/TwoPaneLayout';
import { ContextBar } from './components/layout/ContextBar';
import { GenEdStrip } from './components/discovery/GenEdStrip';
import { CourseSearch, CourseSearchHandle } from './components/discovery/CourseSearch';
import { TierList } from './components/discovery/TierList';
import { ElectivePool } from './components/discovery/ElectivePool';
import { TopControlStrip } from './components/calendar/TopControlStrip';
import { WeeklyGrid } from './components/calendar/WeeklyGrid';
import { AsyncTray } from './components/calendar/AsyncTray';
import { ConflictBanner } from './components/calendar/ConflictBanner';
import { RegistrationBar } from './components/registration/RegistrationBar';
import { CheatSheetModal } from './components/registration/CheatSheetModal';
import { UndoSnackbar } from './components/common/UndoSnackbar';

const DEFAULT_CONSTRAINTS: OptimizerConstraints = {
  minCredits: 12,
  maxCredits: 18,
  minBreakMinutes: 10,
  earliestStartMinutes: 480,
  latestEndMinutes: 1260,
  protectMiddayLunch: false,
  minimizeSingleClassDays: false,
  includeClosedSections: false,
  blockedTimes: [],
  lockedCrns: [],
};

const DEFAULT_CONTEXT: StudentContext = {
  campusId: 'uiuc',
  term: '2027-spring',
  college: 'Grainger College of Engineering',
  major: 'Computer Science',
  standing: 'Junior',
  fulfilledGenEds: ['Composition I', 'Quantitative Reasoning I'],
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export default function App() {
  const sharedPlanRef = useRef<SharedPlanState | null>(null);
  if (sharedPlanRef.current === null && typeof window !== 'undefined') {
    sharedPlanRef.current = decodePlanFromUrlHash();
  }
  const shared = sharedPlanRef.current;

  const [context, setContext] = usePersistedState<StudentContext>('classoptimizer:context', shared?.context ?? DEFAULT_CONTEXT);
  const [requestedTerm, setRequestedTerm] = useState<TermSlug | null>(shared?.context.term ?? null);
  const { availableTerms, activeTerm, catalog, buildings, isLoading, error } = useCatalogData(context.campusId, requestedTerm);

  const [selections, setSelections] = useState<CourseSelection[]>(shared?.selections ?? []);
  const [pools, setPools] = useState<Pool[]>(shared?.electivePools ?? []);
  const [constraints, setConstraints] = useState<OptimizerConstraints>(shared?.constraints ?? DEFAULT_CONSTRAINTS);
  const [focus, setFocus] = useState<PriorityFocus>(shared?.focus ?? 'Balanced');
  const [optionIndex, setOptionIndex] = useState(0);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [snackbarLabel, setSnackbarLabel] = useState<string | null>(null);
  const searchRef = useRef<CourseSearchHandle>(null);
  const seededRef = useRef<boolean>(!!shared);

  const courses = useMemo(() => catalog?.courses ?? [], [catalog]);
  const { options, conflictDiagnosis, solveTimeMs, isSolving } = useOptimizer(courses, buildings, selections, pools, constraints, focus);
  const option = options[Math.min(optionIndex, Math.max(0, options.length - 1))] ?? null;

  useEffect(() => { setOptionIndex(0); }, [options.length, selections, pools, constraints, focus]);
  useEffect(() => {
    if (activeTerm && activeTerm.slug !== context.term) setContext({ ...context, term: activeTerm.slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTerm?.slug]);

  // Seed a small starter plan the first time a catalog loads (only when nothing was shared/picked).
  useEffect(() => {
    if (!catalog || seededRef.current) return;
    seededRef.current = true;
    const starter = ['CS 225', 'MATH 241', 'PHIL 101']
      .filter((id) => catalog.courses.some((c) => c.id === id))
      .map((id, i) => {
        const c = catalog.courses.find((x) => x.id === id)!;
        return { courseId: id, tier: i === 0 ? 'MUST_TAKE' as const : 'HIGH_PRIORITY' as const, creditHoursSelected: c.creditHoursMin, isCreditNoCredit: false, pinnedCrns: [], excludedCrns: [] };
      });
    if (starter.length) setSelections(starter);
  }, [catalog]);

  const pushUndo = useCallback((label: string) => {
    setUndoStack((stack) => [...stack.slice(-19), {
      id: `undo-${Date.now()}`,
      label,
      timestamp: Date.now(),
      previousState: { selections: clone(selections), electivePools: clone(pools), constraints: clone(constraints) },
    }]);
    setSnackbarLabel(label);
  }, [selections, pools, constraints]);

  const doUndo = useCallback(() => {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1];
      if (!last) return stack;
      setSelections(last.previousState.selections);
      setPools(last.previousState.electivePools);
      setConstraints(last.previousState.constraints);
      setSnackbarLabel(null);
      return stack.slice(0, -1);
    });
  }, []);

  useKeyboardNav({
    onFocusSearch: () => searchRef.current?.focus(),
    onPrevOption: () => setOptionIndex((i) => Math.max(0, i - 1)),
    onNextOption: () => setOptionIndex((i) => Math.min(Math.max(0, options.length - 1), i + 1)),
    onUndo: doUndo,
  });

  const handleTermChange = (term: TermSlug) => {
    setRequestedTerm(term);
    // CRNs are term-specific: keep the course list, drop term-scoped pins/exclusions.
    setSelections((sels) => sels.map((s) => ({ ...s, pinnedCrns: [], excludedCrns: [] })));
  };

  const addCourse = (courseId: string) => {
    const c = courses.find((x) => x.id === courseId);
    if (!c) return;
    pushUndo(`Added ${courseId}`);
    setSelections((sels) => [...sels, { courseId, tier: 'MUST_TAKE', creditHoursSelected: c.creditHoursMin, isCreditNoCredit: false, pinnedCrns: [], excludedCrns: [] }]);
  };

  const removeCourse = (courseId: string) => {
    pushUndo(`Removed ${courseId}`);
    setSelections((sels) => sels.filter((s) => s.courseId !== courseId));
  };

  const changeSelection = (sel: CourseSelection) => {
    pushUndo(`Updated ${sel.courseId}`);
    setSelections((sels) => sels.map((s) => (s.courseId === sel.courseId ? sel : s)));
  };

  const resolveConflict = (action: ConflictResolutionAction) => {
    pushUndo(action.label);
    if (action.type === 'UNPIN_CRN') {
      setSelections((sels) => sels.map((s) => (s.courseId === action.targetId ? { ...s, pinnedCrns: [] } : s)));
    } else if (action.type === 'ENABLE_CLOSED_SECTIONS') {
      setConstraints((c) => ({ ...c, includeClosedSections: true }));
    } else if (action.type === 'DROP_COURSE') {
      setSelections((sels) => sels.map((s) => (s.courseId === action.targetId ? { ...s, tier: 'BACKUP_OPTIONAL' as const } : s)));
    } else if (action.type === 'REMOVE_BLOCKED_TIME') {
      setConstraints((c) => ({ ...c, blockedTimes: c.blockedTimes.filter((b) => b.id !== action.targetId) }));
    } else if (action.type === 'DISABLE_LUNCH_GUARD') {
      setConstraints((c) => ({ ...c, protectMiddayLunch: false }));
    }
  };

  const isBundleCompatible = useCallback((course: (typeof courses)[number]) => {
    if (!option) return true;
    try {
      const opt = new ScheduleOptimizer(courses, buildings, selections, pools, constraints, focus);
      const bundles = opt.generateLinkedBundlesForCourse(course, [], []);
      return bundles.some((b) => opt.isBundleCompatibleWithSchedule(b, option.bundles));
    } catch {
      return true;
    }
  }, [courses, buildings, selections, pools, constraints, focus, option]);

  const buildShareUrl = useCallback(() => {
    const state: SharedPlanState = { version: 2, context, selections, electivePools: pools, constraints, focus };
    const url = encodePlanToUrlHash(state);
    try { window.history.replaceState(null, '', url); } catch { /* ignore */ }
    return url;
  }, [context, selections, pools, constraints, focus]);

  const selectedIds = useMemo(() => new Set(selections.map((s) => s.courseId)), [selections]);

  const left = (
    <>
      <ContextBar context={context} availableTerms={availableTerms} onContextChange={setContext} onTermChange={handleTermChange} />
      <GenEdStrip fulfilled={context.fulfilledGenEds} option={option} courses={courses} />
      {isLoading && <p className="p-4 text-sm text-slate-400">Loading catalog…</p>}
      {error && <p className="p-4 text-sm text-red-400">{error}</p>}
      <CourseSearch ref={searchRef} courses={courses} selectedIds={selectedIds} currentBundles={option?.bundles ?? []} isBundleCompatible={isBundleCompatible} onAdd={addCourse} />
      <TierList selections={selections} courses={courses} onChange={changeSelection} onRemove={removeCourse} />
      <ElectivePool pools={pools} courses={courses} selectedIds={selectedIds}
        onAddPool={(pool) => { pushUndo(`Created pool ${pool.name}`); setPools((p) => [...p, pool]); }}
        onRemovePool={(id) => { pushUndo('Removed elective pool'); setPools((p) => p.filter((x) => x.id !== id)); }}
        onChangePool={(pool) => { pushUndo(`Updated pool ${pool.name}`); setPools((p) => p.map((x) => (x.id === pool.id ? pool : x))); }} />
    </>
  );

  const right = (
    <>
      <TopControlStrip focus={focus} onFocusChange={setFocus} option={option} optionIndex={Math.min(optionIndex, Math.max(0, options.length - 1))}
        optionCount={options.length}
        onPrev={() => setOptionIndex((i) => Math.max(0, i - 1))}
        onNext={() => setOptionIndex((i) => Math.min(Math.max(0, options.length - 1), i + 1))}
        solveTimeMs={solveTimeMs} isSolving={isSolving}
        constraints={constraints}
        onConstraintsChange={(c) => { pushUndo('Changed constraints'); setConstraints(c); }} />
      <ConflictBanner diagnosis={conflictDiagnosis} onResolve={resolveConflict} />
      <AsyncTray option={option} />
      <WeeklyGrid option={option} blockedTimes={constraints.blockedTimes}
        onBlock={(day, startMinutes, endMinutes) => {
          pushUndo(`Blocked ${day} time`);
          setConstraints((c) => ({ ...c, blockedTimes: [...c.blockedTimes, { id: `block-${Date.now()}`, day, startMinutes, endMinutes, label: 'Busy' }] }));
        }}
        onRemoveBlock={(id) => { pushUndo('Removed blocked time'); setConstraints((c) => ({ ...c, blockedTimes: c.blockedTimes.filter((b) => b.id !== id) })); }}
        onPinCrn={(courseId, crn) => {
          pushUndo(`Pinned CRN ${crn} for ${courseId}`);
          setSelections((sels) => sels.map((s) => s.courseId === courseId
            ? { ...s, pinnedCrns: s.pinnedCrns.includes(crn) ? s.pinnedCrns.filter((x) => x !== crn) : [...s.pinnedCrns, crn] }
            : s));
        }} />
      <RegistrationBar option={option} term={activeTerm} onShare={buildShareUrl} onOpenCheatSheet={() => setCheatOpen(true)} />
    </>
  );

  return (
    <>
      <TwoPaneLayout left={left} right={right} />
      <CheatSheetModal open={cheatOpen} option={option} courses={courses} onClose={() => setCheatOpen(false)} />
      <UndoSnackbar label={snackbarLabel} onUndo={doUndo} onDismiss={() => setSnackbarLabel(null)} />
    </>
  );
}
