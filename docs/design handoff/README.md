# malkochen · Implementation handoff (Nuxt + Vue + Tailwind, Remotion)

Overview page: `../Malkochen Handoff.dc.html` (renders everything below).

## 1 · Design tokens
- `tokens.json`: source of truth. Colours for light and dark (bg, surface, surface-muted, text, text-muted, line, line-strong, inverse, on-inverse, danger, glass, scrim, focus, plus Column/accent hues). Also includes fonts, type scale `[family, size, line-height, weight, tracking, (style)]`, spacing, pebble radii, shadows, motion tokens, z-index and breakpoints.
- `tokens.css`: CSS custom properties. `:root` is light, `[data-theme="dark"]` and `prefers-color-scheme` are dark.
- `tailwind.preset.js`: `presets: [require('./handoff/tailwind.preset.js')]`, and import `tokens.css` in `app.vue`. Utilities map to the variables, so dark mode needs no `dark:` variants.
- Fonts: Newsreader (display) and Hanken Grotesk (UI), loaded with `@nuxtjs/google-fonts`.

## 2 · Components: `components.json`
There are 14 components. Each lists its variants, states, UI motion (with a token per state) and the tokens it uses. Build the UI motion with Vue `<Transition>` / `<TransitionGroup>` and CSS variables from `tokens.css`. Use `@vueuse/motion` only for springs.

## 3 · Interactions: `interactions.json`
Covers drag lift, drop target, the Gekocht celebration and toast, swiping between Columns, the card → detail morph (View Transitions API, with a FLIP fallback) and sheet open/close. Each one includes a millisecond timeline, haptics and reduced-motion behaviour.

## 4 · Motion graphics: `REMOTION.md` / `remotion-briefs.json`
There are 35 entries: 16 placeholders, 15 state, system and celebration clips, and 4 marked **needs transparency**. Of those 4, `gekocht-topfbert` should be built in Vue; the 3 particle effects are Vue only and are not videos. Every other clip bakes in a solid background and ships as `<id>-light.mp4` and `<id>-dark.mp4`, 30 fps, with a seamless loop where marked. The poster is the reduced-motion still.

## 5 · Breakpoints: `tokens.json → breakpoints`
- **< 768px:** phone. One Column at a time, swipe between them, pebble tabs, bottom sheets and a full-screen detail view.
- **768–1199px:** tablet. Kanban lanes (340px, scroll-snap), a 440px side panel, and sheets become dialogs.
- **≥ 1200px:** desktop. Lanes plus an add lane, a 480px side panel, hover and keyboard shortcuts.
- Gate hover and mouse drag on `pointer: fine`, not on width.

## 6 · Assets: `assets/`
- `illustrations/<dish>/`: 16 dishes. `<dish>-light.svg` / `<dish>-dark.svg` hold the still (frame 0). `layers/{light,dark}/NN-<part>.svg` are full-canvas layers in a shared 120×120 viewBox, and `NN` = z-order. `layers.json` lists the order, which parts animate, and the loop spec and pivot for each.
- `topfbert/`: the mascot in 5 moods (happy, stir, oops, wow, sleep). Each mood has a full SVG and numbered layers (hat, eyes, mouth, steam, spoon, …). Motion per layer is in `layers.json`.
- `veggies/`, `characters/pea.svg`, `shapes/`: supporting pieces used by the clips and particles (pebble, burst, plate, bowl outline, magnifier, "Gleich!" sign, wifi).
- `icon/`: `manifest.webmanifest` plus `icon-192/512.png` (any) and `icon-maskable-192/512.png` (80% safe zone). Also `apple-touch-icon-180.png`, `favicon-16/32/48.png`, `icon.svg`, `icon-monochrome.svg` and `icon-layers/` for the splash clip. Copy the PNGs and SVGs to `public/icons/`.

Legacy: `svg/{light,dark}/*.svg` and `illustrations.json` come from R4. They are identical to the `assets/illustrations/*` stills.
