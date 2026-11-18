# ClassOptimizer

A constraint-based course & schedule optimizer for the University of Illinois Urbana-Champaign (UIUC). Pick your courses, rank them in priority tiers, add "Pick K of M" elective pools, block your busy times — and ClassOptimizer searches every valid combination of sections and ranks the best schedules by GPA, class times, and walking distance.

**Live demo:** https://vipersurf.github.io/ClassOptimizer/

## Features

- **Complete CSP solver** — deterministic backtracking search with MRV (minimum-remaining-values) ordering and forward checking. It finds *all* valid schedules (up to a cap) instead of guessing.
- **Linked sections done right** — lectures and their linked discussions/labs are bundled by link group: `AL1` only ever pairs with `AD*` discussions, never with a `BD*` discussion from another lecture.
- **Part-of-Term awareness** — first-half (Part A) and second-half (Part B) 8-week courses at the same clock time can share a schedule; self-paced (SF) sections never conflict.
- **Elective pools (Pick K of M)** — pools are dynamic choice nodes in the search tree. Every candidate combination is evaluated against your other courses, credits, and blocked times — the solver never just takes the first K courses in the list.
- **Backup course substitution** — pair a backup course with any selection; if the primary has no open bundles, the backup is substituted automatically and flagged in the results.
- **Walking-time validation** — Haversine distance between real UIUC building coordinates, adjusted by a 1.28 circuity factor, a 78 m/min walking speed, and a 2-minute building exit/entry buffer. Tight back-to-back walks are flagged.
- **Guardrails** — credit min/max, minimum break between classes, earliest/latest class times, blocked busy times (drag on the calendar to create them), and a midday lunch guard (≥45 free minutes between 11:30 and 13:30).
- **Conflict diagnosis (MUS)** — when no schedule exists, you get the exact conflicting courses and one-click fixes: unpin a CRN, include closed sections (Plan B), drop a course to the backup tier, clear a blocked time, or disable the lunch guard. Every change is undoable (Ctrl/Cmd+Z).
- **Four ranking focuses** — Balanced (GPA 40 / Times 35 / Walk 25), Max GPA (70/15/15), Best Times (15/70/15), Shortest Walk (15/15/70), using historical instructor GPA data with a confidence indicator.
- **Dynamic semesters** — no hardcoded term. A manifest (`public/data/manifest.json`) lists every published term with start/midterm/end dates and a SHA-256 of its catalog bundle; the app resolves the current/planning term from the date and lets you switch terms from the dropdown.
- **Registration tools** — copy all CRNs, copy individual CRN pills, copy a sanitized Ellucian Banner XE autofill console snippet (5-digit CRNs only), export a term-aware `.ics` calendar (Part A events stop at midterm, Part B events start at midterm), share a plan as a stateless `#plan=` URL (LZ-compressed, no server), and a high-contrast **7:00 AM Cheat Sheet** mode with backup CRNs.
- **Offline PWA** — service worker with cache-first app shell and stale-while-revalidate catalog data; term bundles are cached in IndexedDB and invalidated by their manifest SHA-256.
- **Fast & non-blocking** — the solver runs in a Web Worker with request-ID deduplication (stale results are discarded), and falls back to the main thread if a Worker can't start.

## How the solver works

1. Each selected course expands into **linked bundles** — every valid lecture + discussion/lab combination, filtered by pinned/excluded CRNs, open/closed status, and blocked times.
2. Elective pools become additional choice slots whose bundles span all pool candidates.
3. Slots are ordered by fewest remaining bundles (MRV), then a backtracking search assigns one bundle per slot, pruning on time conflicts (with your minimum break), Part-of-Term overlap rules, cross-listed duplicates, and the credit ceiling.
4. Complete assignments are checked against the lunch guard, then scored and ranked. If the search exhausts with zero solutions, a Minimal Unsatisfiable Subset (MUS) pass identifies the conflicting pair or empty slot and proposes concrete fixes.

## Data

The shipped bundles in `public/data/` are a **curated sample catalog** (32 courses / 104 sections per term for Fall 2026 and Spring 2027, with real UIUC buildings and coordinates) so the app works immediately and offline. The sync workflow regenerates real catalog data from the UIUC CISApp explorer API.

### Regenerating catalog data

```bash
pip install -r scripts/requirements.txt
python scripts/build_uiuc_data.py --subjects CS ECE MATH
# or specific terms:
python scripts/build_uiuc_data.py --terms 2026-fall 2027-spring --subjects CS ECE MATH STAT PHIL
```

The pipeline discovers published terms from `https://courses.illinois.edu/cisapp/explorer/schedule.xml`, fetches course/section XML asynchronously, infers Banner link groups (`AL1` ↔ `AD1`), joins instructor GPA statistics from the UIUC GPA dataset, and writes `public/data/terms/*.json` plus `public/data/manifest.json` with SHA-256 hashes. A GitHub Actions workflow (`.github/workflows/sync_catalog.yml`) runs it every 6 hours and on demand.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # vitest: solver, linked bundles, Part A/B, pools, MUS, term resolver
npm run build    # typecheck (tsc -b) + production build
npm run preview  # preview the production build
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy_pages.yml`: tests → typecheck → build → GitHub Pages. The Vite `base` is `'./'`, so the site works from a project subpath (`https://<user>.github.io/ClassOptimizer/`).

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS v4 · Vitest · idb-keyval · lz-string · Python (aiohttp) data pipeline

## Layout

```
public/data/          manifest.json, buildings-uiuc.json, terms/*.json catalog bundles
scripts/              build_uiuc_data.py — CISApp ingestion pipeline
src/@types/           course / schedule / user contracts
src/core/engine/      validator, scoring, optimizer (CSP), optimizer.worker
src/core/utils/       termResolver, timeUtils, compression, icsExport, autofill
src/core/adapter/     CampusProvider + UIUC adapter
src/hooks/            useCatalogData, useOptimizer, usePersistedState, useKeyboardNav
src/components/       layout, discovery, calendar, registration, common
tests/                optimizer.test.ts, termResolver.test.ts
```
