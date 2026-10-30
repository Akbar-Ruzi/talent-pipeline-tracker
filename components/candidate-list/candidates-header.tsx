"use client";

import { useRouter } from "next/navigation";

import { useCreateCandidate } from "@/hooks/useCreateCandidate";
import { NEW_CANDIDATE_ID } from "@/lib/constants";
import { MAX_LOCAL_CANDIDATES } from "@/lib/local/constants";
import {
  drawerHref,
  fullPageHref,
  toListQuery,
} from "@/lib/utils/candidate-urls";

// The help text under a disabled Add candidate button
const LIMIT_HELP_ID = "add-candidate-limit-help";

// Page title, active search, and the Add candidate action.
export default function CandidatesHeader() {
  const router = useRouter();
  // Phase 1 demo: Add is disabled once the visitor has 10 local candidates
  const { limitReached } = useCreateCandidate();

  // Opens the create form, keeping the list's search, filters, and page:
  // the drawer (/?candidate=new) on tablet/desktop, the full page
  // (/candidates/new) on mobile, like the candidate cards there.
  // The URL and screen width are read on click (not with useSearchParams),
  // so the header doesn't need a Suspense boundary.
  const openCreateForm = () => {
    const listQuery = toListQuery(new URLSearchParams(window.location.search));
    // Same breakpoint as Tailwind's md: (768px)
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    router.push(
      isMobile
        ? fullPageHref(listQuery, NEW_CANDIDATE_ID)
        : drawerHref(listQuery, NEW_CANDIDATE_ID),
    );
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Candidates</h1>
        <p className="mt-1 text-slate-500">Executive Assistant · Austin HQ</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={openCreateForm}
          disabled={limitReached}
          aria-describedby={limitReached ? LIMIT_HELP_ID : undefined}
          className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 font-semibold text-white shadow-md hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:h-12 sm:px-5"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add candidate
        </button>
        {/* Visible text, not a title tooltip: a disabled button gets no
            hover or focus on touch screens */}
        {limitReached && (
          <p
            id={LIMIT_HELP_ID}
            className="max-w-48 text-right text-xs text-slate-500"
          >
            {MAX_LOCAL_CANDIDATES} / {MAX_LOCAL_CANDIDATES} demo candidates.
            Use Reset Demo to start over.
          </p>
        )}
      </div>
    </div>
  );
}
