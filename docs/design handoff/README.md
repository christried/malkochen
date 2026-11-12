# malkochen · Implementation handoff (Nuxt + Vue + Tailwind, Remotion)

Overview page: `../Malkochen Handoff.dc.html` (renders everything below).

Where things are in this repo: this folder holds the whole handoff, every round from R4 on. Each round's "Overview page" below is in `docs/design process files/`, with the other editable design files, which expect this folder next to them as `handoff/`. The offline overviews of R13 and R14 are in `overviews/`.


## 1 · Design tokens
- `tokens.json`: source of truth. Colours for light and dark (bg, surface, surface-muted, text, text-muted, line, line-strong, inverse, on-inverse, danger, glass, scrim, focus, plus Column/accent hues). Also includes fonts, type scale `[family, size, line-height, weight, tracking, (style)]`, spacing, pebble radii, shadows, motion tokens, z-index and breakpoints.
- `tokens.css`: CSS custom properties. `:root` is light, `[data-theme="dark"]` and `prefers-color-scheme` are dark.
- `tailwind.preset.js`: `presets: [require('./handoff/tailwind.preset.js')]`, and import `tokens.css` in `app.vue`. Utilities map to the variables, so dark mode needs no `dark:` variants.
- Fonts (R11): Petrona (display) and Figtree (UI), both variable with italics, self-hosted (`@nuxt/fonts` or fontsource). Previously Newsreader + Hanken Grotesk.

## 2 · Components: `components.json`
There are 14 components. Each lists its variants, states, UI motion (with a token per state) and the tokens it uses. Build the UI motion with Vue `<Transition>` / `<TransitionGroup>` and CSS variables from `tokens.css`. Use `@vueuse/motion` only for springs.

## 3 · Interactions: `interactions.json`
Covers drag lift, drop target, the Gekocht celebration and toast, swiping between Columns, the card → detail morph (View Transitions API, with a FLIP fallback) and sheet open/close. Each one includes a millisecond timeline, haptics and reduced-motion behaviour.

## 4 · Motion graphics: `REMOTION.md` / `remotion-briefs.json`
There are 36 entries (R11): 12 placeholders, the state, system and celebration clips (now with 3 empty-Column clips and 3 never-cooked scenes), `topfbert-idle` (Vue) and the entries marked **needs transparency**. Of those 4, `gekocht-topfbert` should be built in Vue; the 3 particle effects are Vue only and are not videos. Every other clip bakes in a solid background and ships as `<id>-light.mp4` and `<id>-dark.mp4`, 30 fps, with a seamless loop where marked. The poster is the reduced-motion still.

## 5 · Breakpoints: `tokens.json → breakpoints`
- **< 768px:** phone. One Column at a time, swipe between them, pebble tabs, bottom sheets and a full-screen detail view.
- **768–1199px:** tablet. Kanban lanes (340px, scroll-snap), a 440px side panel, and sheets become dialogs.
- **≥ 1200px:** desktop. Lanes plus an add lane, a 480px side panel, hover and keyboard shortcuts.
- Gate hover and mouse drag on `pointer: fine`, not on width.

## 6 · Assets: `assets/`
- `illustrations/<dish>/`: 12 dishes (R11). `<dish>-light.svg` / `<dish>-dark.svg` hold the still (frame 0). `layers/{light,dark}/NN-<part>.svg` are full-canvas layers in a shared 120×120 viewBox, and `NN` = z-order. `layers.json` lists the order, which parts animate, and the loop spec and pivot for each.
- `topfbert/`: the mascot in 5 moods (happy, stir, oops, wow, sleep) plus 3 Tour poses (waving, pointing, wink; R12). Each mood has a full SVG and numbered layers (hat, eyes, mouth, steam, spoon, …). Motion per layer is in `layers.json`.
- `veggies/`, `characters/pea.svg`, `shapes/`: supporting pieces used by the clips and particles (pebble, burst, plate, bowl outline, magnifier, "Gleich!" sign, wifi).
- `icon/`: `manifest.webmanifest` plus `icon-192/512.png` (any) and `icon-maskable-192/512.png` (80% safe zone). Also `apple-touch-icon-180.png`, `favicon-16/32/48.png`, `icon.svg`, `icon-monochrome.svg` and `icon-layers/` for the splash clip. Copy the PNGs and SVGs to `public/icons/`.

