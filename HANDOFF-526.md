# Handoff: Spec #526 Shopping List (delete this file before the PR)

Branch: `claude/sweet-fermi-eaopnf` (the only branch this session may push to). Started from `staging` at 43909d7.

## The ask

The user: "Implement the Spec for the shopping list fully, go through the github actions for it. Implement like its convention in the project already." Plus: keep going after usage limits lift.

## Plan (follows how spec #511 Week Plan landed, PR christried/malkochen#522)

- One spec PR into `staging`, a commit per ticket (`<what> (#n)`), PR body like #522: Summary (file tree), Evidence (tests per layer), Merge Danger (Door / Blast Radius), then `Closes #526, closes #530, … closes #538`.
- Don't merge: #530 needs the Operator's OK on the Datenschutz wording before merge, and the screens are built without the design handoff (see below). Get CI green, then hand it to the user.
- Tickets, in order: #530 → #531 → #532 → #533 (API) → #534 (Board module) → #536 → #537 (screens) → #538 (Changelog, 3 files, `pnpm vitest run tests/client/changelog.test.ts`). #527 (Claude Design handoff) is `ready-for-human` and NOT in the repo yet (`docs/design handoff/` has no R15). Decision taken: build #536/#537 from R14 (Week Plan) patterns (ViewSwitch, toasts, sheets/popovers, WeekHeader) and say so in the PR, so the user can restyle once the handoff lands.
- Ticket bodies: `gh api repos/christried/malkochen/issues/<n> --jq .body` (or GitHub MCP `issue_read`). Spec: #526.

## Local setup (cloud container)

- `service postgresql start` then (first time) `su postgres -c "psql -c \"alter user postgres password 'postgres'\""`.
- `.env` copied from `.env.example` with `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres` (gitignored).
- `.nuxtrc` (excluded via `.git/info/exclude`, never commit) switches off @nuxt/fonts providers: the network blocks fonts.google.com, which breaks `nuxt build`. Contents: `fonts.providers.{google,googleicons,bunny,fontshare,fontsource,adobe}=false`, one per line.
- Run one API file: `pnpm vitest run --project api tests/api/week-plan.test.ts` (builds the app, ~1 min). Client tests: `--project client`. Node 22 here (CI uses 24), fine.
- Migration generated with `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm db:generate --name shopping_item`.

## Progress log

