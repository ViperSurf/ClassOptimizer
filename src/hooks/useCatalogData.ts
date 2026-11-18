// src/hooks/useCatalogData.ts
import { useEffect, useState } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { BuildingCoordinates, CampusId, TermCatalogBundle, TermDescriptor, TermManifest, TermSlug } from '../@types/course';
import { resolveActiveTermFromManifest } from '../core/utils/termResolver';

export function useCatalogData(campusId: CampusId, requestedTerm: TermSlug | null) {
  const [manifest, setManifest] = useState<TermManifest | null>(null);
  const [availableTerms, setAvailableTerms] = useState<TermDescriptor[]>([]);
  const [activeTerm, setActiveTerm] = useState<TermDescriptor | null>(null);
  const [catalog, setCatalog] = useState<TermCatalogBundle | null>(null);
  const [buildings, setBuildings] = useState<Record<string, BuildingCoordinates>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = import.meta.env.BASE_URL || './';

  useEffect(() => {
    const controller = new AbortController();
    async function initManifest() {
      try {
        const [manifestRes, bldgRes] = await Promise.all([
          fetch(`${baseUrl}data/manifest.json`, { signal: controller.signal }),
          fetch(`${baseUrl}data/buildings-${campusId}.json`, { signal: controller.signal }).catch(() => null),
        ]);
        if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status} loading manifest.json`);
        const manifestData: TermManifest = await manifestRes.json();
        try { await idbSet('manifest:latest', manifestData); } catch { /* IndexedDB unavailable */ }
        setManifest(manifestData);
        if (bldgRes && bldgRes.ok) setBuildings(await bldgRes.json());
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        try {
          const cachedManifest = await idbGet<TermManifest>('manifest:latest');
          if (cachedManifest) { setManifest(cachedManifest); return; }
        } catch { /* fall through */ }
        setError('Unable to load semester manifest offline.');
        setIsLoading(false);
      }
    }
    initManifest();
    return () => controller.abort();
  }, [campusId, baseUrl]);

  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    const { activeTerm: resolved, sortedTerms } = resolveActiveTermFromManifest(manifest, campusId, requestedTerm);
    setAvailableTerms(sortedTerms);
    setActiveTerm(resolved);
    async function loadTermCatalog() {
      setIsLoading(true);
      setError(null);
      const cacheKey = `catalog:${resolved.campusId}:${resolved.slug}`;
      try {
        try {
          const cached = await idbGet<{ sha256: string; bundle: TermCatalogBundle }>(cacheKey);
          if (cached && cached.sha256 === resolved.sha256) {
            setCatalog(cached.bundle);
            setIsLoading(false);
            return;
          }
        } catch { /* IndexedDB unavailable; fetch fresh */ }
        const res = await fetch(`${baseUrl}${resolved.bundlePath}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to fetch ${resolved.label} catalog (${res.status})`);
        const bundle: TermCatalogBundle = await res.json();
        try { await idbSet(cacheKey, { sha256: resolved.sha256, bundle }); } catch { /* ignore */ }
        setCatalog(bundle);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        try {
          const fallback = await idbGet<{ sha256: string; bundle: TermCatalogBundle }>(cacheKey);
          if (fallback) { setCatalog(fallback.bundle); return; }
        } catch { /* fall through */ }
        setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    loadTermCatalog();
    return () => controller.abort();
  }, [manifest, campusId, requestedTerm, baseUrl]);

  return { manifest, availableTerms, activeTerm, catalog, buildings, isLoading, error };
}