Legacy: `svg/{light,dark}/*.svg` and `illustrations.json` come from R4. They are identical to the `assets/illustrations/*` stills.

## 7 · R11: Desktop review 1 (new assets)
Overview page: `../Malkochen Desktop Review.dc.html`. Everything is vegan and neutral (any cooking group). Copy the whole `handoff/` folder into `docs/design handoff/`; new files sit next to the existing ones.

**Placeholders: 16 → 12**
- New drawings: `assets/illustrations/pasta/`, `bowl/` (Salat / Bowl, replaces Buddha Bowl + Salat), `breakfast/` (Frühstück). Each: `<key>-light.svg` / `<key>-dark.svg` (still = frame 0), `layers/{light,dark}/NN-<part>.svg`, `layers.json`.
- Removed: curry, salad, pizza, porridge, wrap (folders and legacy `svg/` files deleted). `illustrations.json → migration` remaps stored keys: curry/salad → bowl, pizza → bread, porridge → breakfast, wrap → tacos.
- `illustrations.json`: 12 dishes; the new three carry `keywords` for auto-pick. `mixNote` explains the colour-mix rule (near-neutral colours have no hue, as in the browser).

**The cast**
- `assets/characters/knobi.svg` (garlic bulb) and `schoti.svg` (chili), plus layered parts in `characters/{pea,knobi,schoti}/NN-<part>.svg` and `characters/layers.json` (colours, outline, idle motion). Characters are theme-independent, like Topfbert.

**Clips** (`assets/clips/<id>/`: stills = frame 0, light/dark, layers + `layers.json` with ids, loops and pivots)
- `empty-column` (pea rolls, fixed: now starts centred, no snap), `empty-column-knobi` (rocks in the bowl), `empty-column-schoti` (hops on the rim). Cast by Column position: 1 pea, 2 Knobi, 3 Schoti, repeat. Background + blob follow the Column accent; stills per accent as `<id>-<accent>-<theme>.svg`.
- `never-cooked-hut`, `never-cooked-sprung`, `never-cooked-dampf` replace `never-cooked`. Pick per Dish: `[hut, sprung, dampf][hash(dishId) % 3]`.
- Briefs in `remotion-briefs.json` / `REMOTION.md` (entries marked `r11`). All are pure transform/opacity loops, so building them in Vue from the layers is an equal option.

**Topfbert idle**
- `assets/topfbert/topfbert-eyes_closed.svg` (new layer) and `topfbert/layers.json → idle`: 6 s loop (breathe, steam, hat sway, blink + double blink), per-mood rules, below 48 px only breathe + blink, reduced motion = frame 0, shared clock.

**Motion source**
- `assets/r11-keyframes.css`: every `r11-*` keyframe used above. `data-loop` in the SVGs names the keyframe, duration, easing and delay; `data-pivot` is the transform origin in viewBox units; an inline style on an animated element is its frame-0 state.

**Type + inputs**
- `tokens.json` / `tokens.css` / `tailwind.preset.js`: fonts → Petrona + Figtree (display and title weights 500); new `field` tokens and `--field-*` variables.
- `components.json → Input`: label style 5b (legend in the border, built as a notched `fieldset` so it works on any background), exact padding (52 = 2 + 13 + 20 + 15 + 2, 1 px optical lift), select chevron, textarea, button row, states. 5a and 5c are listed as alternatives.

## 8 · R12: Tour poses (Rundgang)
Overview page: `../Malkochen Tour Poses.dc.html`. Copy the new files into `docs/design handoff/` next to the existing ones; nothing existing changes except `layers.json` (additions only).

