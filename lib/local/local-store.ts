// Safe access to the public demo's localStorage keys (talent-tracker:*).
// Visitors' candidates and notes live only in their own browser; nothing
// here talks to the academy API.

const PREFIX = "talent-tracker:";
export const CANDIDATES_KEY = `${PREFIX}candidates:v1`;
export const NOTES_KEY = `${PREFIX}notes:v1`;

// null on the server, and when the browser blocks storage (privacy settings
// can make even reading window.localStorage throw)
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// The last parsed list per key, kept while the stored text is unchanged, so
// reading an unchanged key returns the same array. useSyncExternalStore
// needs that: a new array on every read would re-render forever.
// Callers must not mutate the returned arrays; writes always build new ones.
const cache = new Map<string, { raw: string | null; list: unknown[] }>();

// Reads a stored list, keeping only the entries that pass the guard.
// Missing, corrupt, or hand-edited data gives [] (or the valid entries) instead of a crash.
export function readList<T>(
  key: string,
  isItem: (item: unknown) => item is T,
): T[] {
  let raw: string | null = null;
  try {
    raw = getStorage()?.getItem(key) ?? null;
  } catch {
    raw = null;
  }

  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.list as T[];

  const list = parseList(raw, isItem);
  cache.set(key, { raw, list });
  return list;
}

function parseList<T>(raw: string | null, isItem: (item: unknown) => item is T): T[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

// Throws a message the form can show, e.g. when storage is full,
// so the visitor keeps what they typed
export function writeList<T>(key: string, list: T[]): void {
  const storage = getStorage();
  if (!storage) {
    throw new Error(
      "This browser blocks local storage, so demo data can't be saved.",
    );
  }
  try {
    storage.setItem(key, JSON.stringify(list));
  } catch {
    throw new Error(
      "Browser storage is full or blocked, so the change wasn't saved.",
    );
  }
  notify();
}

// Same-tab changes call the listeners directly; the browser's storage event
// only fires in the other tabs.
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  // key is null when another tab cleared all of this site's storage
  if (event.key === null || event.key.startsWith(PREFIX)) notify();
}

// For useSyncExternalStore: returns the unsubscribe function
export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

// Reset Demo: removes the demo's own keys only, nothing else on this site
export function resetDemo(): void {
  const storage = getStorage();
  if (!storage) return;

  // Collect first: removing keys while looping by index would skip some
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
  notify();
}
