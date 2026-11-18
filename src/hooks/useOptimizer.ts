// src/hooks/useOptimizer.ts
import { useEffect, useRef, useState } from 'react';
import { BuildingCoordinates, Course } from '../@types/course';
import { ConflictDiagnosis, OptimizerConstraints, PriorityFocus, ScheduleOption, SolverInputPayload, SolverOutputPayload } from '../@types/schedule';
import { CourseSelection, ElectivePool } from '../@types/user';
import { ScheduleOptimizer } from '../core/engine/optimizer';

export function useOptimizer(
  courses: Course[],
  buildings: Record<string, BuildingCoordinates>,
  selections: CourseSelection[],
  electivePools: ElectivePool[],
  constraints: OptimizerConstraints,
  focus: PriorityFocus
) {
  const workerRef = useRef<Worker | null>(null);
  const workerFailedRef = useRef<boolean>(false);
  const latestRequestIdRef = useRef<number>(0);
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [conflictDiagnosis, setConflictDiagnosis] = useState<ConflictDiagnosis | null>(null);
  const [solveTimeMs, setSolveTimeMs] = useState<number>(0);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../core/engine/optimizer.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<SolverOutputPayload>) => {
        if (event.data.requestId !== latestRequestIdRef.current) return;
        setOptions(event.data.options);
        setConflictDiagnosis(event.data.conflictDiagnosis);
        setSolveTimeMs(event.data.executionTimeMs);
        setIsSolving(false);
      };
      worker.onerror = () => { workerFailedRef.current = true; };
      workerRef.current = worker;
    } catch {
      // Graceful fallback: run the solver on the main thread (tests, older browsers, CSP).
      workerFailedRef.current = true;
      workerRef.current = null;
    }
    return () => { worker?.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    if (courses.length === 0) { setOptions([]); setConflictDiagnosis(null); return; }
    if (selections.length === 0 && electivePools.length === 0) { setOptions([]); setConflictDiagnosis(null); setIsSolving(false); return; }
    const nextId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = nextId;
    setIsSolving(true);
    const payload: SolverInputPayload = { requestId: nextId, courses, buildings, selections, electivePools, constraints, focus };
    if (workerRef.current && !workerFailedRef.current) {
      try {
        workerRef.current.postMessage(payload);
        return;
      } catch {
        workerFailedRef.current = true;
      }
    }
    // Main-thread fallback
    const t0 = performance.now();
    const optimizer = new ScheduleOptimizer(courses, buildings, selections, electivePools, constraints, focus);
    const result = optimizer.solve();
    if (latestRequestIdRef.current !== nextId) return;
    setOptions(result.options);
    setConflictDiagnosis(result.conflictDiagnosis);
    setSolveTimeMs(Number((performance.now() - t0).toFixed(2)));
    setIsSolving(false);
  }, [courses, buildings, selections, electivePools, constraints, focus]);

  return { options, conflictDiagnosis, solveTimeMs, isSolving };
}
