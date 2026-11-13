# Handoff: make the Shopping List hold up against the R15 design handoff

For a local Claude Code session. Paste this as the first message, or point the session at this file. It lives on the PR branch only so the session can read it: **delete it in the last commit before the merge.**

## Where things stand

- Spec #526 (Shopping List) is implemented on branch `claude/sweet-fermi-eaopnf`, PR christried/malkochen#541 into `staging`. CI was green on the code; the last commit adds only docs.
- The API (#530 to #533) and the Board module (#534) are done and tested, and they don't depend on the design. Leave them alone unless a design change below needs a module change.
- The screens (#536, #537) were built **before** the R15 handoff existed, from the R14 (Week Plan) patterns. The handoff is now committed (3af0fcb): `docs/design handoff/README.md` section 11, `components.json` (ShoppingList, ShoppingGroup, ShoppingItem, ShoppingItemInput, IngredientPicker, EmptyShoppingList, plus `r15` notes on ViewSwitch, WeekHeader, Toast, BottomSheet, Button, RecipeSection), `interactions.json` (Tick, Untick and rise, Delete with undo, Clear ticked with undo, Type items in a row, Change a line, Put a Dish on, Put a week on, Switch to the list), tokens (search "R15"), `assets/r15-keyframes.css`, `assets/topfbert/layers.json → shoppingEmpty`. The overview to compare against is `docs/design handoff/overviews/R15 Shopping List (standalone).html`; section 09 of it holds every new string.
- The Operator has OKed the Datenschutz wording. Nothing else blocks the merge except this design pass.

## The job

Bring #536 and #537 in line with the handoff, phone (360) and desktop (1280), light and dark, motion and reduced motion. Work on the same branch, one commit per ticket (`… (#536)`, `… (#537)`), push, and keep CI green. Don't merge: the Operator merges.

Start by reading `docs/design handoff/README.md` section 11 and the six R15 components in `components.json`, then open the overview HTML. How R14 was brought in is the model: commit 0173723 (tokens and keyframes into the app), then 390f01a and 7b014cd (the screens).

## The gaps, as far as I found them

Each is "the handoff says" → "the code does now". Check each one against the handoff yourself. This list is a starting point, not a complete one.

### Tokens and keyframes (do first)
- R15 tokens are not in the app yet: `color.derived.tick`, `tick-ink`, `strike`, `swipe-danger` (light and dark), `size.shop*`, `layout.shopping`, `motion.sink-hold`, `z.shop-field`. Add them where R14's went (`app/assets/css/main.css`, `tailwind.preset.cjs`), additions only.
- `r15-keyframes.css` (r15-check, r15-press, r15-strike, r15-grow, r15-arrive, r15-collapse, r15-swipe-out, r15-squash, r15-wash, r15-pop-up, r15-popout): bring in what the screens use, the way `r13`/`r14` keyframes were.

### ViewSwitch (`app/components/ViewSwitch.vue`, `BoardSkeleton.vue`)
- Phone: the whole 328px row, segments 109 (now 318px). Desktop 348 × 44 (done).
- The "Einkauf" icon is a **bag** (now a cart).
- If a locale overflows a segment, the icons hide first.

### ShoppingList (`app/components/ShoppingList.vue`)
- Phone header 48: title (Petrona 500 23) and "Erledigte entfernen" as a secondary 40 button with a trash icon, **absent** when nothing is ticked (now shown disabled).
- Phone has **no permanent field** on top. The **FAB stays** in Einkauf as "Eintrag hinzufügen" and opens an add bar docked on the keyboard (ShoppingItemInput phone variant: "Neu in Sonstiges", "Was fehlt noch?", enterkeyhint next, Enter adds and keeps focus). Now the FAB is hidden outside the Columns (`BoardScreen.vue`, `v-show="… && inColumns"`) and a field sits at the top.
- Desktop: a 360px Sonstiges column with the add field at its end ("n" focuses it, "↵" hint), and two masonry columns for the Dish groups (each new group goes into the shorter column), gutter 28, gap 18. Now it's one centred 760px column.
- Groups stagger in 40ms on switching to the view; bottom padding 130 for the FAB.
- A polite live region: "2 Karotten erledigt.", "… wieder offen.", "… hinzugefügt.", "Eintrag entfernt.".

### ShoppingGroup
- Dish heading: thumb 44 (radius 15 13 16 14), title Petrona 500 18 on two lines, chevron. The whole heading links to the detail, with the card-to-detail morph (the group image is the shared element; see how WeekPlan's `onItemClick` uses `morphOpen`).
- A Dish put on twice keeps **one** group, with the caption "Zweimal auf der Liste" / "Dreimal …" / "{n}-mal …". The data allows this: count how many times a Dish was put on. That needs a field the API doesn't send yet. One way: send each item's put-on batch, or count how often each Ingredient line repeats. Decide, and keep it small.
- A gone Dish: title plus "Nicht mehr auf dem Board", no image, no chevron, not a link (now title only, no caption).
- Each group is a `ul` labelled by its heading.

### ShoppingItem
- Row min 56 on phone (50 on desktop), text 500 17/24 (16/22), separators from x 50.
- Checkbox: a 28px pebble (`radius.blob`), ticked fill `color.derived.tick` with a `tick-ink` check; the strike is 1.5px currentColor at 56% (`color.derived.strike`).
- **Tick motion:** pop, check draw, strike, then a **600ms hold** before the line sinks (`motion.sink-hold`), keeping the hold under reduced motion. Untick returns the line to its Recipe place (the module already sorts open lines by list order, so this should hold).
- Phone: **long-press 450ms** edits, **swipe left** deletes (over `swipe-danger` with trash and "Entfernen"). Desktop: pencil and trash appear on hover and focus (34px circles, trash in danger). Now both are always-visible icon buttons.
- Keys on desktop: Space ticks, Enter edits, Delete removes, ↑/↓ moves focus.
- Label: "{Text}, {Gruppe}, erledigt / nicht erledigt"; accessibility actions Ändern, Entfernen.
- Edit (ShoppingItemInput edit variant): "Eintrag ändern", text selected, a 38px danger delete button inside, "Fertig" or blur saves, Escape cancels. **An empty text deletes the line** with the delete toast (now an empty text is ignored).

### EmptyShoppingList
- "Noch nichts zu kaufen.", "So kommt etwas auf die Liste:", three rows with 36px icon circles ("Im Gericht holst du seine Zutaten dazu.", "Im Wochenplan kommt die ganze Woche auf einmal.", "Oder du schreibst selbst etwas auf."), a primary 44 button "Etwas aufschreiben" (opens the add bar).
- Topfbert **wink** from `layers.json → shoppingEmpty` (it reuses the R12 wink pose; see how `TopfbertIdle` takes a mood). Now it's the pointing pose and different copy.
- Desktop: 520 wide, centred 40px under the header, shadow.dialog, with the add field focused instead of the button.

### "Auf die Einkaufsliste" and IngredientPicker (#537)
- Placement: a secondary full-width 48 button with a bag-plus icon that **closes the Zutaten card** in view mode (`RecipeSection.vue`), only with at least one line. Now it sits under the share row in `DishDetailView.vue`.
- Picker header: thumb 46, "Auf die Einkaufsliste" (Petrona 500 22), the Dish title on one line, and a close button. Hint "Nimm raus, was du schon zu Hause hast." (now "Was brauchst du?" and "Nimm raus, was ihr schon da habt.").
- Rows: 26px pebble toggle, min 50 (46 desktop), rising 14px with a 40ms stagger (max 8).
- Confirm: primary 54, "{n} Zutaten hinzufügen" / "1 Zutat hinzufügen", and at 0 **"Keine Zutat ausgewählt"** disabled at 35%. `tests/e2e/shopping-list.spec.ts` asserts "0 Zutaten hinzufügen" now, so update it.
- Desktop: a 400px popover rising from the button (origin bottom).
- The toast after it **offers Rückgängig** (5s). The module's `putDishOn` result has no `undo` yet. Add one in `app/board/shopping-list.ts` that deletes those items (a delete write per item, or a small bulk endpoint: your call; mind the API tests).

### "Woche auf die Einkaufsliste" (#537, `WeekPlan.vue`)
- Phone: a ghost button as a second 36px line under the week title (the day list starts at 90 instead of 54). Desktop: a secondary pill 40 **before "Heute" and the arrows**. Now it's a pill below the header on both.
- Its toast "{n} Gerichte auf der Einkaufsliste." **offers Rückgängig**; "Alles schon auf der Einkaufsliste." has no action (3s). Undo deletes the items the answer returned.
- Squash on press and a day pulse (interaction "Put a week on").

### Strings
- All three languages. German from the handoff (section 09 of the overview); write English and Italian in the app's tone. Check `app/strings/{de,en,it}.ts` → `shopping`. The Datenschutz mentions "Clear done" (en) and "Rimuovi completate" (it): if those button names change, change the Datenschutz wording too, and tell the Operator.

## Where the handoff differs from the spec: decide, then note it on #526

#527's acceptance asks for these to be noted on #526. Ask the user about the first one before building it.

1. **Week, a Dish planned twice:** the handoff puts it on twice. The spec (story 18) and the server (`putWeekOn`, with an API test) put it on once. Keep the spec unless the user says otherwise.
2. Toasts after putting a Dish or a week on offer Rückgängig (the spec only asked for one after delete and clear).
3. "Erledigte entfernen" is hidden, not disabled, when nothing is ticked.
4. Saving an empty text deletes the line.
5. Phone typing goes through the FAB and an add bar, not a field on top; desktop gets three columns.
6. "Auf die Einkaufsliste" closes the Zutaten card instead of sitting in the share row.

## How to check it

- Run the app (`pnpm dev`) and put screenshots next to the overview's frames: phone 360 and desktop 1280, light and dark, for the list with content, the empty list, ticked lines, editing, the picker, the week button and the toasts. Use reduced motion for the stills.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm vitest run --project client`, `pnpm test:e2e tests/e2e/shopping-list.spec.ts tests/e2e/week-plan.spec.ts tests/e2e/skeleton.spec.ts tests/e2e/dish-detail.spec.ts tests/e2e/recipe.spec.ts`. Add browser tests for what's new: the FAB add bar on a phone, swipe and long-press, and Rückgängig after a put-on.
- Keep `docs/agents/implementation-order.md` as it is; #527 is the user's ticket to close.
- When done, update PR #541's body ("No design handoff yet" goes, and list the decisions taken) and tell the user it's ready to merge.
