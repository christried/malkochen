# malkochen · Remotion

The motion graphics from the design handoff (`docs/design handoff/REMOTION.md`),
rendered to static video files the app serves from `public/`. A separate
project: it is not in the pnpm workspace, the app never imports it, and the
Vercel build never installs it.

Uses npm, not pnpm, so the repo root's workspace stays out of it.

## Setup

Node 24 (the render script runs TypeScript directly).

```bash
cd remotion
npm install
```

The first render downloads Chrome Headless Shell (~110 MB) once.

## Commands

```bash
npm run dev               # Remotion Studio: check every loop by eye before rendering
npm run render            # render all Placeholder Image loops into public/placeholders/
npm run render -- pasta   # only the named dishes
npm test                  # loop maths: every animated layer fits, moves, and loops seamlessly
npm run lint              # ESLint + tsc
```

`npm run render` writes, per dish and theme, next to the existing SVG stills:

| File | What |
|---|---|
| `public/placeholders/<dish>-<theme>.mp4` | H.264, plays everywhere |
| `public/placeholders/<dish>-<theme>.webm` | VP9, smaller where supported |
| `public/placeholders/<dish>-<theme>.png` | Poster: frame 0, the reduced-motion still |

Commit the rendered files; the app serves them as they are.

## How it is built

- **Assets come straight from the handoff.** Studio's public dir is
  `docs/design handoff/`, so each composition loads the dish's `layers.json`
  and layer SVGs from there. Nothing is copied into this project.
- **`src/briefs.ts`** reads canvas, length and background colours from
  `remotion-briefs.json`.
- **`src/motion.ts`** turns each layer's `loop` from `layers.json`
  (`"steam 2.7s ease-out .9s infinite"`: animation, duration, easing, delay)
  into a pose per frame. The keyframes behind each animation name are written
  from the briefs' "Animate" lines. A delay is a phase offset, so every loop
  is seamless: frame N equals frame 0.
- **`src/Placeholder.tsx`** stacks the layers by z in the 120×120 viewBox,
  drawn into the centred 800×800 square of the 800×1000 canvas, on the
  dish's ground tint. Pivots are relative to each layer's own bounding box
  (`transform-box: fill-box`).
- One composition per dish and theme: `placeholder-<dish>-<theme>`.

## License

Remotion is free for individuals and teams of up to 3 people; larger
companies need a [company license](https://www.remotion.pro/license).
