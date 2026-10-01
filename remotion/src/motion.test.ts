import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACEHOLDERS } from "../../shared/placeholders";
import { FPS, placeholderBrief } from "./briefs";
import { looksSame, parseLoop, poseAt } from "./motion";

// Motion is checked by eye in Remotion Studio (spec). What can be checked here
// is the loop maths: every animated layer the handoff lists has a motion, fits
// its clip length exactly, actually moves, and comes back to frame 0 seamlessly.

const ILLUSTRATIONS = join(
  __dirname,
  "../../docs/design handoff/assets/illustrations",
);

type LayerSpec = { name: string; animated: boolean; loop: string | null };

const animatedLayers = (dish: string): LayerSpec[] => {
  const layers = JSON.parse(
    readFileSync(join(ILLUSTRATIONS, dish, "layers.json"), "utf8"),
  );
  return (layers.light as LayerSpec[]).filter((l) => l.animated);
};

describe("parseLoop", () => {
  it("reads name, duration, easing and delay from a layers.json loop", () => {
    expect(parseLoop("steam 2.7s ease-out .9s infinite")).toEqual({
      animation: "steam",
      durationS: 2.7,
      easing: "ease-out",
      delayS: 0.9,
    });
  });

  it("keeps a cubic-bezier easing whole and reads a negative delay", () => {
    expect(parseLoop("toss 2.4s cubic-bezier(.3,.6,.4,1) -.08s infinite")).toEqual({
      animation: "toss",
      durationS: 2.4,
      easing: "cubic-bezier(.3,.6,.4,1)",
      delayS: -0.08,
    });
  });

  it("defaults the delay to 0", () => {
    expect(parseLoop("twirl 3s ease-in-out infinite").delayS).toBe(0);
  });
});

describe("poseAt", () => {
  it("reaches the brief's apex halfway through the pasta fork's twirl", () => {
    const apex = poseAt("twirl 3s ease-in-out infinite", 45, FPS);
    expect(apex.y).toBeCloseTo(-10);
    expect(apex.rotate).toBeCloseTo(-10);
  });

  it("turns a delay into a phase offset", () => {
    expect(poseAt("steam 2.7s ease-out .9s infinite", 27, FPS)).toEqual(
      poseAt("steam 2.7s ease-out infinite", 0, FPS),
    );
  });
});

describe("looksSame", () => {
  const rest = poseAt("twirl 3s ease-in-out infinite", 0, FPS);

  it("treats two invisible poses as the same, wherever they are", () => {
    expect(
      looksSame({ ...rest, opacity: 0, y: 6 }, { ...rest, opacity: 0, y: -14 }),
    ).toBe(true);
  });

  it("treats a full turn as no turn", () => {
    expect(looksSame({ ...rest, rotate: 360 }, rest)).toBe(true);
  });

  it("tells visibly different poses apart", () => {
    expect(looksSame({ ...rest, y: -3 }, rest)).toBe(false);
  });
});

describe.each(PLACEHOLDERS)("placeholder-%s", (dish) => {
  const { frames } = placeholderBrief(dish);
  const layers = animatedLayers(dish);

  it("has at least one animated layer", () => {
    expect(layers.length).toBeGreaterThan(0);
  });

  it.each(layers.map((l) => [l.name, l.loop!]))(
    "%s fits the clip length, moves, and loops seamlessly",
    (_name, loop) => {
      const { durationS } = parseLoop(loop);
      expect(durationS * FPS).toBeCloseTo(frames);

      const start = poseAt(loop, 0, FPS);
      expect(looksSame(poseAt(loop, frames, FPS), start)).toBe(true);

      // Continuity across the animation's own wrap-around point, which for a
      // delayed layer is not frame 0.
      const { delayS } = parseLoop(loop);
      const wrap = delayS * FPS + frames;
      expect(looksSame(poseAt(loop, wrap - 1e-6, FPS), poseAt(loop, wrap, FPS))).toBe(true);

      const moves = Array.from({ length: frames }, (_, f) => poseAt(loop, f, FPS)).some(
        (pose) => !looksSame(pose, start),
      );
      expect(moves).toBe(true);
    },
  );
});
