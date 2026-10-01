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
// Placeholder Image, in the briefs' order. The transparent ones are built in
// Vue instead. (briefs.test.ts checks this against the handoff.)
export const CLIP_IDS = [
  "empty-board",
  "empty-column",
  "search-empty",
  "lookup-stir",
  "lookup-failed",
  "never-cooked",
  "milestone-10x",
  "board-created",
  "invite-intro",
  "invite-loop",
  "splash",
  "topfbert-wow",
  "not-unlocked",
  "offline",
  "error",
] as const;

export type ClipId = (typeof CLIP_IDS)[number];

const isClipId = (id: string): id is ClipId => (CLIP_IDS as readonly string[]).includes(id);

// The reduced-motion still, rendered as the poster PNG: a frame of this clip,
// or of the clip it hands off to.
export type Poster = { clip: ClipId; frame: number };

type ClipBrief = Brief & {
  loop: boolean;
  poster: Poster;
};

// The brief's still is "frame N: …", "last frame …", or "<clip> frame N" for
// invite-intro, whose still is invite-loop's.
const posterOf = (id: ClipId, still: string, frames: number): Poster => {
  if (/^last frame/.test(still)) return { clip: id, frame: frames - 1 };
  const match = still.match(/^(?:(\S+) )?frame (\d+)/);
  if (!match) throw new Error(`Unreadable still: ${still}`);
  const clip = match[1] ?? id;
  if (!isClipId(clip)) throw new Error(`Still names an unknown clip: ${still}`);
  return { clip, frame: Number(match[2]) };
};

export const clipBrief = (id: ClipId): ClipBrief => {
  const { brief, video } = videoBrief(id);
  return {
    video,
    loop: brief.loop,
    background: { light: brief.background.light, dark: brief.background.dark },
    poster: posterOf(id, brief.still, video.durationInFrames),
  };
};
