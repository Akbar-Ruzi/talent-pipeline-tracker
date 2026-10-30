# Talent Pipeline Tracker — Public Portfolio Deployment Plan (Plan B)

**Status:** Phase 1 = build the first public prototype now. Phase 2 = documented only, do not code yet.
**Goal:** Deploy the existing Next.js app publicly so visitors can try it. They read 4Geeks Academy data (GET only) and can create and edit up to **10** of their own candidates in `localStorage`, plus add and delete notes on them. Local candidates have **the same features as the 4Geeks API**: no candidate delete and no note editing. The app has **no code path that writes to the academy API**.

> Implementation brief for Claude Code. Follow the existing conventions: hooks own data, components own buttons and messages, comments explain *why*. Keep `lib/api/*` unchanged. Read the relevant guide in `node_modules/next/dist/docs/` before using a Next.js API (see `AGENTS.md`).

---

## 0. Requirements alignment check

This compares the earlier version of this file with the new requirements. The original is backed up outside the repo.

| # | Requirement | Earlier Plan B | Change made |
|---|---|---|---|
| 1 | **10** local candidates per browser | Said 15 | Changed to **10** everywhere (`MAX_LOCAL_CANDIDATES = 10`) |
| 2 | Search, filters, sorting and pagination run on **one combined dataset**, in the listed processing order | Left open ("investigate, or document limitations") | Decided: fetch **all** academy records once, then do everything client-side (§2.3). The API holds ~101 records, so this is cheap |
| 3 | Sorting applies to the combined set | "sorting if present" | The app has no sort UI, so the API's default order is the current behavior. Task 1.4 records that order and the merge replicates it |
| 4 | Local candidates match the 4Geeks API: **no candidate delete, no note editing** | Planned a new Delete Candidate action | Removed. Local candidates support create, view, edit (info + status/stage), add note, delete note. **Reset Demo** is the only way to remove local candidates and free slots |
| 5 | Reset Demo with confirmation | ✔ | Kept |
| 6 | Preserve navigation state, mobile scroll, drawers, full pages | Partial | Explicit tasks plus a regression checklist (Task 6.3) |
| 7 | Academy notes read-only; local notes: add and delete (no edit) | ✔ | Kept; enforced in the hook and by a lint rule |
| 8 | No visitor-reachable academy write path | Service-layer rejection | Write functions stay in `lib/api/` but are **unreachable**: an ESLint `no-restricted-imports` rule bans them outside `lib/api/`, and a grep check runs before deploy |
| 9 | Collision-safe IDs | `academy:123` / `local:uuid` | Simpler: academy IDs stay raw UUIDs (existing URLs keep working) and local IDs are `local-<uuid>`. No prefix collides with a UUID or with `new` |
| 10 | Fictional demo data only | Notice | Kept. Also check that the shared course API holds no real personal data (Task 1.3) |
| 11 | Phase 2: PUT/PATCH/DELETE candidate API, notes API, admin **reactivate** and "manage access" | Partly missing | Added to §7 |
| 12 | Tests listed in the checklist | Unit tests named, but the repo has no test runner | **No automated tests** (your decision). Testing is the manual browser checklist (Task 6.3) plus lint, typecheck and build |

Requirements that already matched: hybrid list, `academy`/`local` source, no auth in Phase 1, localStorage rules, Reset Demo, graceful API failure, Phase 2 stack.

---

## 1. What the codebase looks like today (verified)

| Area | Files | Phase 1 impact |
|---|---|---|
| Academy API | `lib/api/records.ts`, `lib/api/notes.ts`, `lib/api/api-fetch.ts`, `lib/api/validators/*` | **Keep unchanged.** Only `getRecords`, `getRecord`, `getNotes` stay in use |
| Table (desktop/tablet) | `hooks/useCandidateTable.ts` calls `getRecords({page, limit, status, stage, search})` | Server-side paging → switch to slicing the combined list |
| Feed (mobile) | `hooks/useCandidateFeed.ts` calls `getRecords` page by page | Same → reveal more of the combined list, keeping the observer and scroll restore |
| Details | `hooks/useCandidateDetail.ts` calls `getRecord`, `updateRecord` (PUT), `updateRecordStatus` (PATCH) | Route by source; academy becomes read-only |
| Notes | `hooks/useCandidateNotes.ts` calls `getNotes`, `createNote`, `deleteNote` | Route by source; academy becomes read-only |
| Create | `hooks/useCreateCandidate.ts` calls `createRecord` | Write to localStorage instead |
| Refresh signal | `context/candidate-updates.tsx` (`saveCount`) | Keep; bump after every local change |
| Filters/URL | `hooks/useRecordsFilters.ts`, `lib/utils/candidate-urls.ts`, `NEW_CANDIDATE_ID = "new"` | Unchanged |
| Config | `NEXT_PUBLIC_API_URL` (browser calls the API directly) | CORS must allow the deployed domain (Task 1.2) |

