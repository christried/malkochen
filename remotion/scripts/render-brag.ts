// Renders the brag video (#313) from what capture/capture.ts recorded into
// out/brag: copies in the app's art (Topfbert, the Placeholder Images, the
// icon, the confetti's veggies) and the music, writes the soundtrack
// (brag-audio.ts),
// then renders out/brag/brag.mp4 and its poster, out/brag/brag.jpg. The
// poster is also the video's frame 0 (POSTER_FRAME in src/brag/timeline.ts),
// so every platform's thumbnail shows it.
//
//   npm run brag             all of it
//   npm run brag -- --prepare  only the art and the soundtrack, for Studio

import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { MUSIC, POSTER_FRAME } from "../src/brag/timeline.ts";
import { RSPACK } from "../src/render-settings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out/brag");

// The music, as downloaded from Pixabay ("Joyful Rhythm Walk Funk" by
// lightbeatsmusic): kept next to this project but never committed, as the
// Pixabay licence doesn't allow passing the track on by itself.
const MUSIC_SOURCE = "lightbeatsmusic-joyful-rhythm-walk-funk-513936.mp3";

for (const dir of ["illustrations", "placeholders", "icons"]) {
  cpSync(join(root, "../public", dir), join(out, dir), { recursive: true });
}
if (!existsSync(join(root, MUSIC_SOURCE))) throw new Error(`The music is missing: put ${MUSIC_SOURCE} (pixabay.com/music) in remotion/.`);
cpSync(join(root, MUSIC_SOURCE), join(out, MUSIC.file));
await import("./brag-audio.ts");
if (process.argv.includes("--prepare")) process.exit(0);

const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: out, rspack: RSPACK });
const composition = await selectComposition({ serveUrl, id: "brag" });

await renderStill({
  composition,
  serveUrl,
  frame: POSTER_FRAME,
  output: join(out, "brag.jpg"),
  imageFormat: "jpeg",
  jpegQuality: 92,
});
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  crf: 16,
  imageFormat: "jpeg",
  jpegQuality: 95,
  audioCodec: "aac",
  audioBitrate: "192k",
  outputLocation: join(out, "brag.mp4"),
  onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
});
console.log("\n✓ out/brag/brag.mp4, out/brag/brag.jpg");
