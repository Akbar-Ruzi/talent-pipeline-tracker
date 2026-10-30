import { useCandidateDataset } from "@/context/candidate-dataset";
import { MAX_LOCAL_CANDIDATES } from "@/lib/local/constants";
import { createLocalCandidate } from "@/lib/local/local-candidates";
import type { Candidate, CreateCandidatePayload } from "@/types/candidate";

/**
 * ------------Create form (drawer and full page)------------
 * Phase 1 demo: saves the new candidate in this browser's localStorage (never
 * POST /records). The list shows it right away through the shared dataset.
 * Throws on failure (limit reached, storage full), so the form can show the
 * error and keep the values.
 */
export function useCreateCandidate() {
  const { localCount } = useCandidateDataset();

  const createCandidate = async (
    payload: CreateCandidatePayload,
  ): Promise<Candidate> => createLocalCandidate(payload);

  return {
    createCandidate,
    localCount,
    // For the Add button and the form. createLocalCandidate checks it again,
    // since the form can also be opened from a URL
    limitReached: localCount >= MAX_LOCAL_CANDIDATES,
  };
}