Write call sites to remove (the only ones): `useCandidateDetail.ts` (`updateRecord`, `updateRecordStatus`), `useCandidateNotes.ts` (`createNote`, `deleteNote`), `useCreateCandidate.ts` (`createRecord`).

---

## 2. Phase 1 design

### 2.1 Data model

```ts
// lib/local/types.ts (temporary, so types/candidate.ts stays unchanged)
export type CandidateSource = "academy" | "local";
export type SourcedCandidate = Candidate & { source: CandidateSource };
```

- `source` is set by the code that loaded the record (academy fetch → `"academy"`, localStorage → `"local"`). It is never read from stored JSON.
- Local ID: `local-${crypto.randomUUID()}`. `isLocalId(id)` = `id.startsWith("local-")`. Academy IDs are UUIDs, so the prefix check is unambiguous.
- Local candidates are full `Candidate` objects. New ones start as `status: "received"`, `stage: "pending"` (same as the API). `applied_at`/`updated_at` are ISO now, and `notes_count` is computed from local notes.
- Local notes are `Note` objects with `id: local-note-<uuid>` and `record_id` = the local candidate ID.

### 2.2 localStorage

| Key | Value |
|---|---|
| `talent-tracker:candidates:v1` | `Candidate[]` (max 10) |
| `talent-tracker:notes:v1` | `Note[]` |

Reset Demo removes only keys starting with `talent-tracker:`.

- Read with try/catch and validate with the existing `isCandidate` / `isNote` guards. Drop invalid entries and never crash.
- Write with try/catch and surface quota errors as a normal `Error` message.
- Browser-only access, served through `useSyncExternalStore`: the server snapshot is `[]` and the client snapshot is the parsed list. A same-tab change notifies subscribers, and the `storage` event syncs other tabs.
- The 10-limit is checked **inside** `createLocalCandidate`, not only by hiding the button. This is a demo limit: a visitor can clear or edit storage.

### 2.3 Combined pipeline (matches the requirement's processing order)

```text
1 fetch ALL academy records ──┐   (getRecords page 1..n with a large limit, once per visit,
2 read local candidates ──────┤    cached in a context; refetched only on Retry)
3 normalize (add source)      │
4 merge  [...local, ...academy] (IDs cannot collide)
5 search   name or email, case- and accent-insensitive substring (trimmed)
6 filter   status, stage
7 sort     local first (newest applied_at first), then academy in API order (Task 1.4)
8 page     table: slice(page)   |   feed: first N, N += PAGE_SIZE on scroll
9 render   existing components, plus a source badge
```

Steps 3, 4 and 7 are `mergeCandidates(local, academy)` (it builds the list already in display order), and steps 5–6 are `queryCandidates(all, filters)` (filtering keeps that order). Both are in `lib/local/query.ts`.

**Academy fetch-all:** request `limit = 1000` (accepted by the API, Task 1.4), which today returns all 100 records in one request. Keep fetching pages until `collected >= total`, with a safety cap of 20 pages. If the cap is hit, show "Showing the first N academy candidates" instead of claiming complete counts.

**Academy failure:** the list still shows local candidates, with an inline error: "Academy candidates could not be loaded" plus Retry. Counts then cover local candidates only, and the UI says so.

### 2.4 Access control (enforced in hooks, hidden in UI, banned by lint)

| Operation | Academy | Local |
|---|---|---|
| List / view / read notes | GET API | localStorage |
| Create / update candidate | ✖ hidden + hook throws | localStorage |
| Create / delete note | ✖ hidden + hook throws | localStorage |
| Delete candidate / edit note | ✖ not offered (same as API) | ✖ not offered (same as API) |
| Remove all local data | — | Reset Demo only |

