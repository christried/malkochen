import illustrations from "../../docs/design handoff/illustrations.json";
import briefs from "../../docs/design handoff/remotion-briefs.json";
import { type Placeholder, type PlaceholderTheme, PLACEHOLDERS } from "../../shared/placeholders";
import { palette } from "./clips/draw";

// The handoff's remotion-briefs.json is the source of truth for each clip's
// canvas, length, frame rate and baked-in background, except where a clip
// is overridden below and says why (IN_APP_BACKGROUND, the landscape canvas
// of LANDSCAPE_CLIPS). Only the fields used here are typed.

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

// The Placeholder Images Studio draws: the Round 10 ones. Round 11's (pasta,
// bowl, breakfast; illustrations.json "r11") were drawn for CSS keyframes
// (assets/r11-keyframes.css), and the app draws every Placeholder Image in
// code anyway (#111), so they have no composition here.
export const STUDIO_PLACEHOLDERS = PLACEHOLDERS.filter((dish) => !("r11" in illustrations.dishes[dish]));

export const placeholderBrief = (dish: Placeholder): Brief => {
  const { brief, video } = videoBrief(`placeholder-${dish}`);
  return { video, background: brief.background };
};

// The state, system and celebration clips: every video brief that is not a
// Placeholder Image, in the briefs' order. The transparent ones are built in
// Vue instead, and Round 11's new ones (the empty Column's Knobi and Schoti,
// the three "never cooked" scenes) were drawn for CSS keyframes: the app
// draws them in code from their SVGs. (briefs.test.ts checks this against
// the handoff.)
export const CLIP_IDS = [
  "empty-board",
  "empty-column",
  "search-empty",
  "lookup-stir",
  "lookup-failed",
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

// Where the app shows a clip on another colour than its brief's, the clip is
// rendered on that colour so it blends in, and draws its tint as a blob
// instead: the Column panel (surface-muted) and the invite page (bg).
const IN_APP_BACKGROUND: Partial<Record<ClipId, "surfaceMuted" | "bg">> = {
  "empty-board": "surfaceMuted",
  "empty-column": "surfaceMuted",
  "invite-intro": "bg",
  "invite-loop": "bg",
};

// Clips rendered a second time on a 16:9 canvas, for wide windows: covering
// one, the brief's portrait canvas is cut at top and bottom and blown up
// past its pixels. 2560×1440 stays sharp on a 1440p monitor.
export const LANDSCAPE_CLIPS: ClipId[] = ["splash"];
const LANDSCAPE_CANVAS = { width: 2560, height: 1440 };

// The canvas a clip is rendered on: the brief's, or its landscape one.
export const clipVideo = (id: ClipId, landscape: boolean): Video => {
  const { video } = videoBrief(id);
  if (!landscape) return video;
  if (!LANDSCAPE_CLIPS.includes(id)) throw new Error(`${id} has no landscape render`);
  return { ...video, ...LANDSCAPE_CANVAS };
};

export const clipBrief = (id: ClipId): ClipBrief => {
  const { brief, video } = videoBrief(id);
  const inApp = IN_APP_BACKGROUND[id];
  return {
    video,
    loop: brief.loop,
    background: inApp
      ? { light: palette("light")[inApp], dark: palette("dark")[inApp] }
      : { light: brief.background.light, dark: brief.background.dark },
    poster: posterOf(id, brief.still, video.durationInFrames),
  };
};
