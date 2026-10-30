import { useEffect, useMemo, useState } from "react";
import type {
  Candidate,
  UpdateCandidatePayload,
  UpdateCandidateStatusPayload,
} from "@/types/candidate";
import { useCandidateDataset } from "@/context/candidate-dataset";
import { getRecord } from "@/lib/api/records";
import { assertLocalId, isLocalId } from "@/lib/local/ids";
import {
  patchLocalCandidate,
  updateLocalCandidate,
} from "@/lib/local/local-candidates";

/**
 * ------------Drawer and full page------------
 * One candidate's full details.
 * id is null while the drawer is closed: nothing is fetched.
 * (Hooks can't be called conditionally, so the drawer calls this
 * on every render and passes null instead of skipping the call.)
 *
 * Phase 1 demo: an academy candidate comes from GET /records/:id and is
 * read-only. A local candidate (created in this browser) is read from the
 * shared dataset and saved to localStorage, so the list follows its edits.
 */
export function useCandidateDetail(id: string | null) {
  const isLocal = id !== null && isLocalId(id);
  // The academy record to fetch: none while closed or for a local candidate
  const academyId = isLocal ? null : id;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(academyId !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Another candidate opened → forget the old one and show the skeleton.
  // Done during render (not in an effect), so the previous candidate's
  // details never flash under the new one's ID.
  const [prevId, setPrevId] = useState(academyId);
  if (academyId !== prevId) {
    setPrevId(academyId);
    setCandidate(null);
    setLoading(academyId !== null);
    setError(null);
  }

  useEffect(() => {
    if (academyId === null) return; // closed, or local: nothing to fetch

    // Without ignore, a slow reply for the previous candidate can arrive
    // last and show the wrong person under this candidate's ID.
    let ignore = false; // only the latest request updates the details
    async function load(candidateId: string) {
      try {
        const response = await getRecord(candidateId);
        if (!ignore) {
          setCandidate(response);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load the candidate.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load(academyId);
    return () => {
      ignore = true;
    };
  }, [academyId, reloadKey]);

  const retry = () => {
    setLoading(true); // show the skeleton again
    setError(null);
    setReloadKey((k) => k + 1); // new value → the effect runs again
  };

  // Local: re-renders after every save here or in another tab
  const { candidates, localReady } = useCandidateDataset();
  const localCandidate = useMemo(
    () =>
      isLocal
        ? (candidates.find(
            (item) => item.source === "local" && item.id === id,
          ) ?? null)
        : null,
    [isLocal, candidates, id],
  );
  // Removed by Reset Demo, or a link from another browser
  const localMissing = isLocal && localReady && localCandidate === null;

  // The hook owns the writes too; the cards only own their buttons and
  // messages. Both throw on failure (and for academy candidates), so the card
  // can show the error and keep the user's values. No need to update state
  // after a save: the dataset re-reads storage and localCandidate follows.

  // Like PATCH /records/:id: status and/or stage only
  const updateStatus = async (payload: UpdateCandidateStatusPayload) => {
    if (id === null) throw new Error("No candidate is open.");
    assertLocalId(id); // academy candidates are read-only
    patchLocalCandidate({ id, payload });
  };

  // Like PUT /records/:id: the general information
  const updateInfo = async (payload: UpdateCandidatePayload) => {
    if (id === null) throw new Error("No candidate is open.");
    assertLocalId(id);
    updateLocalCandidate({ id, payload });
  };

  if (isLocal) {
    return {
      candidate: localCandidate,
      loading: !localReady, // the local list arrives right after hydration
      error: localMissing
        ? "This demo candidate isn't saved in this browser. It may have been removed by Reset Demo or created in another browser."
        : null,
      retry: undefined, // nothing to fetch again
      readOnly: false,
      updateStatus,
      updateInfo,
    };
  }

  return {
    candidate,
    loading,
    error,
    retry,
    readOnly: true, // academy data is never written
    updateStatus,
    updateInfo,
  };
}
