# Test suite audit: keep, merge or cut?

Research date: 2026-10-15. Scope: every Vitest project and Playwright spec file, and the CI workflow that runs them. Question from the user's review (`docs/reviews/review3.md`, line 11): are all tests worth keeping, given that the suite grows and runs take longer locally and in CI?

Repo state: `main` at `c3dd295`, clean working tree. No test, source file or CI setting was changed for this audit.

Verification legend (same as `docs/research/android-nav-bar-and-share-sheet.md`):
- **[V]** read in a primary source: a repo file, CI logs or run data from GitHub (`gh`), or a local command output.
- **[I]** inference from those sources. Not measured directly.
- **[U]** could not verify. Listed under open points.

CI runs are cited by their GitHub run ID. Job timings come from `gh api` job and step data. Test timings come from the Playwright list-reporter lines in the job logs, which show each test's duration.

---

## TL;DR

- **Keep almost everything. Thin out a little, and split CI into more shards.** Cutting rows 1 to 16 in section 5.1 saves about 80 seconds of machine time per run, which is about 20 seconds of wall-clock time on four shards. More shards save about 2 minutes of wall-clock time on each pull request, with no test removed. [V for the inputs, I for the savings]
- **Size.** 929 Vitest cases in 74 files, and 363 Playwright tests in 49 spec files. [V: CI run 38730234206, `playwright test --list`]
- **Time now.** A pull request run takes a median of 6.8 minutes of wall-clock time (41 successful runs since 2026-10-10). Its critical path is one browser shard of about 5.5 minutes. The four browser shards together spend about 18 minutes in tests per run. The Vitest step takes under a minute: a 12.5-second `nuxt build`, then Vitest, which reports 36 seconds. [V]
- **Growth.** Browser tests went from 163 (2026-10-04) to 363 (2026-10-15). Test time per run went from about 12 to about 18 minutes. Per test the cost stayed about 3 seconds, so the growth is the number of tests, not slower tests. [V for the counts, I for the per-test reading]
- **Vitest is not the problem.** Its cases went from about 260 to 929, but its step stayed between about 20 and 56 seconds across 147 runs. [V]
- **Savings from cutting, ranked by risk.** (a) Delete, merge or move down the 16 browser-test rows 1 to 16 in section 5.1, most of which repeat an API or client test: about 80 s machine per run, about 20 s wall. (b) Trim the `affordances` file by half (row 17): about 60 s machine, about 15 s wall. Both are estimates. [I]
- **Savings from CI, no test removed.** Eight browser shards instead of four: about 2.2 minutes less wall-clock time per pull request (6.8 to about 4.6 minutes), and about 4 minutes more machine time per run. [I, from the timings above]
- **Cutting tests is not the main lever.** Sharding is. Each removed browser test saves a few seconds. Going from four to eight shards saves about 2 minutes.
- **Nothing is cut until you decide.** Each accepted cut would become its own ticket. The CI change is also a decision. I have not made it.

---

## 1. Inventory

### 1.1 How the tests run

