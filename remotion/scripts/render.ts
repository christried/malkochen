// Renders every video into the app's static assets, per theme:
//   public/placeholders/<dish>-<theme>.{mp4,webm,png}   the Placeholder Image loops
//   public/clips/<clip>-<theme>.{mp4,webm,png}          the state, system and celebration clips
//
//   .mp4   H.264, what every browser plays
//   .webm  VP9, smaller where supported
//   .png   poster: the reduced-motion still (frame 0 for a placeholder, the
//          brief's still frame for a clip)
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

// Where a composition's files go and which frame is its poster.
const output = (props: PlaceholderProps | ClipProps) =>
  "dish" in props
    ? { name: props.dish, dir: "placeholders", file: `${props.dish}-${props.theme}`, posterFrame: 0 }
    : {
        name: props.clip,
        dir: "clips",
        file: `${props.clip}-${props.theme}`,
        posterFrame: props.posterFrame,
      };

const serveUrl = await bundle({
  entryPoint: join(root, "src/index.ts"),
  publicDir: join(root, HANDOFF_DIR),
  rspack: RSPACK,
});

const compositions = (await getCompositions(serveUrl)).filter((c) => {
  const { name } = output(c.props as PlaceholderProps | ClipProps);
  return only.length === 0 || only.includes(name);
});
if (compositions.length === 0) throw new Error(`Nothing matches ${only.join(", ")}`);

for (const composition of compositions) {
  const { dir, file, posterFrame } = output(composition.props as PlaceholderProps | ClipProps);
  mkdirSync(join(publicDir, dir), { recursive: true });
  const name = join(publicDir, dir, file);
  const common = { composition, serveUrl, inputProps: composition.props };

  await renderStill({ ...common, frame: posterFrame, output: `${name}.png`, imageFormat: "png" });
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
