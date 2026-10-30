// Notes on the visitor's own candidates, stored in this browser only.
// Same signatures as getNotes / createNote / deleteNote in lib/api/notes.ts
// (minus the list wrapper), so the hooks can switch between them by source.
// Like the API, notes can be added and deleted but not edited.

import { isNote } from "@/lib/api/validators/note-guards";
import { assertLocalId, isLocalId, newLocalId } from "./ids";
import { changeLocalCandidate, getLocalCandidate } from "./local-candidates";
import { NOTES_KEY, readList, writeList } from "./local-store";
import type { CreateNotePayload, Note } from "@/types/note";

// Both IDs must be local: a note can't be attached to an academy candidate,
// even by editing storage by hand
function isStoredNote(item: unknown): item is Note {
  return isNote(item) && isLocalId(item.id) && isLocalId(item.record_id);
}

// Every local note. The same array while storage is unchanged, so it can be
// a useSyncExternalStore snapshot (listLocalNotes filters into a new one)
export function listAllLocalNotes(): Note[] {
  return readList(NOTES_KEY, isStoredNote);
}

// One candidate's notes, oldest first (like the API)
export function listLocalNotes(id: string): Note[] {
  return listAllLocalNotes().filter((note) => note.record_id === id);
}

// Like POST /records/:id/notes; also adds 1 to the candidate's notes_count
export function createLocalNote({
  id,
  payload,
}: {
  id: string;
  payload: CreateNotePayload;
}): Note {
  assertLocalId(id);
  if (!getLocalCandidate(id)) {
    throw new Error("This demo candidate no longer exists.");
  }
  // The API rejects an empty note (minLength 1)
  if (!payload.content.trim()) {
    throw new Error("Write something before saving the note.");
  }

  const note: Note = {
    id: newLocalId("note"),
    record_id: id,
    content: payload.content,
    created_at: new Date().toISOString(),
  };
  writeList(NOTES_KEY, [...listAllLocalNotes(), note]);
  changeLocalCandidate(id, (candidate) => ({
    ...candidate,
    notes_count: candidate.notes_count + 1,
  }));
  return note;
}

// Like DELETE /records/:id/notes/:note_id; also takes 1 off notes_count
export function deleteLocalNote({
  id,
  noteId,
}: {
  id: string;
  noteId: string;
}): void {
  assertLocalId(id);
  const notes = listAllLocalNotes();
  if (!notes.some((note) => note.id === noteId && note.record_id === id)) {
    throw new Error("This note no longer exists.");
  }

  writeList(
    NOTES_KEY,
    notes.filter((note) => note.id !== noteId),
  );
  changeLocalCandidate(id, (candidate) => ({
    ...candidate,
    notes_count: Math.max(0, candidate.notes_count - 1),
  }));
}
