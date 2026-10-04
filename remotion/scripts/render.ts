// Renders every video into the app's static assets, per theme:
//   public/clips/<clip>-<theme>.{mp4,webm,png}          the state, system and celebration clips
//   public/clips/<clip>-landscape-<theme>.{mp4,webm}    a clip's 16:9 render for wide windows
//
//   .mp4   H.264, what every browser plays
//   .webm  VP9, smaller where supported
//   .png   poster: the reduced-motion still (the brief's still, which for
//          invite-intro is invite-loop's)
//
// Not the loops the app draws in code from their SVGs since #111 (SvgLoop.vue:
// sharp at any size, at the screen's refresh rate): the Placeholder Images,
// the empty Column's and Topfbert wow's. Their compositions stay for Studio.
//
// The splash has no PNGs: from frame 10 on the butter covers the Board's
// background, so its stills are one WebP each for both themes, small enough
// for the service worker to precache (public/clips/splash[-landscape]-<still>.webp):
//   splash-poster.webp  frame 10, what shows until the clip has a frame
//   splash-still.webp   frame 16, the reduced-motion still
//
//   npm run render                   everything, light and dark
//   npm run render -- offline error  only the named clips

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import type { ClipProps } from "../src/ClipVideo.tsx";
import type { PlaceholderProps } from "../src/Placeholder.tsx";
import { clipName, HANDOFF_DIR, RSPACK, VIDEO_IMAGE_FORMAT } from "../src/render-settings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "../public");
const only = process.argv.slice(2);

// Clips whose stills are theme-independent WebPs in place of the PNG poster.
// Named <clip>[-landscape]-<name>.webp.
const WEBP_STILLS: Record<string, { name: string; frame: number }[]> = {
  splash: [
    { name: "poster", frame: 10 },
    { name: "still", frame: 16 },
  ],
};

// Where a composition's files go, and the composition and frame of its poster.
// `name` is what the command line picks it by: a clip's landscape render
// goes with the clip.
const output = (props: PlaceholderProps | ClipProps) =>
  "dish" in props
    ? {
        name: props.dish,
        dir: "placeholders",
        file: `${props.dish}-${props.theme}`,
        poster: { id: `placeholder-${props.dish}-${props.theme}`, frame: 0 },
      }
    : {
        name: props.clip,
        dir: "clips",
        file: `${clipName(props.clip, props.landscape)}-${props.theme}`,
        poster: { id: `${clipName(props.poster.clip, props.landscape)}-${props.theme}`, frame: props.poster.frame },
      };

const serveUrl = await bundle({
  entryPoint: join(root, "src/index.ts"),
  publicDir: join(root, HANDOFF_DIR),
  rspack: RSPACK,
});

// Drawn in code by the app (see the top).
const DRAWN_IN_APP = new Set(["empty-column", "topfbert-wow"]);
const drawnInApp = (props: PlaceholderProps | ClipProps) => "dish" in props || DRAWN_IN_APP.has(props.clip);

const all = await getCompositions(serveUrl);
const compositions = all.filter((c) => {
  const props = c.props as PlaceholderProps | ClipProps;
  if (drawnInApp(props)) return false;
  return only.length === 0 || only.includes(output(props).name);
});
if (compositions.length === 0) throw new Error(`Nothing matches ${only.join(", ")}`);

for (const composition of compositions) {
  const { dir, file, poster } = output(composition.props as PlaceholderProps | ClipProps);
  mkdirSync(join(publicDir, dir), { recursive: true });
  const name = join(publicDir, dir, file);
  const common = { composition, serveUrl, inputProps: composition.props };

  const posterComposition = all.find((c) => c.id === poster.id);
  if (!posterComposition) throw new Error(`No composition ${poster.id} for ${file}'s poster`);
  const clip = "clip" in composition.props ? (composition.props as ClipProps) : undefined;
  const webpStills = clip && WEBP_STILLS[clip.clip];
  if (!webpStills) {
    await renderStill({
      composition: posterComposition,
      serveUrl,
      inputProps: posterComposition.props,
      frame: poster.frame,
      output: `${name}.png`,
      imageFormat: "png",
    });
  } else if (clip?.theme === "light") {
    for (const { name: still, frame } of webpStills) {
      await renderStill({
        composition,
        serveUrl,
        inputProps: composition.props,
        frame,
        output: join(publicDir, dir, `${clipName(clip.clip, clip.landscape)}-${still}.webp`),
        imageFormat: "webp",
      });
    }
  }
  for (const [codec, extension] of [["h264", "mp4"], ["vp9", "webm"]] as const) {
    await renderMedia({
      ...common,
      codec,
      imageFormat: VIDEO_IMAGE_FORMAT,
      outputLocation: `${name}.${extension}`,
    });
  }
  console.log(`✓ ${dir}/${file}`);
}
