import React from 'react';
import { ConflictDiagnosis, ConflictResolutionAction } from '../../@types/schedule';

export function ConflictBanner({ diagnosis, onResolve }: { diagnosis: ConflictDiagnosis | null; onResolve: (a: ConflictResolutionAction) => void }) {
  if (!diagnosis) return null;
  return (
    <div className="border-b border-red-900 bg-red-950/60 px-4 py-3" role="alert">
      <p className="text-sm font-semibold text-red-200">No valid schedule exists for this combination.</p>
      <p className="mt-0.5 text-sm text-red-100/90">{diagnosis.humanReadableReason}</p>
      {diagnosis.conflictingCourseIds.length > 0 && (
        <p className="mt-0.5 text-xs text-red-300">Conflicting: {diagnosis.conflictingCourseIds.join(', ')}</p>
      )}
      {diagnosis.resolutions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {diagnosis.resolutions.map((r, i) => (
            <button key={`${r.type}-${r.targetId}-${i}`} type="button" onClick={() => onResolve(r)}
              className="rounded-full border border-red-500 bg-red-900/70 px-3 py-1 text-xs font-medium text-red-100 hover:bg-red-800">
              Fix: {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
