import { REST, type Keyframe, type Pose } from "../motion";
import { cycle, keys, swing, type MoodLayer, type Mood, type Poses, type Svg } from "./clip";
import { placement, poseTransform } from "./draw";

// Topfbert, the mascot, from his numbered layers (assets/topfbert/layers.json),
// stacked by z in his 140×150 viewBox. His own motions are the ones layers.json
// lists, retimed to whole fractions of each clip so every loop stays seamless.
// Frame 0 of each cycle is the still: eyes open, hat as drawn, steam showing.

export const TOPFBERT_VIEWBOX: Svg["viewBox"] = [0, -20, 140, 150];

// Pivots in his viewBox units (layers.json).
const PIVOTS: Record<string, [number, number]> = {
  whole: [70, 130],
  hat: [36, 46],
  eyes: [70, 73],
  spoon: [71.5, 54.4],
  steam_1: [88, 28],
  steam_2: [104, 30],
  spark_1: [118, 20],
  spark_2: [7, 83],
  spark_3: [128.5, 88.5],
  drop: [118, 63],
  "z_1.0": [116, 26],
  "z_1.1": [125, 15],
};

// Keyframes over one cycle, `at` from 0 to 1.
type Cycle = Keyframe[];

const along = (frame: number, period: number, keyframes: Cycle, easing?: string, start = 0) =>
  keys(
    cycle(frame, period, start),
    keyframes.map((k) => ({ ...k, at: k.at * period })),
    easing,
  );

const squash = (scaleX: number, scaleY: number) => ({ scaleX, scaleY });

// "y 0→−4 (45–55%) scale .98/1.03, 90% y+1 scale 1.03/.97"
const BOB: Cycle = [
  { at: 0 },
  { at: 0.45, y: -4, ...squash(0.98, 1.03) },
  { at: 0.55, y: -4, ...squash(0.98, 1.03) },
  { at: 0.9, y: 1, ...squash(1.03, 0.97) },
  { at: 1 },
];
// oops: "rotate −6°→−2° + x 2px", there and back.
const WOBBLE: Cycle = [{ at: 0, rotate: -6 }, { at: 0.5, rotate: -2, x: 2 }, { at: 1, rotate: -6 }];
// "rotate −14°↔−9° + y −2": the drawn hat is at −14°.
const HAT: Cycle = [{ at: 0 }, { at: 0.5, rotate: 5, y: -2 }, { at: 1 }];
// "alpha 0→.8→0, y +6→−14, scaleY .8→1.1": as drawn at 0, rises and fades,
// comes back in from below.
const STEAM: Cycle = [
  { at: 0 },
  { at: 0.45, y: -10, scaleY: 1.1, opacity: 0 },
  { at: 0.46, y: 6, scaleY: 0.8, opacity: 0 },
  { at: 1 },
];
// "blink scaleY 1→.1→1 at 92–100%"
const BLINK: Cycle = [{ at: 0 }, { at: 0.92 }, { at: 0.96, scaleY: 0.1 }, { at: 1 }];
// wow: "scale 0→1→0, rotate 0→90°"
const SPARK: Cycle = [
  { at: 0, ...squash(0, 0) },
  { at: 0.5, rotate: 45 },
  { at: 1, rotate: 90, ...squash(0, 0) },
];
// sleep: "rise y 0→−8 and fade", drifting up and right.
const Z: Cycle = [
  { at: 0, x: -4, y: 4, opacity: 0 },
  { at: 0.25 },
  { at: 1, x: 6, y: -8, opacity: 0 },
];
// oops: "appear scale 0→1 at 20–30%, fall … and fade 80–100%", on the
// lookup-failed brief's frames (f14–22, f58 of 72).
const DROP: Cycle = [
  { at: 0, ...squash(0, 0) },
  { at: 14 / 72, ...squash(0, 0) },
  { at: 22 / 72 },
  { at: 58 / 72, ease: "ease-in" },
  { at: 1, y: 10, opacity: 0 },
];

