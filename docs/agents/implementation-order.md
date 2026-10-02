# Implementation order

The order to implement the open tickets in. When `/implement` is called without a ticket, pick the next ticket from this list.

## Picking the next ticket

1. Go down the list below and take the **first ticket that is still open** (`gh issue view <n> --json state`).
2. Check its blockers (the `## Blocked by` section of the issue). If one is still open, skip to the next ticket on the list and tell the user which ticket you skipped and why.
3. Skip tickets labelled `ready-for-human`. Those are the user's.
4. Implement **one** ticket per session, on its own branch, through a PR.

GitHub is the source of truth. A closed issue counts as done, so this file doesn't need ticking off. Don't close the parent specs (#1, #61, #62) as part of a ticket. Tell the user once all of a spec's tickets are closed.

## Why this order and not just the blocking edges

The `Blocked by` edges only track dependencies **within** one spec. The polish tickets from #1 (#53–#58) have no blockers, but they edit the files the refactors from #61 and #62 rewrite:

- #58 and #54 change `AddDishSheet.vue`, and #72 pulls the link lookup out of it.
- #55 and #56 change the Dish detail (`[dishId].vue`, `DishDetailView`), and #70 and #73 restructure it.
- #53 changes how the Board page loads, and #64–#69 rewrite that page's state.

So the refactors come first and the polish goes onto code that no longer changes. Don't pull a polish ticket forward because it looks unblocked.

## The list

### Phase 0: independent, any time

| # | Ticket | Note |
|---|---|---|
| #60 | Record ADRs for v1's deliberate deviations | Docs only; creates `docs/adr/` |
| #71 | Store a found image in one place (server) | Server only |
| #57 | Theme reveal when changing Darstellung | Touches only `ThemePicker` / `useTheme` |
| #59 | Device check: "Original öffnen" | `ready-for-human`: skip, the user does it |
| #81 | Flaky browser test: dark-theme card | Test only (`add-dish.spec.ts`). Before Phase 5, so its browser runs can be trusted |

### Phase 1: client Board module foundation (#61)

| # | Ticket | Note |
|---|---|---|
| #63 | Shared placement and Gekocht rules | Needed by #66 and #68 |
| #64 | Module skeleton, client test project, delete/restore a Dish | Creates the "client" Vitest project |

### Phase 2: link lookup (#62)

| # | Ticket | Note |
|---|---|---|
| #72 | Link lookup module, used by Add Dish | Reuses the client test project from #64 |
| #73 | "Bild neu laden" uses the link lookup module | |

### Phase 3: operations into the module (#61)

| # | Ticket | Note |
|---|---|---|
| #66 | Move, cook and undo a Cooking | Biggest; unblocks #67 |
| #65 | Delete and restore a Cooking | |
| #68 | Add, edit and Cooking note | |
| #67 | Move a Dish to another Board | |

### Phase 4: wrap-up (#61)

| # | Ticket | Note |
|---|---|---|
| #70 | Dish detail through the injected module | |
| #69 | Polling and merge inside the module | Last on purpose: riskiest merge, relies on every rollback finding its target by id |

### Phase 5: polish on settled code (#1)

| # | Ticket | Note |
|---|---|---|
| #58 | Button loading dots, link field loading/valid states | Reads the link lookup module's status |
| #54 | Add Dish: Suggested Title types in | |
| #56 | Dish detail: edit mode morph | |
| #55 | Dish detail: scroll parallax and compact top bar | |
| #53 | Board loading state: skeleton shimmer | |

## Keeping this file current

When new tickets are created (for example by `/to-tickets`), add them here in the right place, or tell the user they aren't listed yet. A ticket that is open but missing from this list should be raised with the user, not picked up silently.
