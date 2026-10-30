"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCandidateDataset } from "@/context/candidate-dataset";
import { useCandidateDrafts } from "@/context/candidate-drafts";
import { SUCCESS_MESSAGE_MS } from "@/lib/constants";
import { MAX_LOCAL_CANDIDATES } from "@/lib/local/constants";
import { isLocalId } from "@/lib/local/ids";
import { resetDemo } from "@/lib/local/local-store";
import {
  getDrawerCandidateId,
  listHref,
  toListQuery,
} from "@/lib/utils/candidate-urls";

const FULL_PAGE_PREFIX = "/candidates/";

// Phase 1 public demo only (deleted in Phase 2, with lib/local/).
// Under the app header on every page, but only once the visitor has used all
// 10 demo candidates: the counter and Reset Demo to start over.
export default function DemoBanner() {
  const router = useRouter();
  const { localCount } = useCandidateDataset();
  const { clearAllDrafts } = useCandidateDrafts();
  // Reset asks first, like deleting a note: one click never erases anything
  const [confirming, setConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  // false on the server and before storage is read (count 0), so the banner
  // never flashes in
  const limitReached = localCount >= MAX_LOCAL_CANDIDATES;

  // Hide "Demo reset." after a few seconds
  useEffect(() => {
    if (!resetDone) return;
    const timer = setTimeout(() => setResetDone(false), SUCCESS_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [resetDone]);

  const reset = () => {
    resetDemo(); // removes only talent-tracker:* keys; the dataset re-reads them

    // A local candidate open in the drawer or on the full page no longer
    // exists: go back to the same list instead of showing "not found".
    // The URL is read here (not with useSearchParams), so the banner doesn't
    // need a Suspense boundary.
    const { pathname, search } = window.location;
    const params = new URLSearchParams(search);
    const openId =
      getDrawerCandidateId(params) ??
      (pathname.startsWith(FULL_PAGE_PREFIX)
        ? decodeURIComponent(pathname.slice(FULL_PAGE_PREFIX.length))
        : null);
    if (openId && isLocalId(openId)) {
      clearAllDrafts(openId);
      router.push(listHref(toListQuery(params)));
    }

    setConfirming(false);
    setResetDone(true);
  };

  // Below the limit there's nothing to say: the banner stays hidden, except
  // for "Demo reset." for a few seconds after a reset
  if (!limitReached && !resetDone) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        {!limitReached ? (
          <p role="status" className="font-medium">
            Demo reset. You can add {MAX_LOCAL_CANDIDATES} candidates again.
          </p>
        ) : confirming ? (
          <p className="font-medium" id="reset-demo-question">
            Delete your {localCount} demo candidates and their notes? This
            can&apos;t be undone.
          </p>
        ) : (
          // Short enough for one line on a 375px phone
          <p>
            <span className="font-semibold">Demo:</span> limit reached. Reset
            to add more.
          </p>
        )}

        {limitReached && (
          <div className="flex shrink-0 items-center gap-3">
            {confirming ? (
              <div
                role="group"
                aria-labelledby="reset-demo-question"
                className="flex gap-2"
              >
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  // Opened by Reset Demo: start on the safe choice
                  autoFocus
                  className="h-9 rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="h-9 rounded-lg bg-rose-700 px-3 font-semibold text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                >
                  Reset Demo
                </button>
              </div>
            ) : (
              <>
                <span className="whitespace-nowrap">
                  {localCount} / {MAX_LOCAL_CANDIDATES} demo candidates
                </span>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="h-9 whitespace-nowrap rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  Reset Demo
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
