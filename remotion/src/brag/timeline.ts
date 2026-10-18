// The brag video's timeline (#313): 20s at 30fps, its 120 BPM soundtrack
// a beat every 15 frames. Shared by the composition and the soundtrack
// (scripts/brag-audio.ts), so the effects hit what the picture does.
// Frames, never seconds.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BEAT = 15;
export const DURATION = 40 * BEAT;

// The captured shots of the real app (capture/capture.ts): which frames of
// each the video plays, from `from` up to `to` (its last), and where it starts them.
export type ShotName = "share" | "plan" | "cook";

export const SHOTS: Record<ShotName, { at: number; from: number; to: number }> = {
  share: { at: 200, from: 6, to: 103 },
  plan: { at: 298, from: 3, to: 110 },
  cook: { at: 406, from: 3, to: 83 },
};

const end = (shot: ShotName) => SHOTS[shot].at + SHOTS[shot].to - SHOTS[shot].from;

export const SCENES = {
  hook: { from: 0, to: 75 },
  reveal: { from: 75, to: 165 },
  // The phone, from the shared video to the last cooked frame.
  phone: { from: 150, to: end("cook") + 8 },
  // Inside it, before the app: a food video, shared to malkochen, until
  // the app has opened over it.
  shareIntro: { from: 150, to: SHOTS.share.at + 12 },
  outro: { from: end("cook"), to: DURATION },
} as const;

// The plan shot's tap on the "Diese Woche" tab: the Board's tint turns
// from Ideen's butter to its orchid.
export const TAB_SWITCH = SHOTS.plan.at + 72;

// What the captions over the phone say, and when.
export const CAPTIONS = [
  { from: 168, to: SHOTS.plan.at, text: "Found it on TikTok? Share it." },
  { from: SHOTS.plan.at, to: SHOTS.cook.at, text: "Plan the week together." },
  { from: SHOTS.cook.at, to: end("cook"), text: "Then actually cook it." },
];

// The made-up share before the app: the share icon, then malkochen's.
export const INTRO_TAPS = { share: 174, malkochen: 194 };

// A shot's frame of the real app at a video frame, null outside it.
export const shotFrame = (shot: ShotName, frame: number) => {
  const { at, from, to } = SHOTS[shot];
  const f = frame - at + from;
  return frame >= at && f <= to ? f : null;
};

// The shot playing at a frame (the last one holds its final frame).
export const shotAt = (frame: number): { shot: ShotName; frame: number } | null => {
  for (const shot of ["cook", "plan", "share"] as const) {
    if (frame >= SHOTS[shot].at) return { shot, frame: Math.min(shotFrame(shot, frame) ?? SHOTS[shot].to, SHOTS[shot].to) };
  }
  return null;
};

// The poster: the outro settled (Topfbert, the name, the three words). It
// is also frame 0 of the video (Brag.tsx), for every platform's thumbnail.
export const POSTER_FRAME = 580;
