import React, { useState } from 'react';
import { ScheduleOption } from '../../@types/schedule';
import { TermDescriptor } from '../../@types/course';
import { generateBannerAutofillSnippet } from '../../core/utils/autofill';
import { downloadIcs } from '../../core/utils/icsExport';

interface Props {
  option: ScheduleOption | null;
  term: TermDescriptor | null;
  onShare: () => string;
  onOpenCheatSheet: () => void;
}

export function RegistrationBar({ option, term, onShare, onOpenCheatSheet }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const crns = option ? Array.from(new Set(option.bundles.flatMap((b) => b.allSections.map((s) => s.crn)))) : [];

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registration</span>
        {crns.map((crn) => (
          <button key={crn} type="button" onClick={() => copy(crn, `CRN ${crn}`)}
            className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-100 hover:border-sky-500" title="Copy this CRN">
            {crn}
          </button>
        ))}
        {crns.length === 0 && <span className="text-xs text-slate-500">No CRNs yet — build a schedule first.</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={crns.length === 0} onClick={() => copy(crns.join(', '), 'All CRNs')}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40">Copy All CRNs</button>
        <button type="button" disabled={crns.length === 0} onClick={() => copy(generateBannerAutofillSnippet(crns), 'Banner autofill snippet')}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 disabled:opacity-40">Copy Banner Autofill Snippet</button>
        <button type="button" disabled={!option || !term} onClick={() => option && term && downloadIcs(option, term)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500 disabled:opacity-40">Export .ics Calendar</button>
        <button type="button" onClick={() => copy(onShare(), 'Share link')}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:border-sky-500">Share Plan Link</button>
        <button type="button" disabled={crns.length === 0} onClick={onOpenCheatSheet}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40">7:00 AM Cheat Sheet</button>
        {copied && <span className="self-center text-xs text-emerald-400">Copied: {copied}</span>}
      </div>
    </div>
  );
}
