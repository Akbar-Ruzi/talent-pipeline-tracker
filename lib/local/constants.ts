// Phase 1 public demo only. Everything in lib/local/ is temporary: it is
// replaced by the own backend (FastAPI + PostgreSQL) in Phase 2 and deleted.

// How many candidates a visitor can create in this browser.
// A demo limit, not security: the visitor can clear or edit localStorage.
export const MAX_LOCAL_CANDIDATES = 10;
