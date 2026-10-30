import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Note } from "@/types/note";
import { useCandidateDataset } from "@/context/candidate-dataset";
import { getNotes } from "@/lib/api/notes";
import { isLocalId } from "@/lib/local/ids";
import {
  createLocalNote,
  deleteLocalNote,
  listAllLocalNotes,
} from "@/lib/local/local-notes";
import { subscribe } from "@/lib/local/local-store";

// The server can't read localStorage; the same empty array every time
const NO_NOTES: Note[] = [];
const getServerSnapshot = () => NO_NOTES;

/**
 * ------------Notes tab (drawer and full page)------------
 * One candidate's internal notes.
 * id is the same candidate ID used by useCandidateDetail; null while the
 * drawer is closed, so nothing is fetched.
 * Called by the drawer and full page (not the Notes tab), so the notes load
 * once per candidate, alongside the record, and switching tabs doesn't refetch.
 *
 * Owns the notes data: loading them, and adding or deleting one. Components
 * only own their buttons: saving/deleting state and error messages (the same
 * split as React Query's useMutation).
 *
 * Phase 1 demo: academy notes come from GET /records/:id/notes and are
 * read-only. A local candidate's notes live in localStorage and can be added
 * and deleted (not edited, like the API).
 */
export function useCandidateNotes(id: string | null) {
  const isLocal = id !== null && isLocalId(id);
  // The academy notes to fetch: none while closed or for a local candidate
  const academyId = isLocal ? null : id;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(academyId !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Another candidate opened → forget the old notes and show loading.
  // Done during render (not in an effect), so the previous candidate's
  // notes never flash under the new one's ID.
  const [prevId, setPrevId] = useState(academyId);
  if (academyId !== prevId) {
    setPrevId(academyId);
    setNotes([]);
    setLoading(academyId !== null);
    setError(null);
  }

  useEffect(() => {
    if (academyId === null) return; // closed, or local: nothing to fetch

    // Without ignore, a slow reply for the previous candidate can arrive
    // last and show the wrong notes under this candidate's ID.
    let ignore = false; // only the latest request updates the notes
    async function load(candidateId: string) {
      try {
        const response = await getNotes(candidateId);
        if (!ignore) {
          setNotes(response.data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Could not load the notes.",
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
    setLoading(true); // show "Loading notes…" again
    setError(null);
    setReloadKey((k) => k + 1); // new value → the effect runs again
  };

  // Local: re-renders after every add or delete, here or in another tab
  const { localReady } = useCandidateDataset();
  const allLocalNotes = useSyncExternalStore(
    subscribe,
    listAllLocalNotes,
    getServerSnapshot,
  );
  const localNotes = useMemo(
    () =>
      isLocal ? allLocalNotes.filter((note) => note.record_id === id) : NO_NOTES,
    [isLocal, allLocalNotes, id],
  );

  // Like POST /records/:id/notes (+1 on the count). Throws on failure, and for
  // academy candidates, so the caller can show the error and keep the text.
  // The new note shows through the storage subscription above.
  const saveNote = async (content: string) => {
    if (id === null) throw new Error("No candidate is open.");
    createLocalNote({ id, payload: { content } });
  };

  // Like DELETE /records/:id/notes/:note_id (-1 on the count). A failure
  // throws and the note stays.
  const removeNote = async (note: Note) => {
    deleteLocalNote({ id: note.record_id, noteId: note.id });
  };

  if (isLocal) {
    return {
      notes: localNotes,
      loading: !localReady,
      error: null,
      retry,
      readOnly: false,
      saveNote,
      removeNote,
    };
  }

  return {
    notes,
    loading,
    error,
    retry,
    readOnly: true, // academy notes are never written
    saveNote,
    removeNote,
  };
}
