// src/core/adapter/CampusProvider.ts
import { BuildingCoordinates, CampusId, TermCatalogBundle, TermManifest } from '../../@types/course';

export interface CampusProvider {
  readonly campusId: CampusId;
  loadManifest(signal?: AbortSignal): Promise<TermManifest>;
  loadBuildings(signal?: AbortSignal): Promise<Record<string, BuildingCoordinates>>;
  loadTermBundle(bundlePath: string, signal?: AbortSignal): Promise<TermCatalogBundle>;
}