---

## 3. New and changed files

```text
lib/
├── api/                          # UNCHANGED
├── constants.ts                  # UNCHANGED
└── local/                        # NEW, TEMPORARY: all Phase 1 demo logic, deleted in Phase 2
    ├── constants.ts              # MAX_LOCAL_CANDIDATES = 10, ACADEMY_FETCH_LIMIT
    ├── ids.ts                    # newLocalId(), isLocalId(), assertLocalId()
    ├── local-store.ts            # safe read/write/subscribe for talent-tracker:* keys, resetDemo()
    ├── local-candidates.ts       # list/get/create(limit 10)/update/patch
    ├── local-notes.ts            # list by candidate, create, delete
    ├── academy-all.ts            # fetchAllAcademyRecords() using getRecords
    └── query.ts                  # queryCandidates(), pageSlice()
context/
└── candidate-dataset.tsx         # NEW: academy cache + local store → merged SourcedCandidate[]
hooks/
├── useCandidateTable.ts          # CHANGED: slice combined list, same return shape
├── useCandidateFeed.ts           # CHANGED: reveal combined list, same return shape
├── useCandidateDetail.ts         # CHANGED: route by source, academy read-only
├── useCandidateNotes.ts          # CHANGED: route by source, academy read-only
└── useCreateCandidate.ts         # CHANGED: local create
components/
├── shared/candidate-badges.tsx   # + SourceBadge ("Academy · read-only" / "My demo candidate")
├── local/demo-banner.tsx         # NEW, TEMPORARY: fictional-data notice, "x / 10" counter, Reset Demo
├── candidate-list/*              # badge in table rows and cards; Add button disabled at 10
├── candidate-detail/*            # readOnly prop hides Edit / Add Note / Delete Note for academy
└── candidate-form/create-candidate-form.tsx  # limit-reached state for /candidates/new and ?candidate=new
eslint.config.mjs                 # no-restricted-imports for academy write functions
```

Keep the hook return shapes the same so list and detail components need minimal edits.

**Temporary code rule:** everything that exists only for the Phase 1 demo goes in `lib/local/` (logic) or `components/local/` (UI), so Phase 2 can delete those folders. Edits that must live in existing files (hooks routing by source, `readOnly` props, badges) stay small and import from `lib/local/`, so Phase 2 finds them by searching for `@/lib/local`.

---

## 4. Executable tasks — Phase 1 prototype

Work on branch `feature/portfolio-demo`. Commit after each step (conventional commits, like the existing history). Run `npm run lint` and `npx tsc --noEmit` before each commit.

### Step 1 — Preparation and verification (no app code)

- [x] **1.1** Create branch `feature/portfolio-demo`. Run `npm install`, `npm run lint`, `npm run build`, and record the baseline result.
  - **Result (2026-10-29):** branch created from `282f15f`. Baseline after the Next.js 16.4.3 security upgrade: lint, `tsc --noEmit` and build all pass.
- [x] **1.2** Check that the API answers GET requests anonymously and allows CORS from another origin: run `curl -i -H "Origin: https://example.vercel.app" "$NEXT_PUBLIC_API_URL/records?limit=1"`. If CORS blocks it, flag it. The fallback is a read-only Next.js route handler proxy that forwards **only GET**.
  - **Result (2026-10-29):** `200 OK`, no auth needed, `Access-Control-Allow-Origin: *`, so the deployed site can call the API from the browser and no proxy is needed. The app sends no cookies, so the `Allow-Credentials: true` + `*` combination doesn't matter. `total` was 100. List rows also include a `notes` array, which the fetch-all could reuse later.
- [x] **1.3** Confirm the academy data is fictional and allowed to be shown publicly. The API is shared by course students, so check for real-looking personal data and offensive test records. If in doubt, ask 4Geeks before deploying.
  - **Decision (2026-10-29):** accepted as is. The records are seeded course test data and are shown unchanged (no masking).
