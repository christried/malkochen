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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "../public/placeholders");
const only = process.argv.slice(2);

const serveUrl = await bundle({
  entryPoint: join(root, "src/index.ts"),
  publicDir: join(root, "../docs/design handoff"),
  rspack: true,
});

const compositions = (await getCompositions(serveUrl)).filter((c) => {
  const [, dish] = c.id.match(/^placeholder-(\w+)-(light|dark)$/) ?? [];
  return dish && (only.length === 0 || only.includes(dish));
});
if (compositions.length === 0) throw new Error(`No placeholder matches ${only.join(", ")}`);

mkdirSync(outDir, { recursive: true });

for (const composition of compositions) {
  const name = join(outDir, composition.id.replace(/^placeholder-/, ""));
  const common = { composition, serveUrl, inputProps: composition.props };

  await renderStill({ ...common, frame: 0, output: `${name}.png`, imageFormat: "png" });
  await renderMedia({ ...common, codec: "h264", imageFormat: "png", outputLocation: `${name}.mp4` });
  await renderMedia({ ...common, codec: "vp9", imageFormat: "png", outputLocation: `${name}.webm` });
  console.log(`✓ ${composition.id}`);
}
