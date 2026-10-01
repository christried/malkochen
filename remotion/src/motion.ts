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
//
// Frame 0 is the still (the SVG), so every layer must be at rest at frame 0.
// A delayed layer is at phase −delay/duration then, so staggered layers (the
// three steam wisps at phases 0, ⅓ and ⅔, say) animate inside a rest window
// short enough to leave all their frame-0 phases at rest.

export type Pose = {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
};

export const REST: Pose = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1 };

// `ease` overrides the loop's easing for the segment that starts here.
export type Keyframe = { at: number; ease?: string } & Partial<Pose>;

export const uniformScale = (scale: number) => ({ scaleX: scale, scaleY: scale });

const ANIMATIONS: Record<string, Keyframe[]> = {
  // pasta fork: translateY −10 · rotate −10°, 0 / 50 / 100%
  twirl: [{ at: 0 }, { at: 0.5, y: -10, rotate: -10 }, { at: 1 }],
  // ramen, dumplings (phases 0, ⅓, ⅔), bread (0, ½): each wisp rises to −14
  // and fades out, comes back in from +6, and rests for the rest of the loop.
  steam: [
    { at: 0 },
    { at: 0.2, y: -14, opacity: 0 },
    { at: 0.21, y: 6, opacity: 0 },
    { at: 0.32 },
    { at: 1 },
  ],
  // curry (phases 0, ⅓, ⅔): each bubble swells to 1.35 and pops, grows back
  // from .2, and rests.
  bub: [
    { at: 0 },
    { at: 0.15, opacity: 0, ...uniformScale(1.35) },
    { at: 0.16, opacity: 0, ...uniformScale(0.2) },
    { at: 0.32 },
    { at: 1 },
  ],
  // bowl (phases 0, 11/12, ⅚): y −7 at the brief's apex (50%), squash
  // 1.08/.92 on landing, at rest again before ⅚.
  hop: [
    { at: 0 },
    { at: 0.5, y: -7 },
    { at: 0.68, scaleX: 1.08, scaleY: 0.92 },
    { at: 0.8 },
    { at: 1 },
  ],
  // salad: y −4 · rotate −5°, 0 / 50 / 100%
  sway: [{ at: 0 }, { at: 0.5, y: -4, rotate: -5 }, { at: 1 }],
  // burger bun: y −14 · rotate −5°, lands squashed at 60% and springs back
  // (spring(0.6, 400): damping ratio .6, stiffness 400), settled by 82%.
  lid: [
    { at: 0 },
    { at: 0.35, y: -14, rotate: -5 },
    { at: 0.6, scaleX: 1.08, scaleY: 0.92, ease: "spring(0.6, 400)" },
    { at: 0.82 },
    { at: 1 },
  ],
  // tacos (phases 0, ½): rotate ±7° about the bottom, upright at 0 and ½.
  // Out-then-in easing per quarter makes a smooth swing through upright.
  wig: [
    { at: 0, ease: "ease-out" },
    { at: 0.25, rotate: 7, ease: "ease-in" },
    { at: 0.5, ease: "ease-out" },
    { at: 0.75, rotate: -7, ease: "ease-in" },
    { at: 1 },
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
  // wok veg (phases 0 to .93): y −26 and a full turn, back in the pan by 90%
  toss: [
    { at: 0 },
    { at: 0.45, y: -26, rotate: 180 },
    { at: 0.9, rotate: 360 },
    { at: 1, rotate: 360 },
  ],
  // porridge drop: falls y +34, vanishes on impact at 45%, fades back in on top
  fall: [
    { at: 0 },
    { at: 0.45, y: 34 },
    { at: 0.48, y: 34, opacity: 0 },
    { at: 0.8, opacity: 0 },
    { at: 1 },
  ],
  // porridge ripple: the still's ripple fades, then spreads .3→1.4 from the
  // impact at 45% and settles back into place.
  ripple: [
    { at: 0 },
    { at: 0.2, opacity: 0 },
    { at: 0.45, opacity: 0, ...uniformScale(0.3) },
    { at: 0.5, ...uniformScale(0.6) },
    { at: 0.8, opacity: 0, ...uniformScale(1.4) },
    { at: 0.85, opacity: 0 },
    { at: 1 },
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
  // cake sparks (phases 0, ½): wink out, then scale 0→1 back in
  spark: [{ at: 0 }, { at: 0.15, ...uniformScale(0) }, { at: 0.35 }, { at: 1 }],
  // wrap sheet: scaleX .08↔1 about the left edge. Open in the still, so the
  // brief's rolled 0–15 / 85–100% moves half a loop on, to 35–65%.
  roll: [
    { at: 0 },
    { at: 0.35, scaleX: 0.08 },
    { at: 0.65, scaleX: 0.08 },
    { at: 1 },
  ],
  // wrap roll: 1.12 while rolled, 1 while the sheet is out
  rollc: [
    { at: 0 },
    { at: 0.35, ...uniformScale(1.12) },
    { at: 0.65, ...uniformScale(1.12) },
    { at: 1 },
  ],
  // smoothie (phases 0, ⅓, ⅔): each bubble rises y 0→−38 and fades, fades
  // back in where it started, and rests.
  up: [
    { at: 0 },
    { at: 0.22, y: -38, opacity: 0 },
    { at: 0.23, opacity: 0 },
    { at: 0.32 },
    { at: 1 },
  ],
  // eintopf lid: lifted y −3, rotate ±4° twice, rattle 0–32%, then rest
  rattle: [
    { at: 0 },
    { at: 0.04, y: -3, rotate: 4 },
    { at: 0.12, y: -3, rotate: -4 },
    { at: 0.2, y: -3, rotate: 4 },
    { at: 0.28, y: -3, rotate: -4 },
    { at: 0.32 },
    { at: 1 },
  ],
  // eintopf puffs (phases 0, .84): each grows to 1.3 and fades, comes back
  // from .4, and rests.
  puff: [
    { at: 0 },
    { at: 0.3, opacity: 0, ...uniformScale(1.3) },
    { at: 0.31, opacity: 0, ...uniformScale(0.4) },
    { at: 0.6 },
    { at: 1 },
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

// A damped spring released at 0 and settling on 1 over a segment lasting
// `seconds`, scaled to end exactly on 1.
const springEasing = (dampingRatio: number, stiffness: number, seconds: number) => {
  const natural = Math.sqrt(stiffness);
  const damped = natural * Math.sqrt(1 - dampingRatio * dampingRatio);
  const at = (t: number) => {
    const time = t * seconds;
    return (
      1 -
      Math.exp(-dampingRatio * natural * time) *
        (Math.cos(damped * time) +
          ((dampingRatio * natural) / damped) * Math.sin(damped * time))
    );
  };
  const end = at(1);
  return (t: number) => at(t) / end;
};

const easingFor = (easing: string, seconds: number | undefined) => {
  const spring = easing.match(/^spring\(([\d.]+),\s*([\d.]+)\)$/);
  if (spring) {
    if (seconds === undefined) throw new Error(`${easing} needs the segment's length in seconds`);
    return springEasing(Number(spring[1]), Number(spring[2]), seconds);
  }
  const custom = easing.match(/^cubic-bezier\(([^)]*)\)$/);
  const points = custom
    ? (custom[1].split(",").map(Number) as [number, number, number, number])
    : BEZIERS[easing];
  if (!points) throw new Error(`Unknown easing: ${easing}`);
  return Easing.bezier(...points);
};

// The pose at `t` along keyframes ordered by `at`, held before the first and
// after the last. `secondsPerUnit` converts a segment's span to seconds, which
// only spring easings need. Like CSS, the easing applies to each keyframe
// segment, not the whole run.
export const interpolateKeyframes = (
  keyframes: Keyframe[],
  t: number,
  easing: string,
  secondsPerUnit?: number,
): Pose => {
  const next = keyframes.findIndex((k) => k.at > t);
  const from = keyframes[Math.max(0, next - 1)];
  const to = keyframes[next === -1 ? keyframes.length - 1 : next];
  const span = to.at - from.at;
  const progress =
    span === 0
      ? 0
      : easingFor(
          from.ease ?? easing,
          secondsPerUnit === undefined ? undefined : span * secondsPerUnit,
        )((t - from.at) / span);

  const pose = { ...REST };
  for (const key of Object.keys(REST) as (keyof Pose)[]) {
    const a = from[key] ?? REST[key];
    const b = to[key] ?? REST[key];
    pose[key] = a + (b - a) * progress;
  }
  return pose;
};

export const poseAt = (spec: string, frame: number, fps: number): Pose => {
  const { animation, durationS, easing, delayS } = parseLoop(spec);
  const keyframes = ANIMATIONS[animation];
  if (!keyframes) throw new Error(`No keyframes for animation "${animation}"`);

  // Work in frames so that whole-frame delays give exact phases.
  const period = durationS * fps;
  const shifted = (((frame - delayS * fps) % period) + period) % period;
  return interpolateKeyframes(keyframes, shifted / period, easing, durationS);
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
