/**
 * Studio and CLI config. Settings shared with scripts/render.ts live in
 * src/render-settings.ts.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { HANDOFF_DIR, RSPACK, VIDEO_IMAGE_FORMAT } from "./src/render-settings";

Config.setRspack(RSPACK);
Config.setPublicDir(HANDOFF_DIR);
Config.setVideoImageFormat(VIDEO_IMAGE_FORMAT);
Config.setOverwriteOutput(true);
