# Implementation order

The order to implement the open tickets in. When `/implement` is called without a ticket, pick the next ticket from this list.

## Picking the next ticket

1. Go down the list below and take the **first ticket that is still open** (`gh issue view <n> --json state`).
2. Check its blockers (the `## Blocked by` section of the issue). If one is still open, skip to the next ticket on the list and tell the user which ticket you skipped and why.
3. Skip tickets labelled `ready-for-human` (the user's) or `needs-info` (waiting for the user's answer).
4. Implement **one** ticket per session, on its own branch, through a PR.

GitHub is the source of truth. A closed issue counts as done, so this file doesn't need ticking off. Don't close the parent specs (#1, #61, #62, #103, #201) as part of a ticket. Tell the user once all of a spec's tickets are closed.

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

### Phase 6: found after v1 (spec check and production smoke test, 2026-10-03)

| # | Ticket | Note |
|---|---|---|
| #99 | Dish card: "N× gekocht" cut to "1× g…" side by side | A visible bug; changes `DishCard.vue` |
| #98 | Browser test: copy and share the Invite Link | Test only |

### Phase 7: Desktop review 1 (#103)

From the first desktop field test (`docs/reviews/desktop-review1.md`). Two things start at once and run in parallel with everything below: the user's Claude Design delivery (#104) and the prototype the user decides on (#105). Don't close #103 before #121's Column titles have been re-checked in the new font (#136): that's the safeguard the user asked for.

**7a: start now**

| # | Ticket | Note |
|---|---|---|
| #104 | Claude Design: Round 11 assets are in | `ready-for-human`: skip, the user does it. Blocks 7e |
| #105 | Prototype: celebration position, card shape, user menu | Ends with the user's decisions in a comment. Blocks #129–#131 |
| #142 | CI: skip docs-only, shard browser tests, cache, retry once | Speeds up every PR after it |

**7b: fixes on code that stays**

| # | Ticket | Note |
|---|---|---|
| #106 | Toast stays put when the note dialog opens from the detail | |
| #107 | Add Dish: padding, chevron, vegan note examples, faster typing | |
| #108 | Small fixes: cogwheel, switcher emoji, "Besitzer:in", add button, emojis, Board names | |
| #109 | Board settings: Column drag never hangs | |
| #110 | Board with a mouse: min height, drop border, reorder, loops on hover | `BoardScreen.vue` |
| #111 | Motion graphics smooth and sharp, pea starts where it rests | Decides the clip frame rate for #132 and #133 |
| #112 | Splash: landscape version | Remotion |
| #113 | Sign-in copy | |
| #114 | Topfbert's varied phrases | |
| #116 | New Dishes after an absence | Test first |

**7c: Dish titles, lookups and the Creator**

| # | Ticket | Note |
|---|---|---|
| #117 | ALL-CAPS Suggested Titles | Server `title.ts` |
| #115 | Dish card: two lines and a tooltip | Before #118, which adds a line below the title |
| #118 | Creator | New Dish field; blocks #119 and #120 |
| #119 | Instagram from the embed page | ADR 0005 |
| #120 | Pinterest Suggested Title | ADR 0005 |

**7d: Columns and colour**

| # | Ticket | Note |
|---|---|---|
| #121 | Column titles and Column Subtitle (desktop) | Built in the current font; re-checked in #136 |
| #122 | Colour on desktop | After #121: same lane header area |
| #123 | Phone Column title | Reuses #121 |

**7e: images, people and addresses**

| # | Ticket | Note |
|---|---|---|
| #124 | "Eigenes Foto" | Uploads; blocks #125 |
| #125 | Focus point | |
| #126 | Profile picture upload | Same upload rules as #124 |
| #127 | Readable Board and Dish addresses | Migration; blocks #128 |
| #128 | Readable Invite Links | |

**7f: after the prototype decisions (#105)**

| # | Ticket | Note |
|---|---|---|
| #129 | Celebration across Boards, and where it plays | |
| #130 | Card shape everywhere | |
| #131 | User menu | |

**7g: after the Claude Design delivery (#104)**

| # | Ticket | Note |
|---|---|---|
| #132 | 12 Placeholder Images and migration | ADR 0004 |
| #133 | Empty Columns: three illustrations | |
| #134 | "Never cooked" animations | |
| #135 | Topfbert idle | |
| #136 | Fonts, and re-checking the Column titles | The safeguard for #121 |
| #137 | Input labels | After #136 |

**7h: closing**

| # | Ticket | Note |
|---|---|---|
| #138 | Visual check against the handoff | Reports deviations; the user decides |
| #170 | Small fixes: badge, switcher pill, fonts, offline page and more | From #138 and its font check; one PR for all checkboxes |
| #180 | Empty Board and search-empty clips drawn in code | From #138 (5, 6) |
| #181 | Desktop: add-Column lane | From #138 (4) |
| #182 | Desktop keyboard shortcuts | `needs-info`: skip until the user confirms the keys and it's relabelled `ready-for-agent` |
| #139 | Security pass | Last on purpose: blocked by every other ticket of #103. Files findings as new tickets, added here |

English and Italian UI is the next spec, not part of #103.

### Phase 8: security findings (#139)

What the security pass (#139) found, most severe first. Each is its own ticket labelled `security`; the summary is #139's comment. None is critical: every one needs an account on the Allowlist, except #193, which needs a page on another `christried.me` subdomain.

| # | Ticket | Note |
|---|---|---|
| #190 | Source Lookup reaches internal addresses (SSRF) | **High.** `server/source-lookup/http.ts`; the Image Store shares it |
| #191 | Better Auth's update-user; unused auth endpoints off | Medium. `server/utils/auth.ts` |
| #204 | Share to malkochen (Android) | From Phase 9 (#201), pulled forward by the user to come right after #191 |
| #225 | Flaky browser tests: causes and cost of fixing | Pulled forward by the user as urgent: flakes hold up CI. Test-only fixes in its PR; bigger ones become new tickets, added here |
| #228 | Browser tests: CI's retry of a serial spec file starts clean | From #225. Test only; makes CI's one retry actually rescue a flake |
| #227 | The app can reopen the Board just left, not the one opened last | From #225. App change (polling vs. opening); reproduce first |
| #197 | Undoing a Cooking deletes any Cooking for good | Low. `undoCooking`; the app doesn't change |
| #193 | Refuse /api writes from other origins | Low. A middleware next to `server/middleware/auth.ts` |
| #194 | Found images checked by content and re-encoded | Low. Reuses `server/image-store/photo.ts` |
| #196 | Rate limits; Better Auth limiter in the database | Low. Migration |
| #195 | Image Store cleanup | Decided: deleted things stay restorable for 30 days. New env var `CRON_SECRET`. Blocks #220 |
| #198 | Dependency updates from `pnpm audit` | Low. Dev and build tooling only. Before #192, whose CSP depends on what Nuxt inlines |
| #192 | Response headers (CSP, framing) and no-store | Low. CSP report-only first |

### Phase 9: desktop review 2 (#201)

Everything from the second desktop review (`docs/reviews/desktop-review2.md`), after Phase 8. #204 already sits in Phase 8. The bundles collect small fixes so CI runs once per bundle. Each ticket says whether it is for desktop, phone or both.

| # | Ticket | Note |
|---|---|---|
| #205 | Bundle A: copy and labels | Carries the open "Gleich" question; check each point against main first |
| #206 | Bundle B: affordances | Brings the Tooltip used by #212 and #213 |
| #207 | Bundle C: dialogs and scroll | Escape on the settings pages; before #210 |
| #208 | Scroll indicators for cut-off Columns (desktop) | Touches the Board's horizontal scroller, like #207's scrollbars: after it |
| #209 | Usernames | Blocked by #191. Migration |
| #210 | User settings as a sheet | After #207 and #209 |
| #211 | Board Dish count | Header and switcher |
| #212 | Note on hover / tap | After #206 |
| #213 | User popover | After #206 and #209 |
| #214 | All-caps Suggested Titles | Source Lookup title rule |
| #215 | Smooth motion 1: celebrations | Sets the SVG pattern for #216 and #217 |
| #216 | Smooth motion 2: splash and link lookup | After #215 |
| #217 | Smooth motion 3: remaining clips and the pea | After #215 |
| #218 | Move or delete several Dishes at once | Server endpoint for several Dishes |
| #219 | Push notifications | After #210. New env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; migration |
| #220 | Daily email digest | After #219 and #195. New env var `RESEND_API_KEY`; the user verifies the sending domain first |
| #221 | Click-to-play video embeds | After #192 (CSP) |

## Keeping this file current

When new tickets are created (for example by `/to-tickets`), add them here in the right place, or tell the user they aren't listed yet. A ticket that is open but missing from this list should be raised with the user, not picked up silently.
