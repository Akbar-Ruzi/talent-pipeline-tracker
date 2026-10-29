// IDs for candidates and notes created in the visitor's browser.
// Academy IDs are plain UUIDs, so a "local-" prefix can never clash with one
// (or with NEW_CANDIDATE_ID, "new"), and the source can be read from the ID alone.

const LOCAL_PREFIX = "local-";

// crypto.randomUUID only exists on https and localhost. The dev site opened
// on a phone (http://192.168.x.x) doesn't have it, so build a v4 UUID from
// getRandomValues, which works everywhere.
function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// "local-<uuid>" for a candidate, "local-note-<uuid>" for a note
export function newLocalId(kind: "candidate" | "note"): string {
  return kind === "note"
    ? `${LOCAL_PREFIX}note-${randomUuid()}`
    : `${LOCAL_PREFIX}${randomUuid()}`;
}

// true for anything created in this browser; false for academy IDs
export function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX);
}

// Every local write calls this first, so it can't touch an academy candidate
// even if a button that should be hidden is clicked.
export function assertLocalId(id: string): void {
  if (!isLocalId(id)) throw new Error("You can only edit candidates you created.");
}