- [x] **1.4** Find the API's default order (fetch `?limit=100` and compare `applied_at` / `updated_at` across rows) and the maximum `limit` it accepts. Write both into `lib/local/constants.ts` comments (done in Step 3 with `ACADEMY_FETCH_LIMIT`). If the order is unclear, use `applied_at` descending, then `id`.
  - **Result (2026-10-29):** `limit=1000` is accepted and returns all 100 records in **one request** (the default is 20). The order is **not sorted by any field** (`applied_at`, `updated_at`, `full_name`, `id` all mixed), but it is **stable**: repeated calls and pages 1+2 of 50 give the same order as one page of 100. It's most likely insertion order. This can't be confirmed without a POST, which the plan forbids.
  - **Sort rule decided:** one comparator over the merged list. Local candidates come first, newest `applied_at` first, so a new candidate appears at the top right away. Academy candidates follow in the API's order (their fetch index). This keeps the existing academy order unchanged.
- [x] **1.5** Check how the server's `search` matches (name and email? substring? case-insensitive?) so the client-side search behaves the same.
  - **Result (2026-10-29):** case-insensitive **substring** match on `full_name` **or** `email` (`ichae`, `smith@gm`, `.smith@`, `michael smith` all match). It does **not** search `position` or `phone`. Accent handling can't be told apart, because emails are accent-free copies of the names. Client search: trim, lowercase, strip accents (`normalize("NFD")`), substring on name or email. That gives the same or slightly broader results.

**Done when:** the baseline builds, and CORS, order, limit and search semantics are known.

### Step 2 — Local storage layer

- [x] **2.1** `lib/local/ids.ts`: `newLocalId("candidate" | "note")`, `isLocalId()`.
  - Also `assertLocalId()`, and a `getRandomValues` fallback, because `crypto.randomUUID` doesn't exist on plain http (the dev site on a phone).
- [x] **2.2** `lib/local/local-store.ts`: `readList(key, guard)`, `writeList(key, list)`, `subscribe(cb)` (same-tab and `storage` event), `resetDemo()`. Wrap everything in try/catch and use the existing guards.
  - `readList` returns the same array while the stored text is unchanged, ready for `useSyncExternalStore` in Step 3.
- [x] **2.3** `lib/local/local-candidates.ts` and `local-notes.ts` (limit in `lib/local/constants.ts`):
  - `createLocalCandidate(payload: CreateCandidatePayload)` → throws `"You can create up to 10 demo candidates. Use Reset Demo to start over."` at the limit.
  - `updateLocalCandidate(id, UpdateCandidatePayload)` (PUT semantics: empty URL = null) and `patchLocalCandidate(id, UpdateCandidateStatusPayload)`. Both set `updated_at`.
  - `listLocalNotes(candidateId)` (oldest first, like the API), `createLocalNote`, `deleteLocalNote`. ~~`notes_count` is derived from these.~~ **Changed:** `notes_count` is stored on the candidate and updated on each note add/delete, like the server does. Reads stay simple and cached; Step 3 doesn't need to recount.
  - Every function rejects IDs that aren't `isLocalId`.
  - Signatures mirror `lib/api/records.ts` / `notes.ts` (`{ id, payload }`, `{ id, noteId }`), so Step 5 can switch by source with no adapter code.

**Done when:** lint, typecheck and build pass. Commit `feat: add localStorage store for demo candidates and notes`.

### Step 3 — Combined dataset and query

- [x] **3.1** `lib/local/academy-all.ts`: `fetchAllAcademyRecords()` loops over `getRecords` (§2.3, page cap) and returns `{ records, total, truncated }`.
  - Returns `{ records, truncated }` (no separate `total`: the list counts matches itself). Records are keyed by ID, so a row that shifts between pages isn't shown twice. `ACADEMY_FETCH_LIMIT = 1000` and `ACADEMY_MAX_PAGES = 20` are in `lib/local/constants.ts`.
- [x] **3.2** `lib/local/query.ts`: `queryCandidates(all, { search, status, stage })` (steps 5–7) and `pageSlice(list, page, PAGE_SIZE)`.
  - Plus `mergeCandidates()`, which adds `source` and does the sort. `pageSlice` returns the same shape as `GET /records`, so the table can read it unchanged.
  - **Checked against the real API (2026-10-29):** for `jimenez`, `MICHAEL`, `smith@gm`, `Jefa`, `received + pending` and `gmail + in_progress`, the academy matches equal the API's own totals (3, 2, 1, 0, 65, 8), with local matches added on top. Page 11 of 102 has 2 rows and page 12 is empty.