- Commit 48a304b: #530–#533 API done (`server/utils/shopping-list.ts`, endpoints under `server/api/boards/[id]/shopping-items/` and `server/api/shopping-items/`, `shared/shopping-list.ts`, events, admin strings, Datenschutz in `app/legal/datenschutz.ts` (EN "Clear done", IT "Rimuovi completate" — keep the UI button names in step), cleanup). `tests/api/shopping-list.test.ts` 40 tests green; full `pnpm test` green (2311).
- Next commit: #534 Board module (`app/board/shopping-list.ts` = createShoppingList, groupsOf, placeItem; Unsent kinds shopAdd/shopText/shopTick/shopDelete/shopClear/shopRestore/shopDish/shopWeek in `unsent-changes.ts`, 404 on item writes dropped quietly via goesQuietly; transport; fake server in `tests/client/memory-transport.ts`; `tests/client/shopping-list.test.ts` 31 tests). Client project green (896).
- #536/#537 written (uncommitted until the nearby e2e specs pass): `ViewSwitch.vue` 3 segments ('shopping'), `useBoardView.ts`, `ShoppingList.vue`, `IngredientPicker.vue`, `useShoppingResult.ts`, `BoardScreen.vue` (inColumns/inShopping), `BoardSkeleton.vue` switch width 318px, `DishDetailView.vue` + `pages/b/[board]/[dish].vue` ("Auf die Einkaufsliste"), `WeekPlan.vue` ("Woche auf die Einkaufsliste" button under the header, hidden on past weeks), strings `shopping` block in de/en/it. `tests/e2e/shopping-list.spec.ts` 6 tests green locally (ALLOWLISTED[250]). Run e2e: `pnpm test:e2e tests/e2e/<file> --trace off`.
- #538 Changelog written under [Unreleased] in all three files (Added + Changed for the Datenschutz), changelog test green.
- Then: commit, remove this file, open the PR into staging (body like PR #522), watch CI, fix until green. Tell the user: Datenschutz wording needs the Operator's OK; screens built without the #527 handoff.

## Done first (WIP commit)

- `server/db/schema.ts`: `shoppingItem` table (id device-made, board_id cascade, text, dish_id no FK, dish_title, group_at, position, ticked, added_by set null, added_at, deleted_at soft delete).
- `server/db/migrations/0052_shopping_item.sql` (+ snapshot, journal) with a `board_version` trigger using `board_version_by_board_id()`.

## Design decided for the server (`server/utils/shopping-list.ts`, mirror `server/utils/week-plan.ts`)

- View in the Board load (`BoardView.shoppingItems`, add in `server/utils/boards.ts` getBoard next to `plannedDishes`; also add `shoppingItems: []` to client test fixtures and `kept-boards.ts` withPlan-style default):
  `{ id, text, ticked, dishId: string|null, dishTitle: string|null, dishOnBoard: boolean }`; dishTitle = current `dish.title` if the Dish is on the Board and not archived (left join on dish.board_id = item.board_id and dish.deleted_at is null) else stored title. Order: `group_at asc nulls first, dish_id, position, added_at, id`, live rows only (`deleted_at is null`).
- Limits in a new `shared/shopping-list.ts`: 200 characters, 500 live items. Over → 409 "Shopping List full". Text trimmed, 1..200, else 400.
- Access: `isMember(boardId, userId)` from `board-access.ts` (Members, Owner, Operator; no Permission). Item routes: find the item's Board (live item), 404 `shoppingItemNotFound()` (add to `server/utils/session.ts` with `shoppingItemIdParam`).
- Endpoints:
  - `POST /api/boards/:id/shopping-items` `{ id, text, madeAt? }` → 201, appended to "Sonstiges". writeOnce with `shoppingItemIdStanding` (repeat = same id, same Board, same adder; else taken 409).
  - `PATCH /api/shopping-items/:id` `{ text } | { ticked }` (exactly one) `+ madeAt?` → 200. Same value: no event, no Version move.
  - `DELETE /api/shopping-items/:id` → 204 (soft delete). Gone → 404.
  - `POST /api/boards/:id/shopping-items/clear` → `{ ids }` of the ticked items cleared (all ticked at arrival).
  - `POST /api/boards/:id/shopping-items/restore` `{ ids }` → restored items; refused whole over 500.
  - `POST /api/boards/:id/shopping-items/dish` `{ dishId, items: [{ id, text }], madeAt? }` (#531) → 201 items. Dish on Board, not archived, with Ingredients (`cardinality(recipe_ingredients) > 0`) else 404 / 400. Appends at the group's end; group_at = existing group's, else now(); refresh dish_title on the group's items (separate statement in runAtomic: data-modifying CTEs can't nest inside withEvents' `changed`). Repeat: first item id exists, same adder and Dish.
  - `POST /api/boards/:id/shopping-items/week` `{ week: Monday 'YYYY-MM-DD', madeAt? }` (#532) → `{ dishes, items }`. today = Berlin date of `madeAtOrNow(madeAt)` (lets tests check midnight in Berlin with a past madeAt); days from max(today, Monday) to Sunday; past week (Sunday < today) 400. Dishes planned in range (planned_dish join dish, live, with Ingredients, no live group yet), each once, ordered by first day/position; group_at = now() + rank µs; lines via `unnest(recipe_ingredients) with ordinality`. Over 500 → 409 whole. Not a Monday → 400.
- Events (`shared/event-kinds.ts`, `shared/admin.ts` new group `shoppingList`, labels in `app/strings/{de,en,it}.ts` admin `eventGroups` / `eventKinds`; event helper in `server/utils/events.ts` + EventDetails): `shopping_item_added`, `shopping_item_changed`, `shopping_item_ticked`, `shopping_item_unticked`, `shopping_item_deleted`, `shopping_items_cleared` (once, `{ items: n }`), `shopping_items_restored` (once, `{ items: n }`), `dish_put_on_shopping_list` (once, dish id, `{ items: n }`), `week_put_on_shopping_list` (once, `{ week, dishes }`). Single-item details `{ shoppingItem: id }`. No Dish History, push, digest or "Neues im Verlauf".
- Cleanup: purge soft-deleted shopping items after a day in `server/utils/cleanup.ts` (check `tests/api/cleanup.test.ts` for report shape).
- Datenschutz: find the section on what Members store (grep `Datenschutz`/privacy in `app/strings` or pages) and name the Week Plan and the Shopping List in de/en/it.

## Late changes (#533), client (#534), screens (#536, #537)

- Late: tick/untick/text last-to-arrive wins (natural); vanished item → 404 dropped silently on the client; put-on of a gone Dish → 404 "Dish not found", told; week collects at arrival; repeats via writeOnce. Tests next to `tests/api/week-plan.test.ts` late-change section (`madeAt`).
- Client: follow commit bb3df23 (Week Plan in the Board module): `app/board/board-module.ts` (transport methods, optimistic writes via a `shoppingWrite` like `planWrite`, `merge()` must handle `shoppingItems`), `app/board/http-transport.ts`, `app/board/unsent-changes.ts` (new kinds + `apply()` + silent drop for 404 on item writes), `app/board/kept-boards.ts`, `tests/client/memory-transport.ts`, tests in `tests/client/shopping-list.test.ts`. Expose groups: Sonstiges first, Dish groups in order, open lines first then ticked; `ingredientsToPutOn(dishId)`.
- Screens: follow commits 390f01a / 7b014cd (WeekPlan.vue, ViewSwitch, BoardScreen, DayPicker sheet/popover, toasts). E2E in `tests/e2e/shopping-list.spec.ts`; check `tests/e2e/shards.ts` for how a new spec file is sharded.
- API test users: pick unused `ALLOWLISTED` indexes (week-plan uses 245–249); append new emails to `tests/support/test-auth-env.ts` if needed.
