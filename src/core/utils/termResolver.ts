// src/core/utils/termResolver.ts
import { CampusId, Season, TermDescriptor, TermManifest, TermSlug } from '../../@types/course';

const SEASON_WEIGHT: Record<Season, number> = {
  winter: 1,
  spring: 2,
  summer: 3,
  fall: 4,
};

export function inferExpectedAcademicTerm(referenceDate: Date = new Date()): {
  currentTerm: TermSlug;
  planningTerm: TermSlug;
} {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const day = referenceDate.getDate();

  if (month === 1 || (month >= 2 && (month < 5 || (month === 5 && day <= 15)))) {
    const currentTerm: TermSlug = `${year}-spring`;
    const planningTerm: TermSlug = month >= 3 && (month > 3 || day >= 20) ? `${year}-fall` : currentTerm;
    return { currentTerm, planningTerm };
  }

  if (month >= 5 && (month < 8 || (month === 8 && day < 20))) {
    return { currentTerm: `${year}-summer`, planningTerm: `${year}-fall` };
  }

  const currentTerm: TermSlug = `${year}-fall`;
  const planningTerm: TermSlug = month >= 10 && (month > 10 || day >= 20) ? `${year + 1}-spring` : currentTerm;
  return { currentTerm, planningTerm };
}

export function resolveActiveTermFromManifest(
  manifest: TermManifest,
  campusId: CampusId,
  requestedTerm?: TermSlug | null,
  referenceDate: Date = new Date()
): { activeTerm: TermDescriptor; sortedTerms: TermDescriptor[] } {
  const campusTerms = manifest.terms
    .filter((t) => t.campusId === campusId)
    .sort((a, b) => a.year - b.year || SEASON_WEIGHT[a.season] - SEASON_WEIGHT[b.season]);

  if (campusTerms.length === 0) {
    const { planningTerm } = inferExpectedAcademicTerm(referenceDate);
    const [yrStr, season] = planningTerm.split('-') as [string, Season];
    const fallback: TermDescriptor = {
      slug: planningTerm,
      year: Number(yrStr),
      season,
      label: `${season.charAt(0).toUpperCase() + season.slice(1)} ${yrStr}`,
      campusId,
      isCurrent: true,
      isUpcomingRegistration: false,
      startDate: `${yrStr}-08-24`,
      midTermDate: `${yrStr}-10-19`,
      endDate: `${yrStr}-12-09`,
      lastUpdatedIso: new Date().toISOString(),
      courseCount: 0,
      bundlePath: `data/terms/${campusId}-${planningTerm}.json`,
      sha256: 'fallback',
    };
    return { activeTerm: fallback, sortedTerms: [fallback] };
  }

  if (requestedTerm) {
    const matched = campusTerms.find((t) => t.slug === requestedTerm);
    if (matched) return { activeTerm: matched, sortedTerms: campusTerms };
  }

  const { planningTerm, currentTerm } = inferExpectedAcademicTerm(referenceDate);
  const planningMatch = campusTerms.find((t) => t.slug === planningTerm);
  if (planningMatch) return { activeTerm: planningMatch, sortedTerms: campusTerms };

  const currentMatch = campusTerms.find((t) => t.slug === currentTerm);
  if (currentMatch) return { activeTerm: currentMatch, sortedTerms: campusTerms };

  const manifestDefault = campusTerms.find((t) => t.slug === manifest.defaultTermByCampus[campusId]);
  return {
    activeTerm: manifestDefault ?? campusTerms[campusTerms.length - 1],
    sortedTerms: campusTerms,
  };
}
