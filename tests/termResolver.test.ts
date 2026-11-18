import { describe, expect, it } from 'vitest';
import { TermManifest } from '../src/@types/course';
import { inferExpectedAcademicTerm, resolveActiveTermFromManifest } from '../src/core/utils/termResolver';

describe('inferExpectedAcademicTerm', () => {
  it('resolves spring as current in January', () => {
    const { currentTerm, planningTerm } = inferExpectedAcademicTerm(new Date(2027, 0, 15));
    expect(currentTerm).toBe('2027-spring');
    expect(planningTerm).toBe('2027-spring');
  });
  it('plans fall during late-March registration window', () => {
    const { currentTerm, planningTerm } = inferExpectedAcademicTerm(new Date(2027, 2, 25));
    expect(currentTerm).toBe('2027-spring');
    expect(planningTerm).toBe('2027-fall');
  });
  it('resolves summer current / fall planning in June', () => {
    const { currentTerm, planningTerm } = inferExpectedAcademicTerm(new Date(2027, 5, 10));
    expect(currentTerm).toBe('2027-summer');
    expect(planningTerm).toBe('2027-fall');
  });
  it('resolves fall in September without rolling to spring', () => {
    const { currentTerm, planningTerm } = inferExpectedAcademicTerm(new Date(2027, 8, 5));
    expect(currentTerm).toBe('2027-fall');
    expect(planningTerm).toBe('2027-fall');
  });
  it('rolls planning to next spring in November (registration window)', () => {
    const { currentTerm, planningTerm } = inferExpectedAcademicTerm(new Date(2026, 10, 17));
    expect(currentTerm).toBe('2026-fall');
    expect(planningTerm).toBe('2027-spring');
  });
  it('works for arbitrary future years with no hardcoded term', () => {
    const { currentTerm, planningTerm } = inferExpectedAcademicTerm(new Date(2031, 10, 3));
    expect(currentTerm).toBe('2031-fall');
    expect(planningTerm).toBe('2032-spring');
  });
});

function manifestFor(year: number): TermManifest {
  const mk = (y: number, season: 'fall' | 'spring', isCurrent: boolean, isUp: boolean) => ({
    slug: `${y}-${season}` as const, year: y, season, label: `${season === 'fall' ? 'Fall' : 'Spring'} ${y}`,
    campusId: 'uiuc' as const, isCurrent, isUpcomingRegistration: isUp,
    startDate: `${y}-01-01`, midTermDate: `${y}-03-01`, endDate: `${y}-05-01`,
    lastUpdatedIso: '2026-01-01T00:00:00Z', courseCount: 10, bundlePath: `data/terms/uiuc-${y}-${season}.json`, sha256: 'x',
  });
  return {
    generatedAtIso: '2026-01-01T00:00:00Z',
    defaultTermByCampus: { uiuc: `${year}-fall`, uic: `${year}-fall`, uis: `${year}-fall` },
    terms: [mk(year + 1, 'spring', false, true), mk(year, 'fall', true, false)], // intentionally unsorted
  };
}

describe('resolveActiveTermFromManifest', () => {
  it('sorts terms chronologically and picks the planning term', () => {
    const manifest = manifestFor(2030);
    const { activeTerm, sortedTerms } = resolveActiveTermFromManifest(manifest, 'uiuc', null, new Date(2030, 10, 17));
    expect(sortedTerms.map((t) => t.slug)).toEqual(['2030-fall', '2031-spring']);
    expect(activeTerm.slug).toBe('2031-spring');
  });
  it('honors an explicit requested term', () => {
    const manifest = manifestFor(2030);
    const { activeTerm } = resolveActiveTermFromManifest(manifest, 'uiuc', '2030-fall', new Date(2030, 10, 17));
    expect(activeTerm.slug).toBe('2030-fall');
  });
  it('falls back gracefully when the campus has no terms', () => {
    const empty: TermManifest = { generatedAtIso: 'x', defaultTermByCampus: { uiuc: '2030-fall', uic: '2030-fall', uis: '2030-fall' }, terms: [] };
    const { activeTerm } = resolveActiveTermFromManifest(empty, 'uiuc', null, new Date(2030, 10, 17));
    expect(activeTerm.slug).toBe('2031-spring');
    expect(activeTerm.sha256).toBe('fallback');
  });
});