- [x] **3.3** `context/candidate-dataset.tsx`: a provider placed beside `CandidateUpdatesProvider` in `app/layout.tsx`. It holds the academy fetch state (`loading`, `error`, `retry`, `truncated`) and the local list from `useSyncExternalStore`, and exposes `candidates: SourcedCandidate[]` (local `notes_count` is already stored, Step 2). The academy fetch runs **once** and is shared by the table, feed and details, which also fixes the old "first page requested twice" limitation.
  - Exposes `candidates`, `localCount`, `academyLoading`, `academyError`, `academyTruncated` and `retryAcademy` through `useCandidateDataset()`. Until Step 4 nothing reads it yet, so each page load makes one extra academy request.

**Done when:** lint, typecheck and build pass. Commit `feat: merge academy and local candidates into one dataset`.

### Step 4 — Switch the list hooks (no visual change yet)

- [x] **4.1** `useCandidateTable`: replace `getRecords` with `pageSlice(queryCandidates(...))`. Keep the return shape (`result: CandidateListResponse`, `loading`, `error`, `retry`) and the existing out-of-range jump via `onPageOutOfRange`. A local create, edit or Reset Demo updates the list right away without a skeleton flash.
  - Done. `loading`/`error`/`retry` now come from the dataset's academy state. The out-of-range jump waits until the academy has loaded (before that only local candidates are counted).
- [x] **4.2** `useCandidateFeed`: keep the IntersectionObserver, `rememberScroll` and scroll restore. Replace the page requests with `visibleCount` (+`PAGE_SIZE` per `loadMore`). A filter change resets it to `PAGE_SIZE`; a local change keeps `visibleCount`, so the cards stay put. Remove the now-unused multi-page refresh logic and its refs.
  - Done. Removed `loadedKeyRef`, `listIdRef`, `loadingMoreRef`, `refreshedCountRef` and the multi-page refresh. `loadingMore: false` / `loadMoreError: null` are still returned, so `load-more.tsx` is unchanged.
  - `saveCount` is no longer passed to the list hooks (`candidate-list.tsx`); local saves reach the list through the dataset's storage subscription. Nothing reads `saveCount` now. Step 5 decides whether `candidate-updates.tsx` is still needed.
  - Known gap until Step 5: academy create/edit still call the API, and the list doesn't show those changes until a page reload (the academy is loaded once). Step 5 removes academy writes, which closes it.
- [ ] **4.3** Manually check at desktop, tablet and phone widths: search, filters, pagination and infinite scroll show the same order and counts as before (local list is empty at this point).

**Done when:** the app looks and behaves exactly as before, with combined data under the hood. Commit `refactor: run list search, filters and paging on the combined dataset`.

### Step 5 — Source-aware details, notes, create

- [x] **5.1** `useCandidateDetail`: a local ID reads from the dataset or storage and `updateInfo`/`updateStatus` call the local functions. An academy ID uses `getRecord`, and `updateInfo`/`updateStatus` throw `"You can only edit candidates you created."` (the same message as `assertLocalId`). Return `readOnly: boolean`. Unknown local ID (removed by Reset Demo, or from another browser) → existing not-found/error state.
  - Done. A local candidate is found in the dataset, so an edit shows in the details and the list with no extra state. The dataset now also exposes `localReady` (false on the server and during hydration), so a local ID shows the skeleton, not "not found", before storage is read. A missing local ID shows the error state without Retry (`retry: undefined`).
