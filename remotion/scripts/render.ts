// Renders every video into the app's static assets, per theme:
//   public/placeholders/<dish>-<theme>.{mp4,webm,png}   the Placeholder Image loops
//   public/clips/<clip>-<theme>.{mp4,webm,png}          the state, system and celebration clips
//
//   .mp4   H.264, what every browser plays
//   .webm  VP9, smaller where supported
//   .png   poster: the reduced-motion still (frame 0 for a placeholder, the
//          brief's still for a clip, which for invite-intro is invite-loop's)
//
// The splash has no PNGs: from frame 10 on the butter covers the Board's
// background, so its stills are one WebP each for both themes, small enough
// for the service worker to precache (public/clips/splash-<still>.webp):
//   splash-poster.webp  frame 10, what shows until the clip has a frame
//   splash-still.webp   frame 16, the reduced-motion still
//
//   npm run render                   everything, light and dark
//   npm run render -- pasta offline  only the named dishes and clips

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import type { ClipProps } from "../src/ClipVideo.tsx";
import type { PlaceholderProps } from "../src/Placeholder.tsx";
import { HANDOFF_DIR, RSPACK, VIDEO_IMAGE_FORMAT } from "../src/render-settings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "../public");
const only = process.argv.slice(2);

// Clips whose stills are theme-independent WebPs in place of the PNG poster.
const WEBP_STILLS: Record<string, { file: string; frame: number }[]> = {
  splash: [
    { file: "splash-poster", frame: 10 },
    { file: "splash-still", frame: 16 },
  ],
};

// Where a composition's files go, and the composition and frame of its poster.
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
        file: `${props.clip}-${props.theme}`,
        poster: { id: `${props.poster.clip}-${props.theme}`, frame: props.poster.frame },
      };

const serveUrl = await bundle({
  entryPoint: join(root, "src/index.ts"),
  publicDir: join(root, HANDOFF_DIR),
  rspack: RSPACK,
});

const all = await getCompositions(serveUrl);
const compositions = all.filter((c) => {
  const { name } = output(c.props as PlaceholderProps | ClipProps);
  return only.length === 0 || only.includes(name);
});
if (compositions.length === 0) throw new Error(`Nothing matches ${only.join(", ")}`);

for (const composition of compositions) {
  const { dir, file, poster } = output(composition.props as PlaceholderProps | ClipProps);
  mkdirSync(join(publicDir, dir), { recursive: true });
  const name = join(publicDir, dir, file);
  const common = { composition, serveUrl, inputProps: composition.props };

  const posterComposition = all.find((c) => c.id === poster.id);
  if (!posterComposition) throw new Error(`No composition ${poster.id} for ${file}'s poster`);
  const webpStills = "clip" in composition.props ? WEBP_STILLS[composition.props.clip as string] : undefined;
  if (!webpStills) {
    await renderStill({
      composition: posterComposition,
      serveUrl,
      inputProps: posterComposition.props,
      frame: poster.frame,
      output: `${name}.png`,
      imageFormat: "png",
    });
  } else if ((composition.props as ClipProps).theme === "light") {
    for (const still of webpStills) {
      await renderStill({
        composition,
        serveUrl,
        inputProps: composition.props,
        frame: still.frame,
        output: join(publicDir, dir, `${still.file}.webp`),
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
