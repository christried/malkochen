/**
 * Studio and CLI config. The render script (scripts/render.ts) uses the Node
 * APIs, where this file doesn't apply, so it passes the same options itself.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// The design handoff is the single source of the layered dish SVGs; nothing is
// copied into this project.
Config.setPublicDir("../docs/design handoff");
// PNG frames keep the flat colours free of JPEG blocking before encoding.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