- [x] **5.2** `useCandidateNotes`: local → `listLocalNotes`/`createLocalNote`/`deleteLocalNote`; academy → `getNotes`, and save/remove throw. Return `readOnly`.
  - Done. Local notes come from `useSyncExternalStore` over `listAllLocalNotes` (now exported: `listLocalNotes` filters into a new array, which can't be a snapshot), filtered per candidate. Other tabs' changes show too.
- [x] **5.3** `useCreateCandidate`: call `createLocalCandidate` and then `notifyCandidateSaved()`. Expose `limitReached` and `localCount`.
  - **Changed:** no `notifyCandidateSaved()`. Local writes notify the dataset through the storage subscription, so nothing reads `saveCount` in Phase 1. `context/candidate-updates.tsx` is **kept for Phase 2** (unused for now); its provider was taken out of `app/layout.tsx`.
- [x] **5.4** UI read-only states: pass `readOnly` to `general-information-card.tsx` and `recruitment-progress-card.tsx` (hide Edit) and to `candidate-notes.tsx` (hide composer and delete icons; show "Academy notes are read-only"). Use them in both `candidate-drawer.tsx` and `candidate-full-page.tsx`.
  - **Changed (your decision):** academy candidates keep their Edit, Add Note and Delete Note buttons, but they are **disabled** and show a "You can only … candidates you created." tooltip on hover, focus or tap (`components/local/no-permission-tooltip.tsx`). No "Academy notes are read-only" text. The buttons use `aria-disabled` (not `disabled`), so keyboard and touch users can still focus them and see the tooltip. The hooks still throw for academy IDs.
  - Passed via `candidate-overview.tsx`. A leftover draft can't open a form on a read-only candidate (`editing` and `composerOpen` also check `readOnly`).
- [x] **5.5** `SourceBadge` in `candidate-table.tsx`, `candidate-cards.tsx` and `candidate-header.tsx`.
  - Done, in `candidate-badges.tsx`. **Changed (your decision):** only local candidates get a badge ("My demo candidate"); academy candidates show none (no "Academy · read-only"). The table and cards take `SourcedCandidate[]`; the header reads the source from the ID, since academy details come straight from `getRecord`.
- [x] **5.6** Limit UX: the Add Candidate button in `candidates-header.tsx` is disabled at 10/10 with a tooltip/help text. `create-candidate-form.tsx` shows a "limit reached" message instead of the form when opened via `?candidate=new` or `/candidates/new` at the limit.
  - Done. Visible help text under the button (a disabled button gets no tooltip on touch screens), linked with `aria-describedby`. The form's limit message isn't shown while saving, so creating the 10th candidate still shows its success message. Both texts mention Reset Demo, which Step 6.1 adds.
- [x] **5.7** Remove the write imports from the hooks. Add an ESLint `no-restricted-imports` rule (paths `@/lib/api/records` → `createRecord`, `updateRecord`, `updateRecordStatus`; `@/lib/api/notes` → `createNote`, `deleteNote`) for all files outside `lib/api/`. `npm run lint` must pass.
  - Done. Checked that importing `createRecord` in a hook fails lint while `getRecord` passes. Lint, `tsc --noEmit` and build pass.
  - Note for 6.4: the grep also matches the comments in `lib/local/local-candidates.ts` and `local-notes.ts` that name the API functions. Grep for imports only, or reword those comments.
- [ ] **5.8** Manually check in the browser: local create, edit, and add/delete notes in the drawer and the full page; an academy candidate shows Edit, Add Note and delete as disabled, with the permission tooltip on hover (desktop) and tap (phone); the 10/10 limit; the badges at all widths.

**Done when:** local create, edit, and add/delete notes work in drawer and full page, academy records show no edit controls, and lint blocks academy writes. Commit `feat: make academy records read-only and store visitor candidates locally`.

### Step 6 — Demo shell, docs, verification

- [x] **6.1** `components/local/demo-banner.tsx` (under `app-header.tsx`): "Public demo — academy data is read-only; candidates you add are saved only in this browser. Don't enter real personal data." Also shows the "x / 10 demo candidates" counter and a **Reset Demo** button with a confirm step. Reset calls `resetDemo()`, notifies the dataset, and closes any open local candidate.
  - **Changed (your decision):** the whole banner shows only at 10 / 10 (when the limit blocks creating more): "Demo: limit reached. Reset to add more.", the counter and Reset Demo. Below 10 it's hidden; after a reset, "Demo reset. You can add 10 candidates again." shows for a few seconds. The notice fits one line on a 375px phone. The read-only and "no real personal data" points are in the README instead.
  - Done. Rendered inside `AppHeader`, so the list and the full page both get it. The confirm step replaces the notice with "Delete your N demo candidates and their notes?" + Cancel (focused) / Reset Demo. After a reset, an open local candidate (drawer `?candidate=local-…` or `/candidates/local-…`) goes back to the same list and its drafts are cleared; "Demo reset." shows for a few seconds.
- [x] **6.2** README: replace the "Known limitations" and endpoint table with the demo behavior (read-only academy, localStorage, the 10-limit is per browser and not secure, no sync, clearing storage erases data). Add an architecture diagram and the Phase 2 roadmap link.
  - Done: new "Public demo" section (academy vs. demo table, architecture diagram, Phase 2 roadmap link to §7), GET-only endpoint table, `lib/local/` and `components/local/` in the project structure, and new known limitations (including "a different address or port means a separate demo list").
  - `tsc --noEmit` and lint pass. `npm run build` ran out of memory in its type-check step (1.1 GB free RAM); rerun it with fewer apps open.
  - **Gap found and fixed:** if the academy request failed, the list showed only the error + Retry and hid the local candidates (§2.3 says they should still show). Now `candidate-list.tsx` shows the local candidates under a smaller "Could not load academy candidates … Only your demo candidates are shown." error with Retry, on both the table and the mobile cards. With no local candidates the full error shows as before. `useCandidateTable` now also jumps back from an out-of-range page after an academy error (the local candidates are then the whole list).
  - **Gap found and fixed (iPhone Safari):** the "no permission" tooltip never showed on a tap, because phones can't hover (Tailwind 4's `hover:` needs a hover-capable device) and Safari doesn't focus a tapped button. `no-permission-tooltip.tsx` now also opens on a touch/pen tap and closes after a few seconds or on a tap elsewhere.