**Three new poses** (`assets/topfbert/`, viewBox `0 -20 140 150`, same parts and colours as the moods, one drawing for light and dark)
- `topfbert-waving.svg` + `topfbert-waving-01…11-*.svg`: first bubble ("Hallo, ich bin Topfbert!"). Right handle raised as an arm (`arm`, in front of the rim), open smile with tongue.
- `topfbert-pointing.svg` + `topfbert-pointing-01…09-*.svg`: every step with a target. Drawn pointing right with a 2° lean baked into each layer; eyes and mouth look towards the target. No steam, lettering or one-sided light, so `transform: scaleX(-1)` on the whole element points it left. Its `eyes_closed` is shifted with the eyes.
- `topfbert-wink.svg` + `topfbert-wink-01…11-*.svg`: last bubble (the share tip). `eyes` / `eyes_closed` hold the left eye only; `wink` is the static closed right eye. Hat sits straighter, 3 px up.
- The full SVGs are frame 0 (the reduced-motion still). Layer groups carry `data-loop` (full keyframe name, duration, easing, delay) and `data-pivot` (viewBox units); the root group `#topfbert` carries the breathe.

**Motion**
- `assets/r12-keyframes.css`: `r12-wave` (arm waves twice at 0–24%, once at 60–79%), `r12-nudge` (arm x +2 twice at 8–22% and 56–70%), `r12-tip` (wink hat tip at 46–64%, replaces the sway). Breathe, steam, hat sway and the blink reuse the R11 keyframes, on the shared clock.
- `layers.json`: `moods.waving / pointing / wink` (z, file, motion per layer), `idle.perMood` for the three, and a new `tour` block with the idle per pose in the R11 format, plus `small` (below 48 px: breathe + blink only, arm stays in its drawn position), `reducedMotion` (frame 0), `mirror`, `theme` (only the steam rods take the text colour) and `placement`.

