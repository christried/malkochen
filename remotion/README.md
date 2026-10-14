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
npm run render                    # render every clip into public/clips/
npm run render -- offline error   # only the named clips
npm test                          # timelines: seamless loops, no jumps, the briefs' key moments
npm run lint                      # ESLint + tsc
```

`npm run render` writes, per video and theme:

| File | What |
|---|---|
| `public/clips/<clip>-<theme>.{mp4,webm,png}` | The state, system and celebration clips |
| `public/clips/splash-landscape-<theme>.{mp4,webm}` | The splash again at 2560×1440, for wide windows |

`.mp4` is H.264 and plays everywhere, `.webm` is VP9 and smaller where it is
supported, and `.png` is the poster: the reduced-motion still (the brief's
"still"; invite-intro's is invite-loop's frame 0, where it hands off). The splash's stills are WebPs instead, one per
orientation for both themes: `splash[-landscape]-{poster,still}.webp`.

Commit the rendered files; the app serves them as they are.

Not rendered any more (#111): the Placeholder Images, `empty-column` and
`topfbert-wow`, since #180 `empty-board` and `search-empty`, and since #215 the
celebrations `milestone-10x` and `board-created`, whose baked-in background
showed as a box on the coloured lanes, page and wash. The app draws those
loops in code from their SVGs
(`SvgLoop.vue`, keyframes in `app/assets/css/loops.css`), at the screen's
refresh rate and sharp at any size. Their compositions stay in Studio, but
only for the nine Round 10 Placeholder Images: Round 11's pasta, bowl and
breakfast were drawn for CSS keyframes (`assets/r11-keyframes.css`) and have
none (`STUDIO_PLACEHOLDERS` in `src/briefs.ts`). Round 11's other new loops,
the empty Column's Knobi and Schoti and the three "never cooked" scenes
(which replaced `never-cooked`, #134), have no composition either: the app
draws them in code the same way.

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
  (`clipBrief` in `src/briefs.ts`), except the background of clips shown on
  another colour in the app, and the splash's landscape render: the same
  timeline on a 2560×1440 canvas (`clipVideo`), for wide windows, where the
  portrait one would be cut and blown up. Where a briefed timing can't loop
  seamlessly, the nearest one that does is used, and the clip says so
  (invite-loop's 84f pebble bob, lookup-stir's 72f orbit).
- **`topfbert.tsx`** stacks Topfbert's mood layers and gives him his own
  motions from `assets/topfbert/layers.json` (bob, hat, steam, blink, sparks,
  drop, z's), retimed to whole fractions of each clip so the loops stay
  seamless.
- Layouts follow the app's existing Vue stills where there is one
  (`OfflineIllustration.vue`, the login and invite pages, …), so a still can
  be swapped for its clip without a jump. For the loops the app draws in code,
  its SVGs in `public/` are what ships: a change to one of those compositions
  doesn't reach the app. Where a clip's
  background is the blob's own tint (invite), the blob is the
  video's frame, masked in Vue, rather than drawn.
- Text is real text in the app's fonts (`@remotion/google-fonts`): the
  "Gleich!" sign, the z's, "10×" and the wordmark.
- Not here: the Board's emoji (board-created, invite pebble), the "10×" on
  milestone-10x's pebble and the Member avatars are Vue overlays; `gekocht-topfbert` and the particle effects are
  built in Vue.

## Turning a clip into a drawing the app plays

How the celebrations were moved off video (#215), for the clips still
rendered here:

1. **Draw the scene as a layered SVG**, one per theme:
   `public/clips/<clip>-<theme>.svg`, no background (the app's page, lane or
   wash shows through). Each moving part of `poses()` is a `<g
   data-layer="…">` with `data-loop="<keyframes> <length>s linear infinite"`
   (the clip's whole length) and `data-pivot="x y"` in viewBox units.
   Transforms a part has at rest go on a parent `<g>`: the animation takes
   over the part's own `transform`.
2. **Write the keyframes** in `app/assets/css/loops.css`, from the timeline:
   each key at `frame / length` percent, its `ease` as that keyframe's
   `animation-timing-function` (Remotion's `ease-out` is
   `cubic-bezier(0,0,.58,1)`, `ease-in-out` `cubic-bezier(.42,0,.58,1)`).
3. **Pick what the drawing stands at**, which is its still: a loop stands at
   frame 0 (the keyframes' 0%); a one-shot that comes to rest elsewhere
   stands at its last frame (100%), and plays with `:loop="false"
   rest="last"` (`CelebrationDialog.vue`).
4. **Text and emoji stay Vue**, in SvgLoop's `over` slot: a still is the SVG
   as an image, which can't load the app's fonts. To move with a part, the
   label takes that part's `data-loop` and `loopStyle()`.
5. **Test the drawing** in `tests/client/` (`drawing.ts` reads layers, loops
   and keyframes), add the clip to `DRAWN_IN_APP` in `scripts/render.ts`, and
   delete its videos and posters.

## License

Remotion is free for individuals and teams of up to 3 people; larger
companies need a [company license](https://www.remotion.pro/license).