- [ ] **6.3** Manual test checklist (desktop, tablet and 375px mobile; Chrome DevTools Network tab filtered to the API host):
  - [ ] Create 10 → the 11th is blocked; Reset Demo → can create again
  - [ ] Refresh keeps local candidates and notes; a second tab updates via the `storage` event
  - [ ] Search by name and by email finds academy and local results together; status + stage + search combined
  - [ ] Pagination counts are correct; after Reset Demo, a page that no longer exists jumps back to the last valid page
  - [ ] Mobile infinite scroll: no duplicates, resets on filter change, new local candidate appears, scroll position restored after the full page
  - [ ] Drawer ↔ expand to full page ↔ back keeps filters, page and drafts; no expand control on mobile
  - [ ] Academy candidate: Edit, Add Note and Delete Note disabled with the permission tooltip, and clicking them does nothing; notes visible
  - [ ] Local candidate: no Delete Candidate and no note editing anywhere (same as API)
  - [ ] Reset Demo → local candidates and their notes gone, only `talent-tracker:*` keys cleared; academy list unchanged
  - [ ] Block the API host in DevTools → local demo still works and the academy error + Retry shows
  - [ ] Edit localStorage JSON by hand into garbage → app recovers to an empty local list
  - [ ] **Network: zero POST/PUT/PATCH/DELETE requests to the API during all of the above**
- [ ] **6.4** Static check: `grep -rnE "createRecord|updateRecord|updateRecordStatus|createNote|deleteNote" app components hooks context lib --include=*.ts --include=*.tsx | grep -v "^lib/api/"` returns nothing. Run `npm run lint && npx tsc --noEmit && npm run build`.

**Done when:** the checklist passes. Commit `feat: add demo banner with reset and document public demo`.

### Step 7 — Deploy

- [ ] **7.1** Push the branch, review the diff, and merge to `main`.
- [ ] **7.2** Import the repo into Vercel and set `NEXT_PUBLIC_API_URL` (public anyway; there are no secrets). Do not set `DEV_ORIGIN`.
- [ ] **7.3** Run checklist 6.3 again against the production URL in a private window and on a real phone.
- [ ] **7.4** Add the live URL to the README and the portfolio.

**Phase 1 done when:** anyone can open the public URL, browse academy candidates and notes read-only, and create and edit up to 10 local candidates (adding and deleting their notes) in one combined list, with no academy write requests.

### Out of scope for Phase 1

FastAPI, PostgreSQL, Auth.js, login, admin, server-stored visitor data, fake API routes wrapping localStorage, UI redesign, edits to `lib/api/*`.

---

## 5. Known Phase 1 limitations (to state in README)

