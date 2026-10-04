# malkochen · Implementation handoff (Nuxt + Vue + Tailwind, Remotion)

Overview page: `../Malkochen Handoff.dc.html` (renders everything below).

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
- `topfbert/`: the mascot in 5 moods (happy, stir, oops, wow, sleep). Each mood has a full SVG and numbered layers (hat, eyes, mouth, steam, spoon, …). Motion per layer is in `layers.json`.
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
