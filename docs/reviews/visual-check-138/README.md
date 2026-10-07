# Visual check against the design handoff (#138)

Desktop (1440×900) and tablet (1024×768), light and dark, on 2026-10-07, after every visual ticket of #103.

**Compared against:** `docs/design handoff/` (`tokens.json` / `tokens.css` / `tailwind.preset.js`, `components.json`, `interactions.json`, `motion.json`) and the two screenshots in `mockup/`. The handoff's overview pages (`Malkochen Handoff.dc.html`, `Malkochen Desktop Review.dc.html`) aren't in the repo or on this machine, so any screen the JSON doesn't describe could only be checked against the two mockup screenshots.

**Screens checked:** Board (filled, hover, empty), Board switcher, user menu, Add Dish (link step and without a link), Dish detail (photo with Cookings, never cooked, edit mode, Bild wählen), Gekocht toast and pill, search with no results, Board settings, user settings, sign-in, invite, not found, offline. Only a selection of the screenshots is stored here.

**What matches:** every colour, type, radius, shadow, motion and z-index token, except one deliberate change (deviation 9). Lane widths (330 desktop, 340 tablet), the side panel (480 desktop, 440 tablet), sheets as dialogs from 768px with the dialog radius, the 128px card and its type, the 70px FAB with its pebble radius, the input labels (5b), the empty-Column clips per accent, and the Column titles from the mockup.

## Deviations

| # | What differs | Likely reason | Suggestion |
|---|---|---|---|
| 1 | **Source badge doesn't fit the card thumbnail.** On a 330px desktop lane, "Instagram" runs to the edge of the 86px thumbnail and its last letter is cut off (`zoom-instagram-badge.webp`). The handoff lists a **dot-only** badge for the desktop card. | None found. The badge has been the full chip (dot + name) since #6, and nothing in the code shortens it. | Dot-only badge on desktop cards as the handoff says, or let the name end in "…". **Bug, small.** |
| 2 | **Board switcher isn't a pill.** The mockup shows the Board name in a pill: emoji in a round pebble, name in the UI font (600), chevron, on `surface`, with a round `surface` search button beside it. The app shows the name in large display serif with no pill, and the round buttons on `surface-muted` (`zoom-header.webp` vs `mockup/column-titles-ideen.png`). Same on phones. | None found. The header comes from #15 and #108. #121 brought the Column titles back to the mockup but didn't touch the switcher. | Go back to the mockup's pill. Worth a ticket. |
| 3 | **Spacing differs from `tokens.json → space.screen`.** Page gutter is 64px on desktop (token 28) and 40px on tablet (token 20). Lane gap is 16px (token 18) and card gap 12px (token 14). | None found. The gutters look chosen for the wide screen, but no ticket or comment explains them. | Lane and card gaps to the tokens (2px each). For the gutters, decide whether 28/20 looks better or whether the token should change. |
| 4 | **No add-Column lane on desktop, and no keyboard shortcuts.** `tokens.json → breakpoints.desktop` lists "lanes + add-Column lane … keyboard shortcuts". | Spec #1 never asked for either. New Columns are added in Board settings. | Decide whether you want either one. The add lane would be a new ticket; shortcuts would need a list first. |
| 5 | **Empty Board clip sits in a visible box.** The empty-board Topfbert clip bakes in a grey background that doesn't match the butter-tinted lane, so a hard-edged rectangle shows in light and dark (`desktop-*-13-empty-board.webp`). | The clip was rendered with a fixed background in #23, before the lanes were coloured (#122). The empty-Column clips were rebuilt in Vue (#133) and do follow the accent. | Build it in Vue from the layers like #133 (`assets/clips`, `topfbert/layers.json`), or round and mask it to a blob. |
| 6 | **Search "Nichts gefunden" clip sits in a box too.** A rounded box in the board background colour on top of the page gradient. `motion.json` gives it a sky background (`#DCE3F0` / `#1F2530`). | Same as 5: rendered before the page gradient (#122). | Same fix as 5, or at least the sky background from the brief. Low priority. |
| 7 | **Overline section labels ("BOARD", "SPALTEN") are set in Figtree.** `tokens.json → type.overline` uses the **mono** family. | The handoff contradicts itself: its own `tailwind.preset.js` (copied verbatim) gives `overline` no family. | Decide: mono as `tokens.json` says, or keep Figtree. Low priority. |
| 8 | **Gekocht: Topfbert sits in a pill at the top, not behind the toast** (`interactions.json → Gekocht celebration`). | Deliberate: your choice on #105, built in #129. | None. |
| 9 | **`--radius-panel` is the card shape, all four corners rounded**, not the handoff's `30px 26px 0 0`. | Deliberate: your choice on #105, built in #130. | None. |

## Not covered here

- **Motion and interactions** weren't compared frame by frame. The browser tests from their tickets already check them against `interactions.json` / `motion.json`.
- **The offline screen** shows a broken clip in my captures, because the capture blocks the service worker, which is what serves the clip offline. `offline.spec.ts` checks it with the service worker running.
- The dev server's own overlays (Nuxt devtools, the error preview on "not found") only exist in development.
