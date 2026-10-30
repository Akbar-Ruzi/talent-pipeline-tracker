import { useEffect, useEffectEvent, useMemo } from "react";
import type { ListFilters } from "@/types/candidate";
import { useCandidateDataset } from "@/context/candidate-dataset";
import { pageSlice, queryCandidates } from "@/lib/local/query";
import { PAGE_SIZE } from "@/lib/constants";

type CandidateTableOptions = ListFilters & {
  page: number; // from the URL (?page=…)
  onPageOutOfRange: (page: number) => void; // called with a valid page to jump to
};

/**
 * ------------Tablet/desktop------------
 *  table: one numbered page at a time.
 * The page comes from the URL; this hook only cuts it out of the combined
 * academy + local list (Phase 1 demo), so changing pages needs no request.
 * A local create or edit updates the dataset, and the rows follow without a skeleton.
 */
export function useCandidateTable({
  status,
  stage,
  search,
  page,
  onPageOutOfRange,
}: CandidateTableOptions) {
  const { candidates, academyLoading, academyError, retryAcademy } =
    useCandidateDataset();

  const result = useMemo(
    () =>
      pageSlice(
        queryCandidates(candidates, { status, stage, search }),
        page,
        PAGE_SIZE,
      ),
    [candidates, status, stage, search, page],
  );

  // Out of range: candidates exist (total > 0) but this page is empty,
  // e.g. ?page=99, an old bookmark, or fewer results after candidates were removed.
  // Not while the academy loads: only the local candidates are counted then.
  const isOutOfRange =
    !academyLoading &&
    !academyError &&
    result.total > 0 &&
    result.data.length === 0 &&
    page > 1;
  const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  // useEffectEvent: always calls the latest onPageOutOfRange without re-running the effect
  const reportOutOfRange = useEffectEvent((validPage: number) =>
    onPageOutOfRange(validPage),
  );
  useEffect(() => {
    // Math.min with page - 1: always moves back, so it can never jump to the same empty page again
    if (isOutOfRange) reportOutOfRange(Math.min(lastPage, page - 1));
  }, [isOutOfRange, lastPage, page]);

  // While out of range, report loading: the skeleton shows instead of an empty table
  return {
    result,
    loading: academyLoading || isOutOfRange,
    error: academyError,
    retry: retryAcademy,
  };
}