**Placement** (`layers.json → tour.placement`, shown at 360 px on the overview page)
- Topfbert 64 × 69 px stands on the bubble's bottom edge, 10 px over the bubble, on the side opposite the tail. Tail in the right half: he's on the left, as drawn; otherwise on the right, mirrored.
- Bubble above the target when the target centre is in the lower half, otherwise below (flip if it doesn't fit). Width = screen − 24 − 54 (282 at 360, max 320). Tail: 12 px square at 45°, x = target centre clamped 28 px from the corners, tip 8 px from the spotlight ring.
- Spotlight: `color-scrim` with a hole of target + 6 px and a static 3 px #F7B94A ring. Steps without a target (waving, wink) dim the whole Board and have no tail.

## 9 · R13: Recipes and the Recipe Finder
Overview page: `../Malkochen Recipes.dc.html` (every screen and state, phone 360 and desktop panel 460, light and dark, with motion and reduced motion per state). Copy the new files into `docs/design handoff/` next to the existing ones. Existing files only get additions.

**What's new**
- A Dish can hold a Recipe: "Zutaten" and "Schritte", each line one plain line of text. Read in the Dish detail, edited in its own mode.
- The Recipe Finder fills a Recipe in from the Source (or the page its Caption links to). Action for switched-on users only; its states and results for every Member.
- A "Rezeptfinder" section in Your Settings (request access) and on the Admin Page (the Operator's switch per user).

**Placement in the detail:** image, chips, title, Creator, Caption, action row, share row, **Recipe**, Verlauf, Verschieben nach…, Archivieren. Everything above is short and fixed, so the actions never drift and the Recipe starts in the same place on every Dish. Lines use the new `type.recipe` (Figtree 500 18/1.5) so a propped-up phone reads at arm's length.

**Files**
- `components.json`: new RecipeSection, RecipeList, RecipeLine (read + edit states, a11y), RecipeEditor (rules for Enter, Backspace, paste, save), RecipeSwitch, RecipeFinderState, RecipeFinderSettings, AdminRecipeFinder. Button, Toast and Dialog get an `r13` note with their new uses.
- `interactions.json`: Reorder a Recipe line, Paste lines, A found Recipe arrives, Recipe switch. Each with a ms timeline and reduced motion.
- `tokens.json` / `tokens.css` / `tailwind.preset.js`: `type.recipe`, `type.recipe-num`, `color.derived.paste-tint`, `color.derived.search-tint` (light + dark), `motion.search` (4800ms; 0 under reduced motion). Nothing existing changed.
- `assets/topfbert/topfbert-search.svg` + `topfbert-search-01…11-*.svg`: the "Rezept wird gesucht" pose. No new drawing: the stir layers, with the orbit pieces moved into the pot as `piece_1…3`. Still = frame 0 for reduced motion; groups carry `data-loop` / `data-pivot`.
- `assets/topfbert/layers.json`: `moods.search` and a `search` block (loop, small, reduced, pause, exit, theme). Additions only.
- `assets/r13-keyframes.css`: r13-breathe, r13-stir, r13-peek, r13-hat, r13-hop (search pose) and r13-out, r13-card, r13-in, r13-hold, r13-tint (UI motion).
- Overview frames (design reference, not for build): `RecipeScreen.dc.html`, `RecipeSettings.dc.html`, `RecipeAdmin.dc.html`, `TopfbertSearch.dc.html`.

**Motion, in short**
- UI motion: line add/remove/reorder (settle, lift as Columns in Board Settings), paste tint, Recipe switch, found Recipe arriving (stagger 60ms, max 8), Settings request fold, Admin switch.
- Motion graphic: Topfbert search, 4.8s loop built in Vue from layers (no video). Reduced motion: the still.

**Final wording for the drafts**
- Settings, off: "Der Rezeptfinder sucht dir Zutaten und Schritte zu einem Gericht heraus, aus der Caption oder aus dem Foodblog, auf den sie verlinkt. Gerade ist er nur für ein paar Leute freigeschaltet."
- Settings, on: "Der Rezeptfinder ist für dich eingeschaltet. Wenn er ein Rezept sucht, gehen die Caption und der Text der verlinkten Seite an Anthropic."
- Failed: "Die Suche hat gerade nicht geklappt." with "Noch mal suchen".
- Quota: "Für heute hat der Rezeptfinder genug gesucht. Morgen sucht er weiter."
- All other new strings are listed in section 07 of the overview page.

**Where I decided differently from the brief**
- Editing is its own mode, opened from the Recipe ("Bearbeiten" on the Rezept header, or "Rezept hinzufügen"). The detail's edit mode keeps title, Source and image.
- Desktop: the side panel itself becomes the editor. Our rule turns sheets into dialogs at 768px and up; for the Recipe that would put a 620px dialog over the panel.
- "Rezept finden" and "Rezept hinzufügen" stack on the phone (both labels don't fit a 328px row). Same size and weight; side by side from 400px.
- Nothing folds. Long Recipes get a sticky "Zutaten / Schritte" switch instead, and Steps are never clamped.
- "Rezept hinzufügen" is hidden while a search runs, so a typed and a found Recipe can't collide.
- After a failed search, only Finder users see "Noch mal suchen"; everyone else sees the sentence.
- "Kein Rezept gefunden" stays visible to every Member until a Recipe exists.
- Removing a line gives an undo toast, although the Recipe saves as a whole.
- Paste strips leading bullets and numbering and drops blank lines. Empty lines are dropped on save; two empty lists mean no Recipe.
- Added (not in the brief): Toast "Rezept gefunden" with "Zeigen" when the Recipe arrives off screen.
- Suggestion only, not designed: keep the screen awake (Screen Wake Lock) while a Recipe is on screen.

## 10 · R14: Week Plan (Wochenplan)
Overview page: `../Malkochen Week Plan.dc.html` (every screen and state, phone 360 and desktop 1280, light and dark, motion and reduced motion per state). Copy the new files into `docs/design handoff/` next to the existing ones. Existing files only get additions.

**What's new**
- A Week Plan per Board, Monday to Sunday, one week at a time, one ordered list per day. A view of its own beside the Columns: planning never moves a Dish between Columns and nothing about the plan appears on the Dish card.
- Planned Dish: image, title, optional cook. Tap opens the Dish detail. The same Dish may be on several days, each with its own cook.
- Ways in: "+" on a day (Dish picker), "Einplanen" in the Dish detail (day picker, first in the share row). Ways to change: drag (within and between days, phone day strip), "⋯" menu, keys, accessibility actions.
- "Gekocht ✓" on today's Planned Dishes only, same Cooking and celebration as the card; a Planned Dish is ticked when its Dish has a Cooking that day, however it was recorded.

**Files**
- `components.json`: ViewSwitch, WeekHeader, WeekView, WeekDay, PlannedDish, DayStrip, DishPicker, DayPicker, CookPicker, PlannedDishMenu, EmptyWeek. DishCard, Toast, BottomSheet and Button get an `r14` note.
- `interactions.json`: Switch views, Browse weeks, Drag a Planned Dish within a day, Drag a Planned Dish to another day, Plan from +, Plan from Einplanen, Move or reorder without dragging, Take off the plan, Set the cook, Tick after Gekocht ✓. Each with a ms timeline and reduced motion.
- `tokens.json` / `tokens.css` / `tailwind.preset.js`: color.derived.today-tint, day-fill, view-track, match-tint (light + dark), shadow.small, radius.planned, radius.planned-thumb, size.planned-dish, layout.week, z.strip. Nothing existing changed.
- `assets/r14-keyframes.css`: r14-reorder-a/b, r14-hold, r14-hold-small, r14-grow, r14-arrive, r14-shrink, r14-gone, r14-tick, r14-cook, r14-draw, r14-burst, r14-strip, r14-pop, r14-popout, r14-toast, r14-bar, r14-topfbert.
- `assets/topfbert/layers.json → weekEmpty`: placement, size and loop for Topfbert pointing in the empty week. No new SVG: the empty week reuses the R12 pointing pose and its layers.
- Overview frames (design reference, not for build): `WeekScreen.dc.html`.

**Motion, in short**
- UI motion: view switch (thumb settle, views shift 28px, days stagger 40ms), browsing weeks (slide 40px), lift and drop as the Dish card, day strip on the phone, arrive and remove, tick pop after Gekocht.
- Motion graphic: Topfbert pointing in the empty week, the R12 Tour idle built in Vue from layers (no video). Reduced motion: the still.

**Final wording for the drafts**
- Week title: "16. bis 22. November" (kept; with the month on both dates across months, with the year across years).
- Empty week: "Die Woche ist noch frei." + "Such dir ein Gericht vom Board aus und leg es auf einen Tag." + "Gericht aussuchen". Past week: "In dieser Woche war nichts geplant."
- Toast: "Für Donnerstag eingeplant." (kept) + Rückgängig; "Für heute eingeplant.", "Für morgen eingeplant.", "Für Donnerstag, 26. November eingeplant."
- Remove: "Aus dem Plan nehmen" (kept), toast "Aus dem Plan genommen."
- Move: "Auf anderen Tag legen", toast "Auf Freitag gelegt."
- Who cooks: "Wer kocht?", clearing "Offen lassen".
- All other new strings are in section 09 of the overview page.

**Where I decided differently from the brief**
- Phone: the switch has its own row under the top bar, not in it (pill, search and cogwheel already fill 328px). Desktop: right after the pill.
- The view is remembered once per device for all Boards, not per Board.
- Phone: all seven days in one vertical scroll (recommended), opened on today; the day strip only appears while dragging.
- "+": in the day header on the phone, as a dashed row at the end of the day on desktop.
- "Heute" floats at the bottom centre on the phone instead of sitting in the header.
- Past days have no "+" and take no drops (as the day picker); their Planned Dishes can still be moved forward or taken off. A past week therefore has no "+".
- No toast when planning from "+" (it lands in view); every other change, including "Einplanen", gets "Rückgängig".
- "⋯" on every Planned Dish (phone always, desktop on hover and focus); tapping the cook's Profile Picture opens the cook picker.
- Today's Planned Dish is taller on the phone (100px) so "Gekocht" gets its own row.
- The empty-week button opens the Dish picker for today (in a future week: its Monday).
- The phone Dish FAB is hidden in Woche.
- On desktop the pickers are popovers anchored to their trigger, not centred dialogs.
- Open, not designed: Planned Dishes of an archived Dish. Suggestion: they leave the plan with it and come back with Archivieren's undo.
