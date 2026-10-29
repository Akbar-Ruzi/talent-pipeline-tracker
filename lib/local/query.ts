// Search, filters, order and pages for the combined list, done in the browser.
// The API can only search and page its own candidates, so it can't count or
// order the visitor's local ones among them.

import type { Candidate, CandidateListResponse, ListFilters } from "@/types/candidate";
import type { SourcedCandidate } from "./types";

// One list in display order: the visitor's candidates first, newest on top
// (so a new one shows up right away), then the academy's in the API's order.
// Filtering later keeps this order, so search results and pages follow it too.
export function mergeCandidates(
  local: Candidate[],
  academy: Candidate[],
): SourcedCandidate[] {
  const newestFirst = [...local].sort((a, b) =>
    b.applied_at.localeCompare(a.applied_at), // ISO dates sort as text
  );
  return [
    ...newestFirst.map((candidate) => ({ ...candidate, source: "local" as const })),
    ...academy.map((candidate) => ({ ...candidate, source: "academy" as const })),
  ];
}

// Lowercase without accents, so "jimenez" finds "Jiménez"
function toSearchable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Same matching as the API's search (checked 2026-10-29): part of the name or
// the email, case-insensitive. Accents are ignored as well.
export function queryCandidates(
  candidates: SourcedCandidate[],
  { search, status, stage }: ListFilters,
): SourcedCandidate[] {
  const term = toSearchable(search?.trim() ?? "");
  return candidates.filter(
    (candidate) =>
      (!status || candidate.status === status) &&
      (!stage || candidate.stage === stage) &&
      (!term ||
        toSearchable(candidate.full_name).includes(term) ||
        toSearchable(candidate.email).includes(term)),
  );
}

// One numbered page, shaped like GET /records, so the table code that read the
// API's pages can read these. total counts every match, not just this page.
export function pageSlice<T extends Candidate>(
  candidates: T[],
  page: number,
  limit: number,
): Omit<CandidateListResponse, "data"> & { data: T[] } {
  return {
    total: candidates.length,
    page,
    limit,
    data: candidates.slice((page - 1) * limit, page * limit),
  };
}
