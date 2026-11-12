# malkochen · Handoff R13 (Recipes + Recipe Finder)

- `Malkochen Recipes (standalone).html`: the R13 overview, works offline. Every screen and state, phone 360 and desktop panel 460, light and dark, with motion and reduced motion per state. Frames load as you scroll.
- `handoff/`: the full handoff folder (R4 to R13). Copy it into `docs/design handoff/`. R13 is described in `handoff/README.md` §9; new files: `assets/r13-keyframes.css`, `assets/topfbert/topfbert-search*.svg`. Additions in `components.json`, `interactions.json`, `tokens.json`, `tokens.css`, `tailwind.preset.js`, `assets/topfbert/layers.json`.
- `design-source/`: the editable design files behind the overview (reference only, not for the build). They expect `handoff/` next to them, so open them from the project root.
