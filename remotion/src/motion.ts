import { Easing } from "remotion";

// The motion of one animated layer at one frame. Each layer in the handoff's
// layers.json names its loop like a CSS animation ("steam 2.7s ease-out .9s
// infinite"); the keyframes behind each name are written down here from the
// "Animate" line of the briefs in REMOTION.md. Distances are in viewBox units
// (the dishes are drawn in 0 0 120 120), angles in degrees.
//
// Seamless by construction: the pose depends only on the phase within the
// loop, a delay is a phase offset, and every animation ends looking the way it
// starts.

export type Pose = {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
};

const REST: Pose = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1 };

type Keyframe = { at: number } & Partial<Pose>;

// Uniform scale, for keyframes.
const s = (scale: number) => ({ scaleX: scale, scaleY: scale });

const ANIMATIONS: Record<string, Keyframe[]> = {
  // pasta fork: translateY −10 · rotate −10°, 0 / 50 / 100%
  twirl: [{ at: 0 }, { at: 0.5, y: -10, rotate: -10 }, { at: 1 }],
  // ramen, dumplings, bread: alpha 0→.85→0 · y +6→−14
  steam: [
    { at: 0, opacity: 0, y: 6 },
    { at: 0.35, opacity: 0.85, y: -2 },
    { at: 1, opacity: 0, y: -14 },
  ],
  // curry: scale .2→1→1.35 · alpha
  bub: [
    { at: 0, opacity: 0, ...s(0.2) },
    { at: 0.35, opacity: 1, ...s(1) },
    { at: 1, opacity: 0, ...s(1.35) },
  ],
  // bowl: y −7, then squash 1.08/.92 on landing
  hop: [
    { at: 0 },
    { at: 0.35, y: -7, scaleX: 0.96, scaleY: 1.05 },
    { at: 0.6, scaleX: 1.08, scaleY: 0.92 },
    { at: 0.75 },
    { at: 1 },
  ],
  // salad: y −4 · rotate −5°, 0 / 50 / 100%
  sway: [{ at: 0 }, { at: 0.5, y: -4, rotate: -5 }, { at: 1 }],
  // burger bun: y −14 · rotate −5° → squash, 0/35/60/72/82%
  lid: [
    { at: 0 },
    { at: 0.35, y: -14, rotate: -5 },
    { at: 0.6, scaleX: 1.08, scaleY: 0.92 },
    { at: 0.72, scaleX: 0.97, scaleY: 1.03 },
    { at: 0.82 },
    { at: 1 },
  ],
  // tacos: rotate ±7° about the bottom, a pendulum
  wig: [
    { at: 0, rotate: -7 },
    { at: 0.5, rotate: 7 },
    { at: 1, rotate: -7 },
  ],
  // pizza slice: x +10 · y −14 · rotate −8°, held 45–65%
  slice: [
    { at: 0 },
    { at: 0.45, x: 10, y: -14, rotate: -8 },
    { at: 0.65, x: 10, y: -14, rotate: -8 },
    { at: 1 },
  ],
  // wok pan: rotate −6°
  pan: [{ at: 0 }, { at: 0.5, rotate: -6 }, { at: 1 }],
  // wok veg: y −26 and a full turn
  toss: [{ at: 0 }, { at: 0.5, y: -26, rotate: 180 }, { at: 1, rotate: 360 }],
  // porridge drop: falls y +34, vanishes on impact at 45%, fades back in on top
  fall: [
    { at: 0 },
    { at: 0.45, y: 34 },
    { at: 0.48, y: 34, opacity: 0 },
    { at: 0.8, opacity: 0 },
    { at: 1 },
  ],
  // porridge ripple: scale .3→1.4 from the impact at 45%
  ripple: [
    { at: 0, opacity: 0, ...s(0.3) },
    { at: 0.45, opacity: 0, ...s(0.3) },
    { at: 0.5, opacity: 1, ...s(0.6) },
    { at: 1, opacity: 0, ...s(1.4) },
  ],
  // bread loaf: scale 1.04 × 1.10 about the bottom
  rise: [{ at: 0 }, { at: 0.5, scaleX: 1.04, scaleY: 1.1 }, { at: 1 }],
  // cake berry: y −10, then squash
  berry: [
    { at: 0 },
    { at: 0.4, y: -10 },
    { at: 0.65, scaleX: 1.12, scaleY: 0.88 },
    { at: 0.8 },
    { at: 1 },
  ],
  // cake sparks: scale 0→1 and back, with a twinkle turn
  spark: [
    { at: 0, ...s(0) },
    { at: 0.25, rotate: 45, ...s(1) },
    { at: 0.5, rotate: 90, ...s(0) },
    { at: 1, rotate: 90, ...s(0) },
  ],
  // wrap sheet: scaleX .08↔1 about the left edge, rolled 0–15 / 85–100%
  roll: [
    { at: 0, scaleX: 0.08 },
    { at: 0.15, scaleX: 0.08 },
    { at: 0.5 },
    { at: 0.85, scaleX: 0.08 },
    { at: 1, scaleX: 0.08 },
  ],
  // wrap roll: fat (1.12) while rolled, 1 while the sheet is out
  rollc: [
    { at: 0, ...s(1.12) },
    { at: 0.15, ...s(1.12) },
    { at: 0.5 },
    { at: 0.85, ...s(1.12) },
    { at: 1, ...s(1.12) },
  ],
  // smoothie bubbles: y 0→−38 · alpha
  up: [
    { at: 0, opacity: 0 },
    { at: 0.2, opacity: 1, y: -7.6 },
    { at: 1, opacity: 0, y: -38 },
  ],
  // eintopf lid: y −3 · rotate ±4° twice, rattle 0–32%, then rest
  rattle: [
    { at: 0 },
    { at: 0.08, y: -3, rotate: 4 },
    { at: 0.16, rotate: -4 },
    { at: 0.24, y: -3, rotate: 4 },
    { at: 0.32 },
    { at: 1 },
  ],
  // eintopf steam puffs: scale + alpha
  puff: [
    { at: 0, opacity: 0, ...s(0.4) },
    { at: 0.15, opacity: 0.9, ...s(0.8) },
    { at: 0.45, opacity: 0, ...s(1.3) },
    { at: 1, opacity: 0, ...s(1.3) },
  ],
};

