import type { Candidate } from "@/types/candidate";

// Where a candidate came from: the 4Geeks Academy API (read-only)
// or this browser's localStorage (created by the visitor)
export type CandidateSource = "academy" | "local";

// Set by the code that loaded the candidate, never read from stored data
export type SourcedCandidate = Candidate & { source: CandidateSource };