- The 10-candidate limit is per browser storage and easy to bypass; it is a UX limit, not security.
- Same features as the 4Geeks API: no candidate deletion and no note editing, for academy and local candidates alike. Reset Demo is the only way to remove local candidates.
- The academy API is publicly reachable by others. This app never writes to it, but it cannot stop third parties who call the API directly.
- Academy data is a shared course dataset and may change or contain other students' test records.
- Fetching all academy records works because the set is small (~101). Phase 2 moves filtering and paging back to the server.

---

## 6. Phase 1 architecture

```text
Visitor ─► Next.js UI (unchanged components + source badges + demo banner)
              │
              ▼
     CandidateDatasetProvider ──────────────────────────────┐
       │                         │                          │
       ▼                         ▼                          │
 fetchAllAcademyRecords     local-store (useSyncExternalStore)
 GET /records (all pages)   talent-tracker:candidates:v1 (≤10)
 GET /records/:id           talent-tracker:notes:v1
 GET /records/:id/notes            │
   READ ONLY            LOCAL create/edit + notes
       └────────────► merge (source + safe IDs) ◄───────────┘
                          │
            queryCandidates: search → filter → sort
                          │
          ┌───────────────┴───────────────┐
   table: pageSlice(page)        feed: first N, grows on scroll
```

---

## 7. Phase 2 — independent full stack (document only)

**Stack:** Python + FastAPI, PostgreSQL (SQLAlchemy + Alembic), Auth.js + Google OAuth with the PostgreSQL adapter, Next.js frontend unchanged.

### API

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/candidates` | Signed-in user's candidates; server-side search/filter/sort/paging |
| POST | `/api/candidates` | Per-user limit enforced in a transaction (safe under concurrent requests) |
| GET / PUT / PATCH / DELETE | `/api/candidates/{id}` | Ownership checked; DELETE cascades notes |
| GET / POST | `/api/candidates/{id}/notes` | Ownership checked |
| DELETE | `/api/candidates/{id}/notes/{note_id}` | Ownership checked |
| Admin | `/api/admin/users…` | List and inspect users, suspend, **reactivate**, delete, manage access; admin role checked on the server |

All mutations need authentication, authorization, ownership checks and Pydantic validation. Do not trust any client-sent user ID.

### Database

`users` (role, status: active/suspended), Auth.js `accounts` / `sessions` / `verification_tokens`, `candidates` (owner_user_id FK, indexes on owner + status/stage), `notes` (candidate_id FK ON DELETE CASCADE, author_user_id).

### Stages

1. FastAPI skeleton, config, tests, DB connection, Alembic migrations.
2. Schema and migrations for the tables above.
3. Candidate and notes endpoints with ownership, validation, transactional limit, rate limiting.
4. Auth.js + Google sign-in. FastAPI verifies a signed token or session from Next.js (design this boundary explicitly).
5. Delete `lib/local/` and `components/local/`, and point the hooks (found by searching for `@/lib/local`) at API clients behind the same interfaces. The `CandidateDatasetProvider` boundary from Phase 1 is the swap point, so components stay the same.
6. Admin dashboard: users, account details, suspend/reactivate/delete, access management, audit log.
7. Optional: import browser demo candidates after first sign-in (validated, deduplicated, limit enforced).
8. Deploy FastAPI and managed PostgreSQL; set up secrets, backups and monitoring. Keep academy GET as an optional read-only source.

### Access rules (both phases)

| Operation | Academy | Own data | Other users' data |
|---|---|---|---|
| View candidates / read notes | ✔ | ✔ | ✖ |
| Create / update candidates | ✖ | ✔ | ✖ |
| Delete candidates | ✖ | Phase 2 only (Phase 1: Reset Demo) | ✖ |
| Create / delete notes | ✖ | ✔ | ✖ |

Phase 1 isolates visitors by browser storage; Phase 2 isolates them with authenticated, server-enforced ownership.

---

## 8. Instructions to Claude Code

Work step by step. Finish Step 1 and report its findings (CORS, order, limit, search semantics, data suitability) **before** writing app code. Do not modify `lib/api/*`. Keep hook return shapes stable. Tick the checkboxes in this file as tasks are completed. If academy access or public-display permission is uncertain, stop and flag it instead of guessing.
