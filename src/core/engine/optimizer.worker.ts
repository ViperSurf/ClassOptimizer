// src/core/engine/optimizer.worker.ts
/// <reference lib="webworker" />
import { SolverInputPayload, SolverOutputPayload } from '../../@types/schedule';
import { ScheduleOptimizer } from './optimizer';

self.onmessage = (event: MessageEvent<SolverInputPayload>) => {
  const { requestId, courses, buildings, selections, electivePools, constraints, focus } = event.data;
  const t0 = performance.now();
  const optimizer = new ScheduleOptimizer(courses, buildings, selections, electivePools, constraints, focus);
  const { options, conflictDiagnosis } = optimizer.solve();
  const executionTimeMs = Number((performance.now() - t0).toFixed(2));
  const response: SolverOutputPayload = { requestId, executionTimeMs, options, conflictDiagnosis };
  self.postMessage(response);
};
