// Renders every Placeholder Image loop into the app's static assets:
//   public/placeholders/<dish>-<theme>.mp4   H.264, what every browser plays
//   public/placeholders/<dish>-<theme>.webm  VP9, smaller where supported
//   public/placeholders/<dish>-<theme>.png   poster = frame 0, the reduced-motion still
//
//   npm run render              all 16 dishes, light and dark
//   npm run render -- pasta     only the named dishes

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import type { PlaceholderProps } from "../src/Placeholder.tsx";
import { HANDOFF_DIR, RSPACK, VIDEO_IMAGE_FORMAT } from "../src/render-settings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "../public/placeholders");
const only = process.argv.slice(2);

const serveUrl = await bundle({
  entryPoint: join(root, "src/index.ts"),
  publicDir: join(root, HANDOFF_DIR),
  rspack: RSPACK,
});

const compositions = (await getCompositions(serveUrl)).filter((c) => {
  const { dish } = c.props as PlaceholderProps;
  return only.length === 0 || only.includes(dish);
});
if (compositions.length === 0) throw new Error(`No placeholder matches ${only.join(", ")}`);

mkdirSync(outDir, { recursive: true });

for (const composition of compositions) {
  const { dish, theme } = composition.props as PlaceholderProps;
  const name = join(outDir, `${dish}-${theme}`);
  const common = { composition, serveUrl, inputProps: composition.props };

  await renderStill({ ...common, frame: 0, output: `${name}.png`, imageFormat: "png" });
  for (const [codec, extension] of [["h264", "mp4"], ["vp9", "webm"]] as const) {
    await renderMedia({
      ...common,
      codec,
      imageFormat: VIDEO_IMAGE_FORMAT,
      outputLocation: `${name}.${extension}`,
    });
  }
  console.log(`✓ ${dish}-${theme}`);
}