export type TopfbertTiming = {
  // Frames per bob (wobble for oops), hat sway and steam: a whole fraction
  // of the clip.
  period: number;
  // Frames per blink, happy only.
  blink?: number;
};

// Topfbert's own motion at `frame`: "topfbert" for the whole character, and
// "topfbert.<layer>" for each moving layer.
export const topfbertPoses = (mood: Mood, frame: number, { period, blink }: TopfbertTiming): Poses => {
  const poses: Poses = {
    topfbert: along(frame, period, mood === "oops" ? WOBBLE : BOB),
    "topfbert.hat": along(frame, period, HAT),
  };
  if (mood === "happy" || mood === "wow") {
    // steam_2 trails by .9s of steam_1's 2.2s.
    poses["topfbert.steam_1"] = along(frame, period, STEAM, "ease-out");
    poses["topfbert.steam_2"] = along(frame, period, STEAM, "ease-out", Math.round(period * 0.41));
  }
  if (mood === "happy" && blink) poses["topfbert.eyes"] = along(frame, blink, BLINK);
  if (mood === "wow") {
    // 42f cycle, offsets 0 / 15 / 27f (topfbert-wow brief).
    [0, 15, 27].forEach((start, i) => {
      poses[`topfbert.spark_${i + 1}`] = along(frame, 42, SPARK, "ease-in-out", start);
    });
  }
  if (mood === "stir") {
    // "spoon −20°, +20° at f18 (cycle 36f)"
    poses["topfbert.spoon"] = { ...REST, rotate: swing(frame, 36, 20) };
  }
  if (mood === "sleep") {
    // Two z's, the second half a cycle behind.
    poses["topfbert.z_1.0"] = along(frame, period, Z, "ease-out");
    poses["topfbert.z_1.1"] = along(frame, period, Z, "ease-out", period / 2);
  }
  if (mood === "oops") poses["topfbert.drop"] = along(frame, period, DROP);
  return poses;
};

const layerGroup = (key: string, markup: string, pose: Pose | undefined) => (
  <g
    key={key}
    transform={pose ? poseTransform(pose, PIVOTS[key] ?? [70, 55]) : undefined}
    opacity={pose?.opacity}
    dangerouslySetInnerHTML={{ __html: markup }}
  />
);

// Topfbert `width` canvas px wide with his viewBox's top-left at x, y.
// `inPot` is drawn in his viewBox units just behind the rim, so things can
// sit in the pot, and `front` over everything. Layers named in `hide` are
// left out.
export const Topfbert: React.FC<{
  layers: MoodLayer[];
  poses: Poses;
  x: number;
  y: number;
  width: number;
  inPot?: React.ReactNode;
  front?: React.ReactNode;
  hide?: string[];
  filter?: string;
}> = ({ layers, poses, x, y, width, inPot, front, hide = [], filter }) => (
  <g transform={placement({ viewBox: TOPFBERT_VIEWBOX, markup: "" }, x, y, width)} style={{ filter }}>
    <g
      transform={poses.topfbert ? poseTransform(poses.topfbert, PIVOTS.whole) : undefined}
      opacity={poses.topfbert?.opacity}
    >
      {layers
        .filter((layer) => !hide.includes(layer.name))
        .flatMap((layer) => {
          const drawn = [];
          if (layer.name === "rim" && inPot) drawn.push(<g key="in-pot">{inPot}</g>);
          // A layer of several pieces that move apart (sleep's two z's).
          if (poses[`topfbert.${layer.name}.0`]) {
            const pieces = layer.markup.match(/<text[\s\S]*?<\/text>/g) ?? [];
            pieces.forEach((piece, i) => {
              const key = `${layer.name}.${i}`;
              drawn.push(layerGroup(key, piece, poses[`topfbert.${key}`]));
            });
          } else {
            drawn.push(layerGroup(layer.name, layer.markup, poses[`topfbert.${layer.name}`]));
          }
          return drawn;
        })}
      {front}
    </g>
  </g>
);

export const topfbertHeight = (width: number) => (width * TOPFBERT_VIEWBOX[3]) / TOPFBERT_VIEWBOX[2];
