// src/core/adapter/uiucAdapter.ts
import { BuildingCoordinates, CampusId, TermCatalogBundle, TermManifest } from '../../@types/course';
import { CampusProvider } from './CampusProvider';

export class UiucCampusProvider implements CampusProvider {
  readonly campusId: CampusId = 'uiuc';
  private baseUrl: string;
  constructor(baseUrl: string = import.meta.env?.BASE_URL || './') {
    this.baseUrl = baseUrl;
  }
  async loadManifest(signal?: AbortSignal): Promise<TermManifest> {
    const res = await fetch(`${this.baseUrl}data/manifest.json`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading manifest.json`);
    return (await res.json()) as TermManifest;
  }
  async loadBuildings(signal?: AbortSignal): Promise<Record<string, BuildingCoordinates>> {
    const res = await fetch(`${this.baseUrl}data/buildings-${this.campusId}.json`, { signal });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, BuildingCoordinates>;
  }
  async loadTermBundle(bundlePath: string, signal?: AbortSignal): Promise<TermCatalogBundle> {
    const res = await fetch(`${this.baseUrl}${bundlePath}`, { signal });
    if (!res.ok) throw new Error(`Failed to fetch catalog bundle (${res.status})`);
    return (await res.json()) as TermCatalogBundle;
  }
}

export function createCampusProvider(campusId: CampusId, baseUrl?: string): CampusProvider {
  // UIUC is the shipped campus; the provider contract keeps UIC/UIS pluggable.
  void campusId;
  return new UiucCampusProvider(baseUrl);
}

/** Normalize a Banner link identifier like "AL1"/"AD1" to its link group letter. */
export function normalizeLinkGroup(sectionNumber: string): string {
  const clean = (sectionNumber || '').trim().toUpperCase();
  if (!clean) return 'ALL';
  return clean[0];
}
