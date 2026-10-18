import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The brag video comes in two versions (#313). Public: the made-up Board
// with stock photos, for the README. Friends: a real Board read from
// production, to show friends. `--friends` on any of its commands picks the
// second; each version has its own out/brag/<version>/, which is also its
// public dir.
export const VARIANT: "public" | "friends" = process.argv.includes("--friends") ? "friends" : "public";

const REMOTION = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_DIR = join(REMOTION, "out/brag", VARIANT);
