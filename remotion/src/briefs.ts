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
  loop: boolean;
  transparent: boolean;
  background: Record<PlaceholderTheme, string>;
  still: string;
};

const BRIEFS = briefs as RawBrief[];

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

const videoBrief = (id: string) => {
  const brief = BRIEFS.find((b) => b.id === id);
  if (!brief?.canvas || !brief.frames) throw new Error(`No video brief for ${id}`);
  const video: Video = {
    width: brief.canvas[0],
    height: brief.canvas[1],
    durationInFrames: brief.frames,
    fps: brief.fps,
  };
  return { brief, video };
};

export const placeholderBrief = (dish: Placeholder): Brief => {
  const { brief, video } = videoBrief(`placeholder-${dish}`);
  return { video, background: brief.background };
};

// The state, system and celebration clips: every video brief that is not a
// Placeholder Image. The transparent ones are built in Vue instead.
export const CLIP_IDS: string[] = BRIEFS.filter(
  (b) => !b.id.startsWith("placeholder-") && !b.transparent,
).map((b) => b.id);

type ClipBrief = Brief & {
  loop: boolean;
  // The reduced-motion still, rendered as the poster PNG.
  posterFrame: number;
};

// The brief's still is "frame N: …", "last frame …", or, for invite-intro,
// invite-loop's frame 0, which is where the intro ends.
const posterFrame = (still: string, frames: number) => {
  if (/^last frame|^invite-loop frame 0/.test(still)) return frames - 1;
  const frame = still.match(/^frame (\d+)/);
  if (!frame) throw new Error(`Unreadable still: ${still}`);
  return Number(frame[1]);
};

export const clipBrief = (id: string): ClipBrief => {
  const { brief, video } = videoBrief(id);
  return {
    video,
    loop: brief.loop,
    background: { light: brief.background.light, dark: brief.background.dark },
    posterFrame: posterFrame(brief.still, video.durationInFrames),
  };
};
