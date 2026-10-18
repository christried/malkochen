# malkochen · Remotion

The motion graphics from the design handoff (`docs/design handoff/REMOTION.md`),
once rendered to static video files the app served from `public/`. Since #217
the app draws every one of them in code, so nothing is rendered any more; the
timelines here are what the drawings were timed from. A separate
project: it is not in the pnpm workspace, the app never imports it, and the
Vercel build never installs it.

Uses npm, not pnpm, so the repo root's workspace stays out of it.

One video is still rendered here: the brag video (#313). It is a 29s
vertical launch video in German, never for the app. It comes in two
versions (`scripts/brag-variant.ts`). The **public** one shows a made-up
Board with stock photos and is the video in the repo's README. The
**friends** one shows a real Board from production and is made for showing
to friends, never for publishing.

## The brag video

The real app on a phone, captured frame by frame, inside a short story,
every move on a beat of its music: saved and never cooked, then "Was willst
du malkochen?", then a TikTok shared to it and saved, dragged onto the
second Column, a Column added in the Board settings, and cooked, then the
outro with malkochen.christried.me.

```bash
# 0. The music: "Joyful Rhythm Walk Funk" by lightbeatsmusic, from
#    pixabay.com/music, saved as remotion/lightbeatsmusic-joyful-rhythm-walk-funk-513936.mp3
#    (never committed: the Pixabay licence doesn't allow passing it on).
# 1. From the repo root: the app on a throwaway database (Ctrl+C drops it)…
pnpm exec tsx remotion/capture/serve.ts
# 2. …and, once it's ready, the capture into remotion/out/brag/<version>/
pnpm exec tsx remotion/capture/capture.ts             # public
pnpm exec tsx remotion/capture/capture.ts --friends   # friends

# 3. Here: the soundtrack, then out/brag/<version>/brag.mp4 and its poster brag.jpg
npm run brag
npm run brag:friends
npm run brag:studio   # or look at the public one in Studio first

# 4. The README's video: 720p, so it stays light; its poster is brag.jpg at 720×1280.
#    GitHub only plays a video it hosts itself: drag the file into an issue's
#    comment box (no need to post it) and put the user-attachments URL it
#    gives on a line of its own in the README.
npx remotion ffmpeg -y -i out/brag/public/brag.mp4 -s 720x1280 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart ../docs/media/malkochen.mp4
```

The public version's full render is kept in the repo as
`docs/media/malkochen-1080p.mp4` (with its poster), so it survives `out/`
being ignored. The friends version is not: it shows a real Board.

- **`src/brag/timeline.ts`** is the beat grid everything shares: the song's
  tempo (115 BPM) and first beat, the excerpt the video plays (from its beat
  9, two bars before the groove drops in, to the end of its one-bar break
  at beat 65), and every cue in beats. `beat()` turns a beat into the
  nearest frame. Another track means measuring its tempo and first beat
  again and moving the cues.
- **`capture/`** runs with the app's own dependencies, from the repo root.
  `serve.ts` starts `pnpm dev` with the browser tests' settings: dev
  sign-in, no Tour starting by itself, no dev error overlay. `seed.ts`
  fills the Board. The public version uses `MADE_UP`: invented Members,
  Dishes and creators, most Dishes showing a stock photo from
  `brag-photos/` (CC0, see its `CREDITS.md`), about one in five its
  Placeholder Image. The friends version uses `prod-board.ts`, which reads
  a real Board from production in a read-only transaction: `BRAG_BOARD`,
  by default "kochen lecker". The connection string is `DATABASE_URL` in
  the repo's `.env.production.local` (`vercel env pull`), read straight
  from that file. It keeps that Board's Columns, Dishes, images, creators
  and its Members' Usernames, seen as `BRAG_ME` (by default its Owner).
  Nobody's picture is used. `capture.ts` records the shots on a 412×892
  phone at 2.5×, each tap timed to land on its cue's beat. The recording
  (`recorder.ts`) runs the page on Playwright's paused clock and moves every
  CSS and Web Animation on by exactly 1/30s per frame, so each frame shows
  what the app shows at that moment, however long the screenshot takes. It
  also records the touches, which the video draws as a fingertip, and
  writes the opening grid (`grid.json`) and the shared video's photo.
- **`src/brag/`** is the composition. Its public dir is the version's
  `out/brag/<version>`, not the handoff, so `render-brag.ts` first copies in
  the app's Topfbert, the Placeholder Images, the icon, the veggies and the
  music.
- **`scripts/brag-audio.ts`** cuts the excerpt sample-exact with Remotion's
  ffmpeg and lays quiet effects under it: taps, air and a confetti
  sparkle, all unpitched so they can't clash with the song's key.
- Frame 0 is the poster (`POSTER_FRAME`), so every platform's thumbnail
  shows it.

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
npm test                          # timelines: seamless loops, no jumps, the briefs' key moments
npm run lint                      # ESLint + tsc
```

Not rendered any more (#111): the Placeholder Images, `empty-column` and
`topfbert-wow`, since #180 `empty-board` and `search-empty`, and since #215 the
celebrations `milestone-10x` and `board-created`, and since #216 the link
lookup's `lookup-stir` and `lookup-failed` and the `splash` (drawn inline by
`SplashScreen.vue`), and since #217 the last ones, `invite-intro`,
`invite-loop`, `offline`, `error` and `not-unlocked`, whose baked-in
background showed as a box on the coloured lanes, page and wash. The app
draws those loops in code from their SVGs (`SvgLoop.vue`, keyframes in `app/assets/css/loops.css`), at the screen's
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
- Canvas, length, loop, background and still come from the brief
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
  "Bald!" sign, the z's, "10×" and the wordmark.
- Not here: the Board's emoji (board-created, invite pebble), the "10×" on
  milestone-10x's pebble and the Member avatars are Vue overlays; `gekocht-topfbert` and the particle effects are
  built in Vue.

## Turning a clip into a drawing the app plays

How the clips were moved off video (#215–#217), for a scene drawn here
that the app should play:

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
   rest="last"` (`CelebrationDialog.vue`). A loop whose still is a frame
   further in (lookup-failed's f30) gives its layers that much negative delay
   and draws them in that pose (`app/utils/svg-loop.ts`).
4. **Text and emoji stay Vue**, in SvgLoop's `over` slot: a still is the SVG
   as an image, which can't load the app's fonts. To move with a part, the
   label takes that part's `data-loop` and `loopStyle()`.
5. **Test the drawing** in `tests/client/` (`drawing.ts` reads layers, loops
   and keyframes), add the clip to `DRAWN_IN_APP` in `scripts/render.ts`, and
   delete its videos and posters.

## License

Remotion is free for individuals and teams of up to 3 people; larger
companies need a [company license](https://www.remotion.pro/license).
