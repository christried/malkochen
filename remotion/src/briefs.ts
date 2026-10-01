import briefs from "../../docs/design handoff/remotion-briefs.json";
import type { Placeholder } from "../../shared/placeholders";

// The handoff's remotion-briefs.json is the source of truth for each clip's
// canvas, length and baked-in background. Only the fields used here are typed.

export const FPS = 30;

export type Theme = "light" | "dark";
export const THEMES: Theme[] = ["light", "dark"];

// Particle effects built in Vue have no canvas or length.
type RawBrief = {
  id: string;
  canvas: number[] | null;
  frames: number | null;
  background: Record<Theme, string>;
};

type Brief = {
  canvas: [number, number];
  frames: number;
  background: Record<Theme, string>;
};

export const placeholderBrief = (dish: Placeholder): Brief => {
  const brief = (briefs as RawBrief[]).find((b) => b.id === `placeholder-${dish}`);
  if (!brief?.canvas || !brief.frames) throw new Error(`No video brief for placeholder-${dish}`);
  return {
    canvas: [brief.canvas[0], brief.canvas[1]],
    frames: brief.frames,
    background: brief.background,
  };
};
