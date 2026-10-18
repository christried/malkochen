// The brag video's timeline (#313), on the beat grid of its music: "Joyful
// Rhythm Walk Funk" by lightbeatsmusic (Pixabay), 115 BPM, from its beat 9
// (two bars before the groove drops in) to its beat 65 (the end of its
// one-bar break). Shared by the composition, the soundtrack
// (scripts/brag-audio.ts) and the capture (capture/capture.ts), which
// records the app so that its taps land on these beats too. Everything is
// counted in beats of the video (0 = the first frame); `beat()` turns a
// beat into the nearest frame, never off by more than half a frame.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const MUSIC = {
  // In out/brag (copied there by scripts/render-brag.ts).
  file: "music.mp3",
  bpm: 115,
  // The song's beat 0, in seconds; its bars start on beats 1, 5, 9, …
  firstBeat: 0.016,
  // The song's beats the video plays, from and up to.
  from: 9,
  to: 65,
};

const BEAT_FRAMES = (60 / MUSIC.bpm) * FPS;
export const beat = (b: number) => Math.round(b * BEAT_FRAMES);
// Where in the song (seconds) the video starts.
export const MUSIC_START = MUSIC.firstBeat + (MUSIC.from * 60) / MUSIC.bpm;

export const DURATION = beat(MUSIC.to - MUSIC.from);

// The moments, in beats. Bars start on 0, 4, 8, …; the groove drops in on
// 8 and stops for the break on 52.
export const CUE = {
  saved: 0,
  never: 4,
  drop: 8,
  malkochen: 9,
  phone: 12,
  shareIcon: 13,
  malkochenIcon: 15,
  // The shots of the real app, each from its first beat.
  share: 16,
  save: 20,
  plan: 24,
  lift: 24.5,
  landed: 28,
  dieseWoche: 30,
  columns: 32,
  switcher: 33,
  gear: 34,
  typing: 34.75,
  add: 37,
  back: 38.5,
  cook: 40,
  cookTab: 40.5,
  cooked: 42,
  outro: 48,
  name: 49,
  steps: 50,
  breakdown: 52,
} as const;

// The captured shots, in order: each starts at its beat, its frame 0 there.
export type ShotName = "share" | "plan" | "columns" | "cook";
export const SHOT_ORDER: ShotName[] = ["share", "plan", "columns", "cook"];
const SHOT_BEATS: Record<ShotName, [number, number]> = {
  share: [CUE.share, CUE.plan],
  plan: [CUE.plan, CUE.columns],
  columns: [CUE.columns, CUE.cook],
  cook: [CUE.cook, CUE.outro],
};
export const SHOTS = Object.fromEntries(
  SHOT_ORDER.map((s) => [s, { at: beat(SHOT_BEATS[s][0]), frames: beat(SHOT_BEATS[s][1]) - beat(SHOT_BEATS[s][0]) }]),
) as Record<ShotName, { at: number; frames: number }>;

// A cue's frame within its shot (what capture.ts ticks to).
export const shotCue = (shot: ShotName, cue: number) => beat(cue) - SHOTS[shot].at;

export const SCENES = {
  hook: { from: 0, to: beat(CUE.drop) },
  reveal: { from: beat(CUE.drop), to: beat(CUE.phone) + 6 },
  phone: { from: beat(CUE.phone), to: beat(CUE.outro) + 8 },
  // Inside it, before the app: a food video, shared to malkochen, until
  // the app has opened over it.
  shareIntro: { from: beat(CUE.phone), to: beat(CUE.share) + 12 },
  outro: { from: beat(CUE.outro), to: DURATION },
} as const;

// What the captions over the phone say, and when.
export const CAPTIONS = [
  { from: beat(CUE.phone) + 4, to: beat(CUE.plan), text: "Auf TikTok entdeckt? Einfach teilen." },
  { from: beat(CUE.plan), to: beat(CUE.columns), text: "Plant gemeinsam die Woche." },
  { from: beat(CUE.columns), to: beat(CUE.cook), text: "Spalten, wie ihr sie braucht." },
  { from: beat(CUE.cook), to: beat(CUE.outro), text: "Und dann wirklich kochen." },
];

// The made-up share before the app: the share icon, then malkochen's. A
// tap acts as the finger lifts, on the beat.
export const INTRO_TAPS = { share: beat(CUE.shareIcon), malkochen: beat(CUE.malkochenIcon) };

// The shot playing at a frame, and its frame (the last one holds).
export const shotAt = (frame: number): { shot: ShotName; frame: number } | null => {
  for (const shot of [...SHOT_ORDER].reverse()) {
    const { at, frames } = SHOTS[shot];
    if (frame >= at) return { shot, frame: Math.min(frame - at, frames - 1) };
  }
  return null;
};

// The page's tint: the Column the phone shows (Ideen's butter, Diese
// Woche's orchid), the settings page's plain ground, then butter again.
export const TINTS: [number, "bg" | "butter" | "orchid"][] = [
  [0, "bg"],
  [beat(CUE.drop), "bg"],
  [beat(CUE.drop) + 15, "butter"],
  [beat(CUE.dieseWoche), "butter"],
  [beat(CUE.dieseWoche) + 14, "orchid"],
  [beat(CUE.gear), "orchid"],
  [beat(CUE.gear) + 14, "bg"],
  [beat(CUE.back), "bg"],
  [beat(CUE.back) + 14, "butter"],
  [beat(CUE.cookTab), "butter"],
  [beat(CUE.cookTab) + 14, "orchid"],
  [beat(CUE.outro), "orchid"],
  [beat(CUE.outro) + 12, "butter"],
];

// The poster: the end card settled. It is also frame 0 of the video
// (Brag.tsx), for every platform's thumbnail.
export const POSTER_FRAME = beat(CUE.breakdown + 3);
