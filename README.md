# Talent Pipeline Tracker

Frontend for HealthCore's recruitment pipeline, built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. It replaces the shared spreadsheet the People team used for the Executive Assistant search at the Austin headquarters.

This is the **public portfolio demo** (Phase 1): visitors browse the 4Geeks Academy course data read-only and try every feature on up to 10 candidates of their own, saved in their browser. See [Public demo](#public-demo) for how it works.

## Features

- **Candidate list:** name, position, status, and stage for every candidate. A table with numbered pages on tablet and desktop; cards that load more as you scroll on mobile.
- **Filter and search:** filter by status and stage, and search by name or email, without reloading the page. Filters live in the URL, so they survive a refresh and can be shared. Academy and demo candidates are searched, filtered and paged together.
- **Candidate details:** open a candidate in a drawer over the list, or expand it to a full page (`/candidates/<id>`). Update status and stage, and correct their general information (your demo candidates only).
- **Internal notes:** add a note after a call or interview, and delete it (with confirmation) when it is no longer relevant. The note count updates right away.
- **Create a candidate:** register a referred candidate with **Add candidate**, in a drawer or on a full page (`/candidates/new`). After saving, the new candidate's details open.
- **Feedback everywhere:** every request shows loading, success, and error states; failed saves keep what the user typed and offer Retry.
- **Unsaved work survives switching views:** form edits, a half-typed note, an open delete confirmation, and the selected tab are kept between the drawer and the full page.

## Public demo

| | Academy candidates | Your demo candidates |
| --- | --- | --- |
| Where they live | The shared 4Geeks Academy course API | This browser's `localStorage` (`talent-tracker:*` keys) |
| View, search, filter, notes | Yes | Yes |
| Edit info, status and stage | No: Edit is disabled, with a "no permission" tooltip | Yes |
| Add and delete notes | No: disabled, with a tooltip | Yes |
| Create | — | Up to **10** per browser |
| Delete | No (the API has no delete) | Only all at once, with **Reset Demo** (once you have 10) |

- **The app never writes to the academy API.** It only sends GET requests. The write functions in `lib/api/` stay for Phase 2, but an ESLint rule blocks importing them anywhere else.
- **Demo candidates are marked** with a "My demo candidate" badge and listed first, newest on top.
- **The banner** under the header appears only once you reach 10 demo candidates. It shows "10 / 10 demo candidates" and **Reset Demo**, which asks first and then removes only the demo's own `talent-tracker:*` keys.
- **Don't enter real personal data.** It's a public demo, and anyone using the same browser can see it.

### Architecture

```text
Visitor ─► Next.js UI (list, drawer, full page, demo banner)
              │
              ▼
     CandidateDatasetProvider (context/candidate-dataset.tsx)
       │                                   │
       ▼                                   ▼
 fetchAllAcademyRecords              lib/local/local-store
 GET /records (all, once per visit)  talent-tracker:candidates:v1 (≤ 10)
 GET /records/:id                    talent-tracker:notes:v1
 GET /records/:id/notes                    │
   READ ONLY                         create / edit / notes (useSyncExternalStore,
       │                             synced across tabs by the storage event)
       └──────────► mergeCandidates: local first, then academy in API order
                          │
              queryCandidates: search → status → stage
                          │
          ┌───────────────┴───────────────┐
   table: pageSlice(page)        mobile feed: first N, +10 on scroll
```

All academy candidates (about 100) are loaded in one request, so search, filters and pages can cover both sources in the browser. Everything that exists only for the demo is in `lib/local/` and `components/local/`, so Phase 2 can delete those folders.

### Phase 2 roadmap

Phase 2 replaces browser storage with an own backend (FastAPI, PostgreSQL, Google sign-in with Auth.js): per-user candidates with server-side search and paging, candidate deletion, and an admin area. It's documented in [planB.md, section 7](planB.md#7-phase-2--independent-full-stack-document-only) and not built yet.

## Context of the active search

| Field | Value |
| --- | --- |
| Position | Executive Assistant |
| Company | HealthCore |
| Location | Austin headquarters |
| Profile | Executive support experience, calendar and travel management, professional English, discretion in handling sensitive information |

## API and data

The mock API is centrally deployed and shared across all company contexts in the course. Fields, values, and structure are defined in the backend technical specification. No adaptation is required.

### `status` values

| API value | UI label |
| --- | --- |
| `received` | Received |
| `in_progress` | In progress |
| `selected` | Selected |
| `discarded` | Discarded |

### `stage` values

| API value | UI label |
| --- | --- |
| `pending` | Pending review |
| `review` | Under review |
| `personal_interview` | Personal interview |
| `technical_interview` | Technical interview |
| `offer_presented` | Offer presented |

Raw API values such as `in_progress` and `personal_interview` must never appear in the interface. Always display the UI labels from these tables.

## Implementation plan

See [plan.md](plan.md) for the original implementation steps and requirement checks, and [planB.md](planB.md) for the public demo (Phase 1) and the Phase 2 backend.

## Run locally

Install Node.js and npm, then run these commands from this directory.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Configure the API. Copy `.env.example` to `.env.local` and set the backend's base URL:

   ```bash
   NEXT_PUBLIC_API_URL=https://<your-api-host>/api/v1
   ```

   Every request goes to this URL plus the endpoint path (for example `${NEXT_PUBLIC_API_URL}/records`). If it is missing, the app shows "API URL not configured" instead of loading candidates. `.env.local` is ignored by Git, so the real URL is never committed.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Restart `npm run dev` after changing `.env.local`: it is only read at startup. `NEXT_PUBLIC_` variables are built into the browser code, so don't put secrets in them.

### API endpoints used

The public demo only reads from the API:

| Method | Endpoint | Used for |
| --- | --- | --- |
| GET | `/records?limit=1000` | All academy candidates, once per visit (search, filters and pages run in the browser) |
| GET | `/records/:id` | Academy candidate details |
| GET | `/records/:id/notes` | Academy candidate notes |

Creating and editing candidates and adding or deleting notes happen in `localStorage` (`lib/local/`). `lib/api/` still has the POST, PUT, PATCH and DELETE functions for Phase 2, but nothing outside it may import them (ESLint `no-restricted-imports`).

Every response body is checked at runtime against its TypeScript type, so a malformed response shows an error instead of breaking the page. Stored demo data is checked the same way, so hand-edited or corrupt `localStorage` gives an empty demo list instead of a crash.

### Testing the dev site on your phone

1. Connect the phone and the computer to the **same Wi-Fi**.
2. Find your computer's local IP address (it usually looks like `192.168.x.x`):

   ```bash
   ipconfig                # Windows: the Wi-Fi adapter's IPv4 address
   ipconfig getifaddr en0  # macOS
   ```

3. Add it to `.env.local` (see `.env.example`):

   ```bash
   DEV_ORIGIN=192.168.x.x
   ```

   Next.js blocks dev-only files for any address other than `localhost`. Without this setting, the page opens on the phone but React never loads, so the candidate list stays on its loading state.
4. Start (or restart) the dev server so other devices on your network can reach it. `.env.local` and `next.config.ts` are read only at startup:

   ```bash
   npm run dev -- --hostname 0.0.0.0
   ```

5. On the phone, open `http://<your-ip>:3000`. The terminal also prints this address as "Network".

If the page does not load, allow Node.js through your firewall for private networks. If your router gives your computer a new IP, update `DEV_ORIGIN` and restart the dev server.

Hydration warnings in the terminal that mention attributes such as `__gcruniqueid` come from the phone browser's autofill or extensions, not from the app. A private tab does not show them.

To use DevTools on an Android phone (for example Network → Offline), connect it by USB with USB debugging on, then open `chrome://inspect` in Chrome on your computer.

## Commands

- `npm run dev` - Start the development server.
- `npm run build` - Build for production.
- `npm start` - Run the production build (after building).
- `npm run lint` - Check code with ESLint.
- `npx tsc --noEmit` - Type-check without building.

## Project structure

- `app/` - Routes: `page.tsx` (candidate list and drawer), `candidates/[id]/page.tsx` (full page for a candidate, and the create form at `/candidates/new`), `layout.tsx` (shared providers and metadata).
- `components/candidate-list/` - List header with Add candidate, filters, table, mobile cards, pagination.
- `components/candidate-detail/` - Drawer, full page, header, tabs, overview cards, notes.
- `components/candidate-form/` - The candidate form shared by edit and create, and the create form.
- `components/shared/` - App header, badges, and the empty, error, and success states.
- `components/local/` - Demo-only UI: the demo banner with Reset Demo, and the "no permission" tooltip.
- `hooks/` - Data hooks that own every read and write (`useCandidateTable`, `useCandidateFeed`, `useCandidateDetail`, `useCandidateNotes`, `useCreateCandidate`); they pick academy or local by the candidate's ID.
- `context/` - `candidate-drafts` (unsaved work across views), `candidate-dataset` (academy + local candidates, loaded once and shared by the list and details), and `candidate-updates` (a save signal kept for Phase 2, not used in the demo).
- `lib/api/` - One typed function per endpoint, the shared fetch helper, and runtime response validators.
- `lib/local/` - Demo-only logic: `localStorage` access, local candidates and notes, the 10 limit, fetching all academy candidates, and the merged search/filter/paging.
- `lib/utils/` - Formatting, form conversion and validation, URL helpers.
- `types/` - Candidate and note types matching the API.
- `public/ui-ux/` - Design screenshots used as visual references.

## Known limitations

- **Demo candidates stay in one browser.** They live in `localStorage`, so they don't sync between browsers or devices, and other people never see them. Clearing site data, or a different address (`localhost` vs `127.0.0.1`, another port), means a separate, empty demo list.
- **The 10-candidate limit isn't security.** It's checked in the browser, so anyone can get around it by editing or clearing storage. It only keeps the demo tidy.
- **The academy API is public.** This app never writes to it, but it can't stop others from calling the API directly. It's shared course data, so it may change or contain other students' test records.
- **Loading all academy candidates only works while the data is small** (about 100 records). If it ever grows past 20 pages of 1000, the list stops there and counts cover only what loaded. Phase 2 moves search and paging back to the server.
- **No candidate deletion or note editing**, for academy and demo candidates alike (the API has neither). Reset Demo is the only way to remove demo candidates.
- **Notes have no author.** The API stores only the text and date, so cards show those.
- **Unsaved work lives in memory.** Drafts survive switching between drawer and full page, but not a page reload or closing the tab.
- **Client-side rules stricter than the API.** Phone numbers must have 7–15 digits and Years of Experience must be 0–60; the API itself accepts any value.
- **Not built yet:** the pipeline summary (stat cards and stage bar) in `components/future/`.
