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
npm run dev                       # Remotion Studio: check every clip by eye before rendering
npm run render                    # render everything into public/placeholders/ and public/clips/
npm run render -- pasta offline   # only the named dishes and clips
npm test                          # timelines: seamless loops, no jumps, the briefs' key moments
npm run lint                      # ESLint + tsc
```

`npm run render` writes, per video and theme:

| File | What |
|---|---|
| `public/placeholders/<dish>-<theme>.{mp4,webm,png}` | The 16 Placeholder Image loops, next to the SVG stills |
| `public/clips/<clip>-<theme>.{mp4,webm,png}` | The 15 state, system and celebration clips |

`.mp4` is H.264 and plays everywhere, `.webm` is VP9 and smaller where it is
supported, and `.png` is the poster: the reduced-motion still (frame 0 for a
placeholder, the brief's "still" for a clip; invite-intro's is invite-loop's
frame 0, where it hands off).

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

### The state, system and celebration clips

- **`src/clips/<clip>.tsx`**, one per brief, each with a pure timeline,
  `poses(frame)` (the pose of every moving part at any frame, which is what
  `clips.test.ts` checks) and a `Scene` that draws it. Each names its moving
  parts (`defineClip<"sign" | …>`), so a misspelt part is a type error, and
  `registry.ts` has one clip per id in `CLIP_IDS`. Timelines count frames,
  never seconds.
- Canvas, length, loop, background and poster come from the brief
  (`clipBrief` in `src/briefs.ts`). Where a briefed timing can't loop
  seamlessly, the nearest one that does is used, and the clip says so
  (invite-loop's 84f pebble bob, lookup-stir's 72f orbit).
- **`topfbert.tsx`** stacks Topfbert's mood layers and gives him his own
  motions from `assets/topfbert/layers.json` (bob, hat, steam, blink, sparks,
  drop, z's), retimed to whole fractions of each clip so the loops stay
  seamless.
- Layouts follow the app's existing Vue stills where there is one
  (`EmptyBoard.vue`, `OfflineIllustration.vue`, the login and invite pages, …),
  so a still can be swapped for its clip without a jump. Where a clip's
  background is the blob's own tint (empty-board, invite), the blob is the
  video's frame, masked in Vue, rather than drawn.
- Text is real text in the app's fonts (`@remotion/google-fonts`): the
  "Gleich!" sign, the z's, "10×" and the wordmark.
- Not here: the Board's emoji (board-created, invite pebble) and the Member
  avatars are Vue overlays; `gekocht-topfbert` and the particle effects are
  built in Vue.

## License

Remotion is free for individuals and teams of up to 3 people; larger
companies need a [company license](https://www.remotion.pro/license).
