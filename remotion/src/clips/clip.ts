import type React from "react";
import type { PlaceholderTheme } from "../../../shared/placeholders";
import { interpolateKeyframes, type Keyframe, type Pose } from "../motion";

// A state, system or celebration clip (REMOTION.md). Its timeline,
// poses(frame), is pure: the pose of every moving part at any frame, which is
// what the tests check. Its Scene draws those poses with the handoff's art.

export type Theme = PlaceholderTheme;
export type Poses = Record<string, Pose>;

// Every brief is 30 fps.
export const FPS = 30;

// A handoff SVG's drawing, without its <svg> wrapper.
export type Svg = { viewBox: [number, number, number, number]; markup: string };

export type Mood = "happy" | "stir" | "oops" | "wow" | "sleep";
export type MoodLayer = { name: string; markup: string };

// The handoff art a clip draws with, loaded by calculateMetadata: SVGs by
// their path under assets/, Topfbert's layers by mood.
export type Art = {
  svgs: Record<string, Svg>;
  topfbert: Partial<Record<Mood, MoodLayer[]>>;
};

export type SceneProps = {
  theme: Theme;
  // The brief's baked-in background for this theme.
  background: string;
  poses: Poses;
  art: Art;
  width: number;
  height: number;
};

export type Clip = {
  id: string;
  poses: (frame: number) => Poses;
  art: { svgs?: string[]; topfbert?: Mood[] };
  Scene: React.FC<SceneProps>;
};

// The pose at `t` frames along keyframes whose `at` is in frames, held before
// the first and after the last.
export const keys = (t: number, keyframes: Keyframe[], easing = "ease-in-out"): Pose =>
  interpolateKeyframes(keyframes, t, easing, 1 / FPS);

// Where `frame` falls in a cycle of `period` frames that starts at `start`.
export const cycle = (frame: number, period: number, start = 0) =>
  (((frame - start) % period) + period) % period;

// A sine swing between −amplitude (at `start`) and +amplitude half a period
// later: seamless over any whole number of periods.
export const swing = (frame: number, period: number, amplitude: number, start = 0) =>
  -amplitude * Math.cos((2 * Math.PI * (frame - start)) / period);

// One pose on top of another: offsets and turns add, scales and opacities
// multiply. For an entrance played over a part's ongoing motion.
export const stack = (a: Pose, b: Pose): Pose => ({
  x: a.x + b.x,
  y: a.y + b.y,
  rotate: a.rotate + b.rotate,
  scaleX: a.scaleX * b.scaleX,
  scaleY: a.scaleY * b.scaleY,
  opacity: a.opacity * b.opacity,
});
