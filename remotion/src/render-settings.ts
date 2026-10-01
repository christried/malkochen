// Shared by remotion.config.ts (Studio and CLI) and scripts/render.ts (the
// Node APIs, which ignore the config file).

// The design handoff is the single source of the layered dish SVGs; it serves
// as the public dir, so nothing is copied into this project. Relative to
// remotion/.
export const HANDOFF_DIR = "../docs/design handoff";

export const RSPACK = true;

// PNG frames keep the flat colours free of JPEG blocking before encoding.
export const VIDEO_IMAGE_FORMAT = "png";
