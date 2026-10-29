// Phase 1 public demo only. Everything in lib/local/ is temporary: it is
// replaced by the own backend (FastAPI + PostgreSQL) in Phase 2 and deleted.

// How many candidates a visitor can create in this browser.
// A demo limit, not security: the visitor can clear or edit localStorage.
export const MAX_LOCAL_CANDIDATES = 10;

// Page size for loading every academy candidate up front, so search, filters
// and pages can cover academy and local candidates together. The API accepts
// 1000 and had 100 records (checked 2026-10-29), so one request gets them all.
// Its order is stable but not sorted by any field (probably insertion order);
// the merged list keeps it.
export const ACADEMY_FETCH_LIMIT = 1000;

// Stop after this many pages if the academy data grows far beyond that
export const ACADEMY_MAX_PAGES = 20;