- `package.json`: `test` is `vitest run`. `test:e2e` is `tsx tests/e2e/run.ts`, which creates a throwaway local Postgres database, runs `playwright test`, and drops the database afterwards. [V]
- `vitest.config.ts`: six projects. `api` runs every API test file against one server and one database, with `fileParallelism: false`. `source-lookup`, `image-store`, `push` and `email` test server modules with faked upstreams. `client` tests client modules with faked I/O, in Node only. [V]
- `playwright.config.ts`: `fullyParallel: false`, `workers: 1`, `retries: 1` in CI, `trace: 'retain-on-first-failure'`. Its `webServer` runs `pnpm dev`, the development server, not the production build. [V]
- 27 of the 49 spec files use `mode: 'serial'`. In a serial file a failure makes the retry start again from the first test of the file. [V: grep of `tests/e2e`; retry behaviour per the project's own note in issue #225]
- `.github/workflows/ci.yml`: runs on pull requests only. Docs and Markdown changes skip it. The last run on `main` was run 37817921354 on 2026-10-08. Jobs: `check` (install, lint, typecheck, `pnpm test`) and `e2e` as a matrix of four shards, each with a Postgres 17 service, a cached Playwright browser, and an artifact upload of traces. [V]

### 1.2 Vitest: 74 files, 929 cases

Counts and times are from one CI run (38730234206, 2026-10-15). `vitest list` shows 649 definitions. The difference is `test.each` expansion, which CI counts as separate cases. The time column is the file's own duration in that run, not a median. Totals: api 36 files and 357 cases in 14.1 s (serial); client 29 files and 299 cases in 0.35 s; source-lookup 2 files and 179 cases in 1.3 s; image-store 5 files and 70 cases in 1.4 s; push and email 1 file each. [V]

| Project | Test file | Tests (CI) | Time in CI (ms) | What it covers |
|---|---|---:|---:|---|
| api | `api/addresses.test.ts` | 8 | 370 | Board and Dish addresses, forwarding after renames and moves, the migration that gives existing Boards addresses. |
| api | `api/auth-endpoints.test.ts` | 33 | 206 | Better Auth endpoints the app does not use answer 404; the Google sign-in and sign-out endpoints still work. |
| api | `api/board-settings.test.ts` | 13 | 502 | Board rename, Column add, rename, reorder and delete rules, the Gekocht Column, where deleted Dishes go. |
| api | `api/cleanup.test.ts` | 8 | 246 | The daily cleanup job: unreferenced images, purge after 30 days, restore windows, refused to signed-in Members. |
| api | `api/column-subtitles.test.ts` | 5 | 292 | Column subtitles: defaults, kept on rename, length limit, the Gekocht subtitle fixed, the migration. |
| api | `api/cooking.test.ts` | 18 | 1234 | Cookings: recorded on moves into Gekocht, the undo rules (age, owner, older Cooking), notes, deleting and restoring. |
| api | `api/csp-report.test.ts` | 12 | 123 | The CSP report endpoint: the report formats, one log line each, size and rate limits, origin check. |
| api | `api/dish-bulk.test.ts` | 12 | 657 | Moving, undoing and deleting several Dishes together: all or nothing, only on the user Boards. |
| api | `api/dish-delete.test.ts` | 7 | 323 | Deleting and restoring one Dish, the undo position, Members only. |
| api | `api/dish-edit.test.ts` | 16 | 372 | Editing a Dish title, note, Source, Creator and Placeholder; Members only. |
| api | `api/dish-move.test.ts` | 12 | 497 | Moving a Dish to a Column and to a drop place; the answer for undo; Members only. |
| api | `api/dishes.test.ts` | 17 | 356 | Adding a Dish: placement at the top, note, Creator, Source kind, image copy fallback, validation. |
| api | `api/duplicate-source.test.ts` | 5 | 145 | The duplicate Source check, per Board, and the save-anyway path. |
| api | `api/email-digest.test.ts` | 11 | 437 | The digest switch and the daily job: who gets an email, each Dish once, Board membership, Resend failures. |
| api | `api/health.test.ts` | 1 | 29 | The health endpoint reports the app up with its database migrated. |
| api | `api/image-focus.test.ts` | 10 | 1065 | Focus points of Dish images: defaults, shifting, new photos, Placeholders. |
| api | `api/images.test.ts` | 5 | 74 | Image copying: a non-Member copies no image, adding a Dish or reloading its image. |
| api | `api/invite-links.test.ts` | 16 | 816 | Invite Links: the landing, joining, sign-in with a remembered invite, resets, secrets, guessing limits, old tokens. |
| api | `api/landing-board.test.ts` | 4 | 119 | The first sign-in creates one Board; landing is race-free; a Board is hidden from non-Members. |
| api | `api/members.test.ts` | 8 | 432 | Members: the list, leaving, removal, rejoining, handing over ownership, deleting a Board. |
| api | `api/new-dishes.test.ts` | 5 | 256 | The "Neu" marker: Dishes other Members added since the last open. |
| api | `api/origin-check.test.ts` | 6 | 125 | Writes from other origins are refused; reads from other origins are not. |
| api | `api/own-photo.test.ts` | 13 | 1099 | Own Photos: JPEG storage and scaling, HEIC, the 10 MB limit (413), chunked bodies (411), Members only. |
| api | `api/person-card.test.ts` | 6 | 365 | The Member card: Username, picture, shared Boards, Dishes added here; refused to strangers. |
| api | `api/placeholder-migration.test.ts` | 1 | 157 | One-time migration that moves Dishes off five removed Placeholder Images. |
| api | `api/placement-rules.test.ts` | 4 | 307 | Placement rules for new, moved and cooked Dishes; server and rule agree. |
| api | `api/profile-picture.test.ts` | 16 | 1123 | Profile Pictures: square JPEG storage, use, kept on sign-in, removal falls back to the Google photo. |
| api | `api/push.test.ts` | 14 | 621 | Push on the server: per-device on and off, Members only, one notification per Board, clean-up on 404 and 410. |
| api | `api/rate-limits.test.ts` | 9 | 372 | The 429 limits on lookups, uploads, creation and the auth endpoints. |
| api | `api/response-headers.test.ts` | 11 | 123 | Security headers: no framing, no sniffing, no-store, the report-only CSP with nonces. |
| api | `api/search.test.ts` | 5 | 288 | Board search: part-of-title matching, Board scope, % and _ as plain characters, Members only. |
| api | `api/several-boards.test.ts` | 8 | 306 | Several Boards: creation, the Board list order, landing on the last Board, moves between Boards and Cooking history. |
| api | `api/sign-in.test.ts` | 8 | 91 | Sign-in with Google: the Allowlist, the verified-email rule, sessions, /api/me. |
| api | `api/source-lookup.test.ts` | 5 | 62 | The Source Lookup endpoint: needs a session; answers for any link. |
| api | `api/username-migration.test.ts` | 1 | 149 | One-time migration that gives every existing user a Username. |
| api | `api/usernames.test.ts` | 24 | 340 | Username rules, uniqueness, the change limit, what Members see, the one-time question for older users. |
| client | `client/address.test.ts` | 4 | 5 | Address from a name: lower case, dashes, length limit, Board and Dish paths. |
| client | `client/board-emojis.test.ts` | 2 | 2 | The Board emoji choice: no meat, fish, egg or dairy emoji; full rows of seven. |
| client | `client/board-gradient.test.ts` | 3 | 3 | The Board gradient across the Column accents and the switcher fill. |
| client | `client/board-module.test.ts` | 63 | 77 | The Board client module: Dish and Column operations on an in-memory transport, including failures and undo. |
| client | `client/celebration-clips.test.ts` | 23 | 10 | Celebration drawings: timing, frame positions and layers of the 10th Cooking and new-Board clips. |
| client | `client/cheer.test.ts` | 6 | 15 | The cheer picker never repeats the last cheer. |
| client | `client/drop-index.test.ts` | 5 | 4 | Where a dragged Dish lands among the cards: the slot rules. |
| client | `client/empty-column.test.ts` | 5 | 10 | The order of the empty-Column illustrations. |
| client | `client/empty-state-clips.test.ts` | 22 | 18 | Empty-state drawings: frame timing and layers of the empty Board, empty Column and empty search. |
| client | `client/example-prompt.test.ts` | 3 | 5 | The Column name prompt cycles through its ten examples. |
| client | `client/image-focus.test.ts` | 11 | 6 | Overflow and drag-axis rules for the focus point of Dish images. |
| client | `client/invite.test.ts` | 5 | 4 | The Invite Link format and the token at its end. |
| client | `client/link-lookup.test.ts` | 12 | 19 | Link lookup timing: the "looking" state, the pause in typing, stale answers ignored. |
| client | `client/lookup-clips.test.ts` | 6 | 7 | The lookup drawings: stirring timing and angles, the failed pose. |
| client | `client/native-titles.test.ts` | 2 | 8 | No native title attributes in the app templates (a static check). |
| client | `client/never-cooked.test.ts` | 3 | 3 | The never-cooked scenes: their order, and a stable scene per Dish. |
| client | `client/new-column.test.ts` | 4 | 4 | Adding a Column: name trimmed, blank refused, no double add. |
| client | `client/person-strings.test.ts` | 7 | 14 | Names and Usernames as they appear in strings. |
| client | `client/photo-upload.test.ts` | 13 | 26 | The photo upload client: upload, and too-large files refused before sending. |
| client | `client/placeholders.test.ts` | 9 | 19 | The 12 Placeholder Images, and which drawing a title picks. |
| client | `client/push-switch.test.ts` | 9 | 7 | The push switch: its states, the browser permission, subscribing, a failing server. |
| client | `client/service-worker-push.test.ts` | 5 | 22 | The service worker: a push shows the notification; a tap opens the Dish or Board. |
| client | `client/shared-link.test.ts` | 8 | 4 | A shared link from the share sheet: the URL, the text fallback, the title search. |
| client | `client/shortcuts.test.ts` | 8 | 5 | Keyboard shortcut mapping, and silence while typing or in a dialog. |
| client | `client/svg-loop.test.ts` | 7 | 10 | The SVG loop helper: keyframes, duration, pivot points. |
| client | `client/system-clips.test.ts` | 28 | 17 | System drawings (offline, error, invite, not unlocked): frames and layers. |
| client | `client/topfbert-idle.test.ts` | 12 | 5 | Topfbert idle loops per mood: breathing, blinking, hat, steam, sparks. |
| client | `client/type-in.test.ts` | 6 | 19 | Suggested Title typing speed, with fake timers. |
| client | `client/video-embed.test.ts` | 8 | 5 | Which links play in which embed player; which Dishes get no video. |
| email | `email/email.test.ts` | 7 | 33 | The digest email (listing, subject, escaping) and its sending through Resend in batches. |
| image-store | `image-store/found-image.test.ts` | 6 | 4 | A found image is copied for Members only. |
| image-store | `image-store/image-store.test.ts` | 29 | 305 | The Image Store: download, JPEG preparation, animated GIFs as stills, storage. |
| image-store | `image-store/image-tickets.test.ts` | 6 | 4 | Image tickets: the right Member and image, and expiry. |
| image-store | `image-store/photo.test.ts` | 24 | 1077 | Own Photo preparation: size, orientation, metadata removed, never enlarged. |
| image-store | `image-store/sweep.test.ts` | 5 | 15 | The sweep deletes old unreferenced images and keeps referenced ones. |
| push | `push/push.test.ts` | 17 | 38 | The push service seam: which services a subscription may use, sending the messages. |
| source-lookup | `source-lookup/public-network.test.ts` | 53 | 55 | The link check: only public addresses are connected to. |
| source-lookup | `source-lookup/source-lookup.test.ts` | 126 | 1221 | Source Lookup against recorded upstream fixtures: TikTok, Instagram, YouTube, Pinterest, blogs. |
| **Total** | | **929** | **17184** | 74 files; CI sample run 38730234206 |

### 1.3 Playwright: 49 files, 363 tests

Counts are from `playwright test --list` (the single default project). Times are the median test time per run in CI, taken from the list-reporter durations in the job logs of the 42 successful or failed pull request runs since 2026-10-10 (hosted runners). A file that was added later has fewer runs, and its column says how many. The column sums are not additive, because some files ran in fewer runs. The whole run is about 18 minutes (section 2). [V]

| Spec file | Tests | Median test time per run (s) | Runs measured | What it covers |
|---|---:|---:|---:|---|
| `achievements.spec.ts` | 9 | 58 | 42 | Achievement level badge and its pips; the 10th Cooking celebration, its toast and undo; a new Board celebration. |
| `add-column-lane.spec.ts` | 8 | 18 | 42 | The add-Column lane on desktop: placement, example names, empty or failing adds, no lane below 1200px, sync to another Member. |
| `add-dish-from-link.spec.ts` | 16 | 56 | 42 | Add Dish from a pasted link: loading, title typing in, image-only and failed lookups, duplicate warning, Source badges, image fit. |
| `add-dish.spec.ts` | 3 | 18 | 42 | Add Dish on an empty Board, the dark-theme card, one Column on a phone and side by side on a tablet. |
| `addresses.spec.ts` | 7 | 24 | 42 | Readable addresses for Boards and Dishes, old addresses forwarding after renames and moves, what other Members see. |
| `affordances.spec.ts` | 11 | 129 | 23 | Every clickable control on each main screen shows the pointer and a hover reaction; disabled controls do neither; reduced motion; Column tabs. |
| `board-colour.spec.ts` | 12 | 15 | 42 | Each Column accent tint, the gradient across Columns, the tint while dragging, the blob in an empty Column. |
| `board-dish-count.spec.ts` | 4 | 19 | 18 | The Dish count in the header and the switcher, and that it follows adds, deletes and moves by any Member. |
| `board-scroll.spec.ts` | 3 | 8 | 22 | The Board keeps its scroll after a Dish closes, other pages start at the top, the sideways scrollbar look. |
| `board-settings.spec.ts` | 22 | 44 | 42 | Board settings: rename, Columns (add, rename, reorder, delete, where Dishes go), subtitles, grip dragging, Invite Link and share dialogs. |
| `column-headline.spec.ts` | 5 | 14 | 42 | On a phone, the active Column name and subtitle as a headline above the tabs; none from 768px up. |
| `column-scroll.spec.ts` | 11 | 26 | 21 | Column edge indicators: which one shows, one Column per step, wheel and scrollbar, keyboard, and the card look. |
| `column-tabs.spec.ts` | 5 | 18 | 42 | Phone Column tabs and swiping; moving a Dish to another Column from its menu; all Columns side by side from 768px. |
| `cooking.spec.ts` | 11 | 60 | 42 | Cooking a Dish: "Gekocht" and its undo, notes, deleting a Cooking, the celebration, the toast and pill on phones. |
| `dish-card-title.spec.ts` | 5 | 6 | 42 | Long titles cut to two lines on cards; the full title on hover and focus, and for screen readers. |
| `dish-delete.spec.ts` | 5 | 26 | 42 | Deleting a Dish from the card or the detail, undo and its place, focus afterwards, a failed delete. |
| `dish-detail.spec.ts` | 20 | 69 | 42 | The Dish detail: opening, panel widths, edits and their saving, Source and image changes, focus, the compact bar, parallax, morphs. |
| `dish-note.spec.ts` | 3 | 8 | 17 | The note icon on a card: the Tooltip on hover or focus, and the note on tap on a phone. |
| `drag-and-drop.spec.ts` | 14 | 32 | 42 | Dragging Dishes on desktop and phone: within and across Columns, onto tabs, into Gekocht, a failed drop, drop indicators. |
| `email-digest.spec.ts` | 2 | 14 | 6 | The daily email switch in settings, phone and desktop: off until switched on, and it stays on after a reload and on another device. |
| `error-screen.spec.ts` | 3 | 3 | 42 | The error screen for an unknown Board and for an unexpected error, with retry; no dev overlay on the next page. |
| `image-focus.spec.ts` | 3 | 25 | 42 | Shifting the visible part of a photo (focus point) on the card and in the detail for every Member; new photos start centred. |
| `input-labels.spec.ts` | 2 | 19 | 42 | Every labelled field shows its label in its border, in light and dark. |
| `installable.spec.ts` | 2 | 2 | 42 | Every page links a manifest that makes malkochen installable; the iOS home-screen icon and the browser favicons. |
| `invite-links.spec.ts` | 5 | 20 | 42 | The Invite Link: first-time and signed-in joins, reset links, renamed Boards, old links, the limit on guessed links. |
| `keyboard-shortcuts.spec.ts` | 7 | 15 | 42 | Keyboard shortcuts: N, /, Esc, comma, 1 to 9 for Boards, ?, and the same list in settings. |
| `members.spec.ts` | 4 | 11 | 42 | Board Members: the Owner hands over the Board, a Member leaves, the Owner removes a Member, the Owner deletes the Board. |
| `multi-select.spec.ts` | 5 | 29 | 9 | Selecting several Dishes (Ctrl-click on desktop, long-press on phone) and moving or deleting them together, with undo. |
| `offline.spec.ts` | 7 | 14 | 42 | The Offline page when the app or the connection is down, reconnecting, and its reduced-motion still. |
| `own-photo.spec.ts` | 4 | 29 | 42 | A photo picked from the device becomes a Dish image without its location, refused files, the link fallback, replacing an image. |
| `placeholder-loops.spec.ts` | 11 | 43 | 42 | Placeholder drawings loop only where visible: the detail, the Board on first view and at scroll stop, hover, the picker, reduced motion. |
| `profile-picture.spec.ts` | 4 | 12 | 42 | Profile Picture upload, preview and cancel, sign-in keeps it, refused files. |
| `push-notifications.spec.ts` | 3 | 11 | 8 | The push switch in settings: off until turned on, per device; the message when the browser blocks notifications. |
| `reduced-motion.spec.ts` | 3 | 19 | 42 | With reduced motion, the main flows still work and each motion graphic shows its still (sign-in, adding, cooking, search, badges, error). |
| `search.spec.ts` | 2 | 7 | 42 | Search finds Dishes from every Column and says when there are none; results follow the Board; the close button. |
| `several-boards.spec.ts` | 16 | 46 | 42 | Several Boards: creating, switching (pill, tint, gradient, skeleton), moving Dishes between Boards with celebrations and undo. |
| `share.spec.ts` | 6 | 14 | 38 | Sharing into malkochen (Android share target): link from the URL or the text, the Board picker, sign-in first. |
| `sign-in.spec.ts` | 10 | 11 | 42 | Sign-in screen copy and highlight, the "Not unlocked" screen, legal links in the footer, landing after sign-in. |
| `skeleton.spec.ts` | 7 | 8 | 42 | Design tokens in the browser: headline sizes at breakpoints, self-hosted fonts, motion token values with and without reduced motion. |
| `splash.spec.ts` | 8 | 17 | 42 | The splash: first paint, the hold, 2 s, tap to close, no splash on reload or in-app navigation, reduced motion, centred icon. |
| `state-clips.spec.ts` | 11 | 28 | 42 | Which illustrations loop in empty and special states: empty Board and Columns, search, link lookup, never cooked, sign-in, invite, error. |
| `sync.spec.ts` | 10 | 70 | 42 | Changes by another Member appear without a reload; polling pauses in the background; "Neu" after half an hour away; back online. |
| `tooltip.spec.ts` | 8 | 40 | 23 | Tooltips: about 400 ms after a mouse rests, on focus, Escape, drags, screen edges, sheets, touch; no native titles left. |
| `topfbert-idle.spec.ts` | 3 | 7 | 42 | Topfbert idles on the page clock, pauses when scrolled away, stands still with reduced motion or under another dialog. |
| `type-scale.spec.ts` | 7 | 20 | 42 | Computed font family, size and weight of text in each style of the type scale (overline, small, section headings, mono). |
| `user-popover.spec.ts` | 7 | 21 | 15 | The Member popover on pictures: hover, keyboard, tap on a phone, in the Dish detail, for people who left every Board. |
| `user-settings.spec.ts` | 16 | 31 | 42 | The user menu and settings sheet: open, keyboard, close, theme choice with its reveal, sign-out, legal pages. |
| `usernames.spec.ts` | 6 | 28 | 20 | Usernames: picking one as a new user, through an Invite Link, the one-time question for older users, changing it in settings. |
| `video-embed.spec.ts` | 7 | 53 | 4 | Video Dishes: image and "Video abspielen", playing in place for TikTok, YouTube Shorts and Instagram; the CSP for other frames. |
| **Total** | **363** | **1311** (sum of medians) | | 49 files, 27 of them serial |

---

## 2. Run times

### 2.1 Fixed overhead and test time, now

Hosted runners, pull request runs since 2026-10-10 (run data and step data from `gh`):

| Part | Median | Basis |
|---|---:|---|
| PR run, wall clock (created to last update) | 6.8 min | 41 successful runs; includes GitHub queue time |
| `e2e` job, one shard, start to end | 5.5 min | 172 shard jobs |
| of which container start | 0.25 min | step "Initialize containers" |
| of which `pnpm install` (cached) | 0.17 min | step |
| of which Playwright system libraries | 0.23 min | step "install-deps"; the browser itself is cached, its step takes 0.00 min |
| of which checkout, Node, pnpm, cache, post steps | about 0.25 min | steps |
| of which `pnpm test:e2e --shard=N/4` | 4.6 min | step; Playwright's own clock is about 0.1 min less [I] |
| `check` job | 1.9 min | install 0.15, lint 0.15, typecheck 0.25, `pnpm test` 0.77 |
| Test time per run, four shards | about 18 min | median 17.5, mean 17.7, range 11 to 24, from 43 runs with per-test durations |

Reading. Each browser shard has about 0.9 minutes of fixed overhead, and the rest is tests. Inside the step, about 0.1 to 0.2 minutes per shard is not test time (dev server start and hooks, inference). The Vitest step has a 12.5-second `nuxt build` before the tests, and Vitest reports 36.3 seconds (run 38730234206). [V]

Queue time is normally 0.05 minutes, but some runs waited a long time for a runner: run 38522665801 waited 20.5 minutes for shard 4/4, and run 38517587307 waited 13.1 minutes. Median run wall-clock times are therefore a little high. Job durations are the better basis. [V]

### 2.2 Trend

Median wall-clock time of successful runs, per day (includes queue time):

| Day | Runs | Median wall (min) | What CI did that day |
|---|---:|---:|---|
| 2026-10-03 | 13 | 11.0 | one `check` job; browser tests inside it |
| 2026-10-04 | 21 | 4.8 | browser tests split into four shards (#142, from 11:57) |
| 2026-10-05 | 33 | 4.8 | same |
| 2026-10-06 | 10 | 7.2 | same |
| 2026-10-07 | 9 | 7.0 | same |
| 2026-10-08 | 10 | 8.0 | a self-hosted runner for part of the day (runs 37820019457, 37975444175 at 38 min, not comparable) |
| 2026-10-09 | 1 | 37.6 | self-hosted, not comparable |
| 2026-10-10 | 7 | 4.8 | back on GitHub-hosted runners (run 38037328405) |
| 2026-10-11 | 8 | 5.6 | same |
| 2026-10-13 | 9 | 6.6 | same |
| 2026-10-14 | 12 | 8.5 | same; includes two runs that waited 13 and 20 minutes for a shard |
| 2026-10-15 | 5 | 8.5 | same |

Growth in the suite and in the time it takes:

| | Early (2026-10-03/04) | Now (2026-10-15) |
|---|---:|---:|
| Vitest cases | 263 (24 files) | 929 (74 files) |
| Vitest step duration | 20 to 37 s | 36 s; 20 to 56 s over 147 runs, no clear trend |
| Playwright tests | 163 (2026-10-04) | 363 (49 files) |
| Browser test time per run, median | 11.8 min (82 runs, 2026-10-04 to 10-08) | 17.5 min (43 runs, 2026-10-10 to 10-15) |
| Browser test time per shard, median | 3.1 min | 4.6 min |

Reading. Test time per run went up by about half, while the browser test count went up by more than half and per-test time stayed about 3 seconds. So the growth is the count of tests. [I]

Local run on this PC, 2026-10-15: `pnpm test` (Vitest) passed all 929 cases. The whole command took 157 seconds of wall-clock time. Vitest reported 155.6 seconds, of which 86 percent was tests, and the Nuxt build printed 72 seconds. I did not separate the two. CI reported 36.3 seconds for the same suite with a 12.5-second build. The local run is one sample, so the ratio is a rough guide only. [V for the output, I for the reading]

---

## 3. Flakes

Source: Playwright's list reporter marks a test that failed and then passed on the retry with `(retry #1)`, and it prints `N flaky` at the end of a shard. I parsed the logs of all 508 browser shard jobs from 127 runs since 2026-10-04 11:00. [V]

- 16 of 127 runs had at least one test that passed only on its retry. Since 2026-10-10, 7 of 43 runs did. [V]
- The last 50 CI runs (2026-10-08 17:18 to 2026-10-15 11:50; 46 succeeded, 2 failed, 2 were cancelled): 8 had a first-try failure. The retry rescued 7 of them. One run failed on both tries (run 38692560021, 2026-10-15 06:27, `affordances.spec.ts` "your settings and the new Board sheet", both tries failed after 29.2 s and 21.5 s). The same branch passed 17 minutes later (run 38694251620). [V]

| Test | Where it flaked | Status |
|---|---|---|
| `reduced-motion.spec.ts` "the achievement badge shows its count at once; both celebrations show their stills and stay until closed" (line 125) | 5 runs: 37811520980, 38407860660, 38450917596, 38543988783, 38573928997 (last 2026-10-14) | Still flaking. #225 fixed it on 2026-10-10 with `.first()`; four of the five runs came after that fix. Root cause not confirmed [I]. Open. |
| `user-settings.spec.ts` "closing your settings (Escape, or its close button) leaves the Board as it was ..." (line 69) | 3 runs: 38458568748, 38517587307, 38522665801 (last 2026-10-14 06:31) | Fixed by #260 (merged 2026-10-14 08:37). No retry pass in the runs after the merge. |
| `addresses.spec.ts` "a renamed Board is at its new address, and its old one forwards there" (line 93) | 1 run: 38450917596 (2026-10-13) | Not in any ticket. Open. |
| `affordances.spec.ts` "your settings and the new Board sheet" (line 214) | 1 run: 38692560021 (2026-10-15), failed on both tries | Passed in the next run on the same branch. Open. |
| `members.spec.ts` "the Owner deletes the Board only after typing its name" (line 87) | 1 run: 37797019077 (2026-10-08) | Fixed in #225. |
| Whole serial files: `state-clips.spec.ts` (9 tests) and `dish-detail.spec.ts` (tests at lines 458 and 463) | runs 37798724256 (2026-10-08), 37610426365 (2026-10-07), 37512350725 (2026-10-06) | One failure in a serial file made the retry rerun the whole file on the same data. Fixed by #225 and #228. |
| `cooking.spec.ts` 360px toast tests (lines 337, 339, 377) | runs 37656763680, 37797019077, 37798724256 (2026-10-07 and 10-08) | Not flakes, per #225: the text is about 5 percent wider on Linux. Adjusted in #170. None since. |

Closed issues about flaky tests (`gh issue list --state all --search flaky`): #81 (dark-theme card, closed 2026-10-02), #225 (inventory and six fixes, closed 2026-10-10), #228 (a retried serial file starts clean, closed 2026-10-11), #233 (board-settings, closed 2026-10-11), #260 (settings scroll, closed 2026-10-14). #227 and #229 were app race conditions found through flakes, and both are closed. #142 (CI speed: shards and one retry) is closed. [V]

Reading. Flakes cost little time on average, but a red run costs a rerun by hand, which is the expensive part. Each first-try failure of the achievement test also costs its 30-second timeout. [I]

---

## 4. Overlap and value

### 4.1 Browser tests that repeat a rule already tested lower down

Each row is a browser test whose rule is also asserted in an API or client test. The browser test may still cover the screen, which is why most rows are "move down" or "merge", not "delete".

| Browser test | Also tested at | Note |
|---|---|---|
| `addresses.spec.ts` "a renamed Board is at its new address, and its old one forwards there" (l93) | `api/addresses.test.ts` "renaming a Board gives it a new address; the old one forwards there, and renaming back takes it again" (l85) | Same rule. |
| `addresses.spec.ts` "someone else's Board's address looks like one that doesn't exist" (l158) | `api/addresses.test.ts` "a Board's former address, too, looks to a non-Member like one no Board has" (l154) | Same rule. |
| `board-settings.spec.ts` "an empty Column goes at once" (l173) | `api/board-settings.test.ts` "an empty Column is deleted without asking where its Dishes go" (l116) | Same rule. |
| `board-settings.spec.ts` "a Member adds, renames and reorders Columns; Gekocht is marked and can't be deleted" (l71) | `api/board-settings.test.ts` lines 63, 82, 127 | Same rules, one browser test for all three. |
| `members.spec.ts` "the Owner removes a Member, told that the link still lets them back in" (l72) | `api/members.test.ts` "only the Owner removes a Member, who then loses the Board" (l86) | Same rule. |
| `members.spec.ts` "the Owner sees the Members, hands ownership over, and can then leave" (l31) | `api/members.test.ts` "the Owner hands ownership to a Member, and can then leave" (l137) | Same rule. The browser test also checks the screen, so it stays. |
| `members.spec.ts` "a Member leaves, and lands on another Board" (l54) | `api/members.test.ts` "a Member leaves; the Board is gone for them ..." (l70) | Same rule. |
| `email-digest.spec.ts` "on the desktop/phone, the daily email is off until switched on ..." (l15) | `api/email-digest.test.ts` "the digest is off until a Member switches it on, and stays on in every session ..." (l89) | The file's own header says the rules are covered by the API test. Two viewports for one switch. |
| `push-notifications.spec.ts` "on the desktop/phone, push notifications are off until turned on ..." (l69) | `api/push.test.ts` "push notifications are off for a device until it is turned on ..." (l94); `client/push-switch.test.ts` "off until it is turned on" (l59) | Three layers. Two viewports in the browser. |
| `push-notifications.spec.ts` "when the browser blocks notifications, the switch stays off and the sheet says why" (l93) | `client/push-switch.test.ts` "the browser blocking notifications keeps it off, and says so" (l114) | Same rule. |
| `search.spec.ts` "finds Dishes from every Column, and says when there are none" (l17) | `api/search.test.ts` "finds Dishes by part of their title, ignoring case, in every Column" (l46) | Same rule; the browser test adds the empty-state copy. |
| `dish-delete.spec.ts` "deleting from the card's menu can be undone, back in the same place" (l20) | `api/dish-delete.test.ts` "undo puts a deleted Dish back in its Column, at the position it had" (l50) | Same rule. |
| `cooking.spec.ts` "\"Gekocht ✓\", then undo: the Dish goes back where it was, without a Cooking" (l25) | `api/cooking.test.ts` "undo puts the Dish back where it was and removes that Cooking" (l176) | Same rule. Also the browser test that flaked in the serial retry (section 3). |
| `several-boards.spec.ts` "the card's menu moves a Dish to a Column on another Board" (l315) | `api/several-boards.test.ts` "a Dish moved to a Column on another Board goes to its top and keeps its Cooking History" (l122) | Same rule. The detail version (l292) covers the same path from the other screen. |
| `invite-links.spec.ts` "a signed-in user opening the link joins at once, and a reset link stops working" (l57) | `api/invite-links.test.ts` "a reset link stops working, slug or not" (l221); "only the Owner resets the link, and the old one stops working" (l134) | Half overlaps. |
| `usernames.spec.ts` "a user from before Usernames is asked once whether theirs fits, and keeps it with one tap" (l98) | `api/usernames.test.ts` "a user from before Usernames is asked once whether theirs fits: keeping it ends that" (l131) | Same rule. The browser test is the tap, so it stays. |
| `own-photo.spec.ts` "a file that isn't a photo, or is too large, is refused kindly and the dialog stays open" (l93) | `api/own-photo.test.ts` "a file over 10 MB is refused as too large (413), and nothing is stored" (l136); `client/photo-upload.test.ts` (too-large refusal) | Three layers. |
| `image-focus.spec.ts` "a new photo starts in the middle, and a Placeholder has nothing to shift" (l106) | `api/image-focus.test.ts` "a new photo starts in the centre, unless its focus point comes with it" (l94) and "a Placeholder has no focus point" (l106); `client/image-focus.test.ts` | Three layers. The browser test also checks the rendered card. |
| `video-embed.spec.ts` "Pinterest and blog Dishes get no \"Video abspielen\", and their detail is as before" (l97) | `client/video-embed.test.ts` "Pinterest, blogs, other links and Dishes without a Source get no video" (l24) | Same rule. |
| `video-embed.spec.ts` "an Instagram post plays in Instagram's embed, sized as it asks" (l150) | `client/video-embed.test.ts` "an Instagram Reel or post plays in Instagram's embed" (l17) | Same rule for playing. The sizing is a style check. |
| `keyboard-shortcuts.spec.ts` "1 to 9 switch to the Boards in the switcher's order ..." (l105) | `client/shortcuts.test.ts` "1 to 9 switch to the 1st to 9th Board; 0 is nothing" (l19) | Same key rule. The browser test also checks the switcher order, so it stays. |
| `tooltip.spec.ts` "no native title is left, and every icon button says what it does in a Tooltip" (l238) | `client/native-titles.test.ts` "no template in the app gives a native element a title" | Static check and a browser check of the same rule. |
| `topfbert-idle.spec.ts` (3 tests) | `client/topfbert-idle.test.ts` (12 cases, exact loop strings) | Different layers: the browser test checks the page clock and the pause; the client test checks the drawing. Keep both. |

### 4.2 Implementation details rather than what a user sees

- **Frame numbers, angles and durations in client clip tests.** Examples: `client/celebration-clips.test.ts` "the "10×" pebble pops from nothing at f4, overshoots at f18 and rests from f26" (l34); `client/empty-state-clips.test.ts` "the empty Board, %s: four veggies hop out of the pot in turn, 18 of 72 frames apart" (l27); `client/lookup-clips.test.ts` "stirring: the spoon rests at −20° and swings to +20° at half its round" (l38); `client/topfbert-idle.test.ts` (12 cases with exact loop strings). 41 of the 250 client test definitions name a frame, an angle, a duration or a pixel size (title match, [I] for the reading). These cost almost no time: the whole client project takes 0.35 s. The cost is maintenance: every design change edits them.
- **Browser CSS pins.** `skeleton.spec.ts` "at 767px the headline uses the 32px display size" and three more sizes (l16), "motion tokens collapse and fades shorten to 200ms" (l54), and "motion tokens keep their handoff values" (l66, checks `--dur-pop` is 460 ms). `type-scale.spec.ts`: seven tests check computed font family, size and weight (for example `expectOverline` checks 11px and 600, `expectSectionHeading` checks 16px and 600). `user-settings.spec.ts` "picking Dunkel reveals it from the tapped option in 600ms" (l343) and "the theme switches at once with a 200ms cross-fade" (l412). `dish-detail.spec.ts` "at 1024px the detail is a 440px side panel beside the Board" (l71). `input-labels.spec.ts` "every labelled field has its label in the border" (l82, light and dark).
- **Count of style checks.** About 220 lines in `tests/e2e` read computed style, geometry or classes (`toHaveCSS`, `getComputedStyle`, `getPropertyValue`, `boundingBox`, `toHaveClass`). The most are in `board-settings` (31), `user-settings` (18), `type-scale` (12), `image-focus` (12), `several-boards` (11) and `dish-detail` (11). This is a grep count [V]. Not every one is wrong; some check real layout.
- **`affordances.spec.ts`** (11 tests, 129 s median, the largest file) walks every control on a screen and checks its pointer cursor and hover style (helpers `looks` and `rest`, `#206`). This is a style rule. It is valuable as a UX rule, but it is the most expensive way to check it.

### 4.3 Guards against something that can no longer regress

- `api/placeholder-migration.test.ts` "the migration moves every Dish off a removed Placeholder Image, deleted ones too" (l32) and `api/username-migration.test.ts` "the migration gives every user a Username from their Google first name ..." (l38). Each runs a one-time data migration (#132, #209) against a throwaway database. Together they take about 0.3 s. They can only fail again if the migration code changes. Keep them until the migration is retired, then delete the test with it. [I]
- `e2e/installable.spec.ts` "iOS gets its home-screen icon and the browser tab its favicons" (l39). The user's memory notes say the phone target is Android only. The test is cheap (about 1 s). Question for the user, section 7.
- `client/system-clips.test.ts` "no video, poster or Remotion render of these clips is left". It guards against a removed approach coming back. Cheap. Keep.

### 4.4 Tests I would keep as they are

- `e2e/sync.spec.ts` (9 tests, 70 s median for the file). Real behaviour between Members. Slow because the tests wait for the 5-second poll (#225 comment). See CI option B.
- `e2e/achievements.spec.ts`, `cooking.spec.ts`, `drag-and-drop.spec.ts`, `dish-detail.spec.ts` (their flow tests). Real user flows with real data.
- API contract and security tests: `auth-endpoints`, `csp-report`, `rate-limits`, `origin-check`, `response-headers`. Each takes 0.1 to 0.4 s.
- `e2e/error-screen.spec.ts` "an unexpected error stays on its own page: the next page shows no dev error overlay" (l46, #243). Guards the dev-server setting that the browser tests use.
- `e2e/skeleton.spec.ts` "the display and UI fonts load self-hosted, with fallbacks sized to match" (l29, #244). Guards font upgrades.
- `e2e/topfbert-idle.spec.ts` (3 tests, 7 s). Real behaviour: pauses off-screen and stands still with reduced motion.

---

## 5. Recommendations

Nothing is cut until the user decides. Each row that is accepted becomes a ticket. Machine time is the sum of the browser test medians for the rows. Wall time is machine time divided by four shards, which assumes the shards stay balanced (inference: the four shard medians are 4.4 to 4.7 minutes, so they are).

### 5.1 Test by test

| # | Candidate | Action | Duplicate of, or reason | Machine time saved per run | Wall time saved, 4 shards | Risk: what could slip |
|---|---|---|---|---:|---:|---|
| 1 | `addresses.spec.ts` renamed Board forwards (l93) | Delete | `api/addresses.test.ts` l85 | 2.8 s | 0.7 s | Browser redirect not checked. "old addresses forward" (l56) still checks it in a browser. |
| 2 | `addresses.spec.ts` non-Member sees "does not exist" (l158) | Move down | `api/addresses.test.ts` l154 | 3.0 s | 0.8 s | The "not found" page for non-Members. |
| 3 | `board-settings.spec.ts` empty Column goes at once (l173) | Delete | `api/board-settings.test.ts` l116 | 2.5 s | 0.6 s | One browser click on that delete button fewer. |
| 4 | `push-notifications.spec.ts` browser blocks notifications (l93) | Move down | `client/push-switch.test.ts` l114 | 2.2 s | 0.6 s | The sheet text in a real browser. |
| 5 | `email-digest.spec.ts` phone variant (l15) | Merge: keep desktop | `api/email-digest.test.ts` l89 | 6.6 s | 1.7 s | Phone layout of the switch. |
| 6 | `push-notifications.spec.ts` phone variant (l69) | Merge: keep desktop | `client/push-switch.test.ts` l59, `api/push.test.ts` l94 | 4.0 s | 1.0 s | Phone layout of the switch. |
| 7 | `members.spec.ts` remove a Member (l72) and delete the Board (l87) | Delete both | `api/members.test.ts` l86, l173 | 4.8 s | 1.2 s | Two confirm dialogs. The ownership and leave tests still go through the Members list. |
| 8 | `several-boards.spec.ts` card menu moves a Dish to another Board (l315) | Merge into l292 | `api/several-boards.test.ts` l122 | 4.4 s | 1.1 s | The card-menu Board move in a browser. |
| 9 | `image-focus.spec.ts` new photo starts in the middle (l106) | Move down | `api/image-focus.test.ts` l94, l106; `client/image-focus.test.ts` | 7.9 s | 2.0 s | The default centre position in the rendered card. |
| 10 | `video-embed.spec.ts` Pinterest and blogs get no video button (l97) | Move down | `client/video-embed.test.ts` l24 | 5.6 s | 1.4 s | Absence of the button in the rendered page. |
| 11 | `input-labels.spec.ts` dark variant | Merge: keep light | Label placement is the same in both themes [I] | 8.7 s | 2.2 s | A border colour that is wrong only in dark. |
| 12 | `tooltip.spec.ts` no native title left (l238) | Move down to a static check | `client/native-titles.test.ts` | 12.1 s | 3.0 s | Titles set at run time. The static check only reads templates. |
| 13 | `type-scale.spec.ts` (7 tests, computed styles) | Merge to about 3 | Overlapping section-heading checks | about 6 s | 1.5 s | Fewer screens with exact font checks. The kind of drift that #170 found. |
| 14 | `skeleton.spec.ts` four headline sizes (l16) and two motion-token tests (l54, l66) | Move down to a token unit test | The values live in `tokens.json` | about 5 s | 1.2 s | The path from token to computed style for these values. |
| 15 | `user-settings.spec.ts` three "System" tests (l282, l368, l381) | Merge into one | Overlapping states | about 2.4 s | 0.6 s | Little. |
| 16 | `user-settings.spec.ts` timing values (l343 "600ms", l412 "200ms") | Move the values to a unit test | Implementation detail | about 3 s | 0.8 s | An animation timing regression. |
| | **Sum of rows 1 to 16** | | | **about 81 s** | **about 20 s** | About 7 percent of browser test time. |
| 17 | `affordances.spec.ts` (11 tests, 129 s median) | Trim: one control sample per screen; cursor checks as CSS unit tests | Style rules | about 60 s (estimate: half) | about 15 s | A hover or cursor regression on a control that is not sampled. |
| 18 | `sync.spec.ts` poll waits | Keep; test-only shorter poll (CI option B) | Not a duplicate | about 20 s (estimate) | about 5 s | None, if the setting is test-only. |
| 19 | `reduced-motion.spec.ts` achievement test (l125) | Keep; fix the flake | Flaky, not duplicate | 0 s (8 s stays) | 0 s | Red runs. |
| 20 | `api/placeholder-migration.test.ts`, `api/username-migration.test.ts` | Keep; delete with the migrations | One-time migrations | 0.3 s | 0 s | Nothing, until the migration code changes. |
| 21 | `e2e/installable.spec.ts` iOS test (l39) | Ask the user | Phone target is Android (user's notes) | about 1 s | 0 s | iOS home-screen icons. |

Rows 1 to 16 total about 81 seconds of machine time per run (about 7 percent of the roughly 18 minutes). Adding row 17 brings it to about 141 seconds (about 13 percent). Both are estimates from the medians in section 1.3. [V for the medians, I for the totals]

### 5.2 CI level, with no test removed

| Option | Wall time saved per PR run | Machine time change per run | Coverage change | Notes |
|---|---:|---:|---|---|
| A. Eight browser shards instead of four | about 2.2 min (6.8 to about 4.6 min) | about +4 min | none | Shard job: 0.9 min overhead plus 18 min divided by 8 (about 2.3 min) plus about 0.15 min. The floor is the longest serial file (`dish-detail`, 69 s median) plus overhead, about 2.3 min per job [I]. Six shards: about 1.4 min saved. Public-repo concurrency limits are [U]. The project's own CI note says hosted CI is free while the repo is public. |
| B. A test-only shorter poll interval for `sync.spec.ts` | about 5 s | about −20 s | none | Needs a small app change, with the setting read only in test builds. Estimate, because the poll waits are inferred from the #225 comment. |
| C. Browser tests against a production build, as the API tests already do | unknown | unknown | none | Playwright currently starts `pnpm dev`. The dev server compiles on demand (inference). Dev-only behaviour (the overlay of #243) is why the switch needs a measurement first. [U] |
| D. Less fixed overhead per shard | under 0.3 min | none | none | `install-deps` (0.23 min) and `pnpm install` (0.17 min) per shard. Little to gain [I]. |
| E. Keep `retries: 1`, fix the flakes in section 3 | about 0 on average | small | none | Each red run costs a rerun by hand. The achievement test costs a 30-second timeout on each first-try failure. |
| F. Vitest job | none | none | none | Not on the critical path (1.9 min against 5.5). The API setup builds the app in 12.5 s, which does not shorten the PR run. |
| G. Run only the Vitest project you change, locally | developer time | none | none | `pnpm exec vitest run --project client` runs the client cases in well under a second on CI (0.35 s). Not measured locally. |

### 5.3 Ranking, time saved per risk

1. **Option A, eight shards.** About 2 minutes of wall time per PR, no coverage risk. The cost is about 4 more minutes of machine time per run.
2. **Rows 1 to 4 and 5 to 6** (duplicates and single-viewport repeats). About 20 seconds of wall time at four shards, low risk. Each row becomes its own ticket.
3. **Row 18 and option B** (the sync poll). About 5 seconds of wall time, low risk, needs an app change.
4. **Rows 7, 8, 15 and 16.** A few seconds each, low risk.
5. **Rows 9 to 14.** Larger, medium risk: each moves a visual or style check down a layer.
6. **Row 17, trim `affordances`.** About 15 seconds of wall time, medium risk.
7. **Option C, production build for browser tests.** Possibly the largest single change, but unmeasured.

Combined, rows 1 to 16 and option A would bring a PR run from about 6.8 minutes to about 4.5 minutes of wall-clock time. [I]

---

## 6. What I did and did not do

- Did: read the repo's configs and workflow; counted tests with `playwright test --list` and `vitest list`; read CI run data for 150 runs and the logs of 508 browser shard jobs and 147 check jobs; read the closed flaky issues; ran `pnpm test` once locally against the local test database.
- Local database: the admin URL in `.env` points at `localhost:5432`, the local Postgres 17 service. For that run I set `DATABASE_URL` to empty so that nothing could reach the Neon database. Afterwards no `malkochen_test_*` database was left.
- Did not: run the Playwright suite locally (CI already has the timings), change any test or source file, commit, branch or push.

---

## 7. Open points

1. **Production build for browser tests (option C).** Not measured. Needs one run with `pnpm dev` and one with the built server, on the same spec file, to compare.
2. **Shard floor and balance.** I assumed Playwright splits tests by count and keeps a serial group on one shard [I]. Check the Playwright sharding docs before the change. The four shard medians (4.4 to 4.7 minutes) suggest the split is already even.
3. **Public-repo concurrency limit for more shards.** [U]. Check GitHub's current limits before option A.
4. **The achievement flake after #225.** Four runs failed after the `.first()` fix. The root cause is not confirmed.
5. **`addresses.spec.ts` renamed-Board test and `affordances.spec.ts` "your settings and the new Board sheet".** The first failed once, on a retry, and the second failed on both tries in one run. Neither is in a ticket.
6. **iOS.** Is iOS still a target? If not, row 21 goes. The user's notes say Android only.
7. **Affordance rule.** Should every control on every screen keep the hover and cursor rule? That decides row 17.
8. **Local timing.** One local `pnpm test` run, with no separate build timing. A second run and a per-file local timing would show whether the local slowdown (about 157 s local against 36 s CI in Vitest's own report) is the machine or the test database.
9. **Vitest timings.** The per-file Vitest times come from one CI run (38730234206). The step duration is noisy on hosted runners (20 to 55 s over 147 runs).
10. **Counts.** Vitest counts are CI cases (929). `vitest list` shows 649 definitions. Playwright counts are the default project only. No device projects exist, so the phone and desktop variants are loops inside the test files.
11. **Median basis.** Browser medians cover the 42 to 43 hosted runs, and fewer for files added later (`affordances` 23, `video-embed` 4). Medians are per test, from list-reporter durations rounded to 0.1 s.
12. **Queue outliers.** A few runs waited 10 to 20 minutes for a runner. One run waited over 1000 minutes on one shard (run 37374230235, 2026-10-05). Not a test issue, but it inflates run wall-clock figures.
