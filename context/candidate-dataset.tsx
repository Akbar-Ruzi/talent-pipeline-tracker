"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { fetchAllAcademyRecords } from "@/lib/local/academy-all";
import { listLocalCandidates } from "@/lib/local/local-candidates";
import { subscribe } from "@/lib/local/local-store";
import { mergeCandidates } from "@/lib/local/query";
import type { SourcedCandidate } from "@/lib/local/types";
import type { Candidate } from "@/types/candidate";

// Phase 1 public demo: every candidate the list can show, academy and local,
// in one place. The table, the mobile feed and the details all read it, so
// the academy candidates load once per visit instead of once per view.
// In the root layout, so it stays loaded when moving between the list and a
// candidate's full page.
type CandidateDataset = {
  // Local first (newest on top), then academy in the API's order
  candidates: SourcedCandidate[];
  localCount: number;
  // false on the server and during hydration, when the local list is still
  // the empty server snapshot: a local ID isn't "not found" yet
  localReady: boolean;
  academyLoading: boolean;
  // The local candidates still show while this is set
  academyError: string | null;
  // The page cap stopped loading early; counts cover only what loaded
  academyTruncated: boolean;
  retryAcademy: () => void;
};

const CandidateDatasetContext = createContext<CandidateDataset | null>(null);

// The server can't read localStorage. The same empty array every time, as
// useSyncExternalStore requires; the real list replaces it after hydration.
const NO_CANDIDATES: Candidate[] = [];
const getServerSnapshot = () => NO_CANDIDATES;

// For localReady: nothing to subscribe to, only server vs. client snapshot
const subscribeNever = () => () => {};
export function CandidateDatasetProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Re-renders on every local write in this tab and on changes from other tabs
  const local = useSyncExternalStore(
    subscribe,
    listLocalCandidates,
    getServerSnapshot,
  );
  const localReady = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const [academy, setAcademy] = useState<Candidate[]>([]);
  const [academyLoading, setAcademyLoading] = useState(true);
  const [academyError, setAcademyError] = useState<string | null>(null);
  const [academyTruncated, setAcademyTruncated] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Academy data is read-only, so it's loaded once and not after local saves.
  // Only Retry loads it again.
  useEffect(() => {
    let ignore = false; // only the latest request updates the data
    async function load() {
      try {
        const { records, truncated } = await fetchAllAcademyRecords();
        if (!ignore) {
          setAcademy(records);
          setAcademyTruncated(truncated);
          setAcademyError(null);
        }
      } catch (err) {
        if (!ignore) {
          setAcademyError(
            err instanceof Error
              ? err.message
              : "Could not load the academy candidates.",
          );
        }
      } finally {
        if (!ignore) setAcademyLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const retryAcademy = useCallback(() => {
    setAcademyLoading(true);
    setAcademyError(null);
    setReloadKey((k) => k + 1); // new value → the effect runs again
  }, []);

  // A new merged list only when one of the sources changes
  const candidates = useMemo(
    () => mergeCandidates(local, academy),
    [local, academy],
  );

  const value = useMemo(
    () => ({
      candidates,
      localCount: local.length,
      localReady,
      academyLoading,
      academyError,
      academyTruncated,
      retryAcademy,
    }),
    [candidates, local.length, localReady, academyLoading, academyError, academyTruncated, retryAcademy],
  );

  return (
    <CandidateDatasetContext value={value}>{children}</CandidateDatasetContext>
  );
}

export function useCandidateDataset(): CandidateDataset {
  const context = useContext(CandidateDatasetContext);
  if (!context) {
    throw new Error(
      "useCandidateDataset must be used inside CandidateDatasetProvider.",
    );
  }
  return context;
}