export type Loop = {
  animation: string;
  durationS: number;
  easing: string;
  delayS: number;
};

export const parseLoop = (spec: string): Loop => {
  const match = spec.match(
    /^(\S+)\s+([\d.]+)s\s+(cubic-bezier\([^)]*\)|\S+)(?:\s+(-?[\d.]+)s)?\s+infinite$/,
  );
  if (!match) throw new Error(`Unreadable loop: ${spec}`);
  return {
    animation: match[1],
    durationS: Number(match[2]),
    easing: match[3],
    delayS: match[4] ? Number(match[4]) : 0,
  };
};

const BEZIERS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const easingFor = (easing: string) => {
  const custom = easing.match(/^cubic-bezier\(([^)]*)\)$/);
  const points = custom
    ? (custom[1].split(",").map(Number) as [number, number, number, number])
    : BEZIERS[easing];
  if (!points) throw new Error(`Unknown easing: ${easing}`);
  return Easing.bezier(...points);
};

// Like CSS, the easing applies to each keyframe segment, not the whole loop.
export const poseAt = (spec: string, frame: number, fps: number): Pose => {
  const { animation, durationS, easing, delayS } = parseLoop(spec);
  const keyframes = ANIMATIONS[animation];
  if (!keyframes) throw new Error(`No keyframes for animation "${animation}"`);

  // Work in frames so that whole-frame delays give exact phases.
  const period = durationS * fps;
  const shifted = (((frame - delayS * fps) % period) + period) % period;
  const phase = shifted / period;

  const next = keyframes.findIndex((k) => k.at > phase);
  const from = keyframes[Math.max(0, next - 1)];
  const to = keyframes[next === -1 ? keyframes.length - 1 : next];
  const progress =
    to.at === from.at ? 0 : easingFor(easing)((phase - from.at) / (to.at - from.at));

  const pose = { ...REST };
  for (const key of Object.keys(REST) as (keyof Pose)[]) {
    const a = from[key] ?? REST[key];
    const b = to[key] ?? REST[key];
    pose[key] = a + (b - a) * progress;
  }
  return pose;
};

const invisible = (pose: Pose) =>
  pose.opacity < 0.001 ||
  Math.abs(pose.scaleX) < 0.001 ||
  Math.abs(pose.scaleY) < 0.001;

// Whether two poses render the same: anything invisible looks alike, and a
// full turn looks like no turn.
export const looksSame = (a: Pose, b: Pose): boolean => {
  if (invisible(a) && invisible(b)) return true;
  const turn = (((a.rotate - b.rotate) % 360) + 360) % 360;
  return (
    Math.min(turn, 360 - turn) < 0.01 &&
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.scaleX - b.scaleX) < 0.001 &&
    Math.abs(a.scaleY - b.scaleY) < 0.001 &&
    Math.abs(a.opacity - b.opacity) < 0.001
  );
};
