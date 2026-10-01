import briefs from "../../docs/design handoff/remotion-briefs.json";
import type { Placeholder, PlaceholderTheme } from "../../shared/placeholders";

// The handoff's remotion-briefs.json is the source of truth for each clip's
// canvas, length, frame rate and baked-in background. Only the fields used
// here are typed.

// Particle effects built in Vue have no canvas or length.
type RawBrief = {
  id: string;
  fps: number;
  canvas: number[] | null;
  frames: number | null;
  background: Record<PlaceholderTheme, string>;
};

// What a <Composition> needs to know about its video.
export type Video = {
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
};

type Brief = {
  video: Video;
  background: Record<PlaceholderTheme, string>;
};

export const placeholderBrief = (dish: Placeholder): Brief => {
  const brief = (briefs as RawBrief[]).find((b) => b.id === `placeholder-${dish}`);
  if (!brief?.canvas || !brief.frames) throw new Error(`No video brief for placeholder-${dish}`);
  return {
    video: {
      width: brief.canvas[0],
      height: brief.canvas[1],
      durationInFrames: brief.frames,
      fps: brief.fps,
    },
    background: brief.background,
  };
};
