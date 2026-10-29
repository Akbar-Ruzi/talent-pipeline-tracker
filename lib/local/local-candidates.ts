// The visitor's own candidates, stored in this browser only.
// Same signatures as createRecord / updateRecord / updateRecordStatus in
// lib/api/records.ts, so the hooks can switch between them by source.
// Like the API, there is no candidate delete: Reset Demo removes them all.

import { isCandidate } from "@/lib/api/validators/candidate-guards";
import { MAX_LOCAL_CANDIDATES } from "./constants";
import { assertLocalId, isLocalId, newLocalId } from "./ids";
import { CANDIDATES_KEY, readList, writeList } from "./local-store";
import type {
  Candidate,
  CreateCandidatePayload,
  UpdateCandidatePayload,
  UpdateCandidateStatusPayload,
} from "@/types/candidate";

// A stored entry must also have a local ID: one hand-edited to an academy ID
// is dropped, so a local write can never target an academy candidate.
function isStoredCandidate(item: unknown): item is Candidate {
  return isCandidate(item) && isLocalId(item.id);
}

// Oldest first (creation order); the list decides the display order
export function listLocalCandidates(): Candidate[] {
  return readList(CANDIDATES_KEY, isStoredCandidate);
}

export function getLocalCandidate(id: string): Candidate | null {
  return listLocalCandidates().find((candidate) => candidate.id === id) ?? null;
}

export function isLocalLimitReached(): boolean {
  return listLocalCandidates().length >= MAX_LOCAL_CANDIDATES;
}

// Like POST /records: starts as received / pending, an omitted URL is stored as null
export function createLocalCandidate(payload: CreateCandidatePayload): Candidate {
  const candidates = listLocalCandidates();
  // Checked here, not only by disabling the button: the create form can also
  // be opened from a URL (/candidates/new)
  if (candidates.length >= MAX_LOCAL_CANDIDATES) {
    throw new Error(
      `You can create up to ${MAX_LOCAL_CANDIDATES} demo candidates. Use Reset Demo to start over.`,
    );
  }

  const now = new Date().toISOString();
  const candidate: Candidate = {
    id: newLocalId("candidate"),
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    position: payload.position,
    linkedin_url: payload.linkedin_url ?? null,
    cv_url: payload.cv_url ?? null,
    status: "received",
    stage: "pending",
    experience_years: payload.experience_years,
    applied_at: now,
    updated_at: now,
    notes_count: 0,
  };
  writeList(CANDIDATES_KEY, [...candidates, candidate]);
  return candidate;
}

// Applies a change to one stored candidate and returns the saved version.
// Also used by local-notes.ts to keep notes_count in step with the notes.
export function changeLocalCandidate(
  id: string,
  change: (candidate: Candidate) => Candidate,
): Candidate {
  assertLocalId(id);
  const candidates = listLocalCandidates();
  const current = candidates.find((candidate) => candidate.id === id);
  if (!current) {
    // Removed by Reset Demo (maybe in another tab), or a link from another browser
    throw new Error("This demo candidate no longer exists.");
  }

  const updated = change(current);
  writeList(
    CANDIDATES_KEY,
    candidates.map((candidate) => (candidate.id === id ? updated : candidate)),
  );
  return updated;
}

// Like PUT /records/:id: replaces the general information (null clears a URL)
export function updateLocalCandidate({
  id,
  payload,
}: {
  id: string;
  payload: UpdateCandidatePayload;
}): Candidate {
  return changeLocalCandidate(id, (current) => ({
    ...current,
    ...payload,
    updated_at: new Date().toISOString(),
  }));
}

// Like PATCH /records/:id: status and/or stage; a field left out keeps its value
export function patchLocalCandidate({
  id,
  payload,
}: {
  id: string;
  payload: UpdateCandidateStatusPayload;
}): Candidate {
  return changeLocalCandidate(id, (current) => ({
    ...current,
    status: payload.status ?? current.status,
    stage: payload.stage ?? current.stage,
    updated_at: new Date().toISOString(),
  }));
}
