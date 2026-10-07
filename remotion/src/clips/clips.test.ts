import { describe, expect, it } from "vitest";
import { CLIP_IDS, type ClipId, clipBrief } from "../briefs";
import { looksSame, type Pose, REST } from "../motion";
import { CLIPS, clipById } from "./registry";

// Motion is checked by eye in Remotion Studio (spec). What is checked here is
// each clip's timeline, clip.poses(frame): loops are seamless, nothing jumps
// on screen, and the moments the briefs pin down happen.

const clip = clipById;
const pose = (id: ClipId, part: string, frame: number): Pose => {
  const p = clip(id).poses(frame)[part];
  if (!p) throw new Error(`${id} has no part ${part}`);
  return p;
};

// Small enough that no briefed motion moves visibly in between.
const EPSILON = 1e-5;

const differingParts = (a: Record<string, Pose>, b: Record<string, Pose>) =>
  Object.keys(a).filter((part) => !looksSame(a[part], b[part]));

it("has a clip for every state, system and celebration brief, in the briefs' order", () => {
  expect(CLIPS.map((c) => c.id)).toEqual(CLIP_IDS);
});

describe.each(CLIPS.map((c) => [c.id, c] as const))("%s", (id, c) => {
  const { video, loop } = clipBrief(id);
  const frames = video.durationInFrames;

  it("never jumps visibly from one moment to the next", () => {
    for (let frame = 0; frame < frames; frame += 0.25) {
      expect(
        differingParts(c.poses(frame), c.poses(frame + EPSILON)),
        `frame ${frame}`,
      ).toEqual([]);
    }
  });

  it.runIf(loop)("loops seamlessly: frame N equals frame 0, with no jump at the wrap", () => {
    expect(differingParts(c.poses(frames), c.poses(0))).toEqual([]);
    expect(differingParts(c.poses(frames - EPSILON), c.poses(0))).toEqual([]);
  });
});

describe("not-unlocked", () => {
  it("hangs the sign at −8°, swings it to +8° at f42, straight at the f21 still", () => {
    expect(pose("not-unlocked", "sign", 0).rotate).toBeCloseTo(-8);
    expect(pose("not-unlocked", "sign", 42).rotate).toBeCloseTo(8);
    expect(pose("not-unlocked", "sign", 21).rotate).toBeCloseTo(0);
  });
});

describe("offline", () => {
  it("has both Wi-Fi arcs at full at f0", () => {
    expect(pose("offline", "wifi.outer", 0).opacity).toBeCloseTo(1);
    expect(pose("offline", "wifi.inner", 0).opacity).toBeCloseTo(1);
  });

  it("fades the outer arc to 12% by f29, then the inner one by the f40 still", () => {
    expect(pose("offline", "wifi.outer", 29).opacity).toBeCloseTo(0.12);
    expect(pose("offline", "wifi.inner", 29).opacity).toBeGreaterThan(0.9);
    expect(pose("offline", "wifi.inner", 40).opacity).toBeCloseTo(0.12);
  });
});

describe("error", () => {
  it("wobbles Topfbert from −6° to −2° at f36 while the spill widens to 1.12", () => {
    expect(pose("error", "topfbert", 0).rotate).toBeCloseTo(-6);
    expect(pose("error", "topfbert", 36).rotate).toBeCloseTo(-2);
    expect(pose("error", "spill", 0).scaleX).toBeCloseTo(1);
    expect(pose("error", "spill", 36).scaleX).toBeCloseTo(1.12);
  });

  it("rises three smoke puffs, 24 frames apart", () => {
    expect(pose("error", "puff.2", 24)).toEqual(pose("error", "puff.1", 0));
    expect(pose("error", "puff.3", 48)).toEqual(pose("error", "puff.1", 0));
    expect(pose("error", "puff.1", 30).y).toBeLessThan(pose("error", "puff.1", 10).y);
  });
});

describe("lookup-failed", () => {
  it("tilts Topfbert −6° with no sweat drop yet at f0", () => {
    expect(pose("lookup-failed", "topfbert", 0).rotate).toBeCloseTo(-6);
    expect(pose("lookup-failed", "topfbert.drop", 0).scaleY).toBeCloseTo(0);
  });

  it("grows the drop from f14 to f22, so the f30 still shows it whole", () => {
    expect(pose("lookup-failed", "topfbert.drop", 14).scaleY).toBeCloseTo(0);
    expect(pose("lookup-failed", "topfbert.drop", 22).scaleY).toBeCloseTo(1);
    expect(pose("lookup-failed", "topfbert.drop", 30).opacity).toBeCloseTo(1);
  });

  it("slides the drop down 10 from f58 until it is gone at f72", () => {
    expect(pose("lookup-failed", "topfbert.drop", 58).y).toBeCloseTo(0);
    expect(pose("lookup-failed", "topfbert.drop", 72 - 1e-6).y).toBeCloseTo(10);
    expect(pose("lookup-failed", "topfbert.drop", 72 - 1e-6).opacity).toBeCloseTo(0);
  });
});

describe("topfbert-wow", () => {
  it("lifts Topfbert 4 at f42", () => {
    expect(pose("topfbert-wow", "topfbert", 0).y).toBeCloseTo(0);
    expect(pose("topfbert-wow", "topfbert", 42).y).toBeCloseTo(-4);
  });

  it("pops three sparkles 0 → 1 → 0 over 42f, offset 0 / 15 / 27f", () => {
    expect(pose("topfbert-wow", "topfbert.spark_1", 0).scaleX).toBeCloseTo(0);
    expect(pose("topfbert-wow", "topfbert.spark_1", 21).scaleX).toBeCloseTo(1);
    expect(pose("topfbert-wow", "topfbert.spark_1", 42).scaleX).toBeCloseTo(0);
    expect(pose("topfbert-wow", "topfbert.spark_2", 15)).toEqual(pose("topfbert-wow", "topfbert.spark_1", 0));
    expect(pose("topfbert-wow", "topfbert.spark_3", 27)).toEqual(pose("topfbert-wow", "topfbert.spark_1", 0));
  });
});

describe("empty-board", () => {
  const veggies = ["veggie.1", "veggie.2", "veggie.3", "veggie.4"];

  it("rests all four veggies in the pot, eyes open, at the f0 still", () => {
    for (const veggie of veggies) {
      expect(looksSame(pose("empty-board", veggie, 0), REST)).toBe(true);
    }
    expect(pose("empty-board", "topfbert.eyes", 0).scaleY).toBeCloseTo(1);
  });

  it("hops one veggie at a time, starting 18f apart, flipped 150° at the apex", () => {
    veggies.forEach((veggie, i) => {
      const apex = pose("empty-board", veggie, 18 * i + 9);
      expect(apex.y).toBeLessThan(0);
      expect(apex.rotate).toBeCloseTo(150);
      for (const other of veggies.filter((v) => v !== veggie)) {
        expect(looksSame(pose("empty-board", other, 18 * i + 9), REST)).toBe(true);
      }
    });
  });

  it("blinks at f66–70", () => {
    expect(pose("empty-board", "topfbert.eyes", 68).scaleY).toBeLessThan(0.5);
    expect(pose("empty-board", "topfbert.eyes", 70).scaleY).toBeCloseTo(1);
    expect(pose("empty-board", "topfbert.eyes", 60).scaleY).toBeCloseTo(1);
  });
});

describe("lookup-stir", () => {
  it("swings the spoon from −20° to +20° at f18, four times a loop", () => {
    expect(pose("lookup-stir", "topfbert.spoon", 0).rotate).toBeCloseTo(-20);
    expect(pose("lookup-stir", "topfbert.spoon", 18).rotate).toBeCloseTo(20);
    expect(pose("lookup-stir", "topfbert.spoon", 36).rotate).toBeCloseTo(-20);
  });

  // A 48f pass is one side-to-side sweep, so a lap is 96f, which 144 can't
  // hold; the nearest seamless lap is 72f (two per loop), with the briefed
  // thirds-of-a-lap phases scaled to match.
  it("orbits carrot, pea and pepper once per 72f, a third of a lap apart", () => {
    expect(pose("lookup-stir", "orbit.1", 72)).toEqual(pose("lookup-stir", "orbit.1", 0));
    expect(looksSame(pose("lookup-stir", "orbit.1", 36), pose("lookup-stir", "orbit.1", 0))).toBe(false);
    expect(pose("lookup-stir", "orbit.2", 0)).toEqual(pose("lookup-stir", "orbit.1", 24));
    expect(pose("lookup-stir", "orbit.3", 0)).toEqual(pose("lookup-stir", "orbit.1", 48));
  });
});

describe("empty-column", () => {
  it("rolls the pea from the left of the bowl (−44, −240°) to the right (+44, +240°) at f66", () => {
    expect(pose("empty-column", "pea", 0).x).toBeCloseTo(-44);
    expect(pose("empty-column", "pea", 0).rotate).toBeCloseTo(-240);
    expect(pose("empty-column", "pea", 66).x).toBeCloseTo(44);
    expect(pose("empty-column", "pea", 66).rotate).toBeCloseTo(240);
  });

  it("has the pea centred and upright at the f33 still", () => {
    expect(looksSame(pose("empty-column", "pea", 33), REST)).toBe(true);
  });
});

describe("search-empty", () => {
  it("swings the magnifier from the left at −10° to the right at +10° by f54", () => {
    expect(pose("search-empty", "magnifier", 0)).toMatchObject({ x: 0, rotate: -10 });
    const right = pose("search-empty", "magnifier", 54);
    expect(right.x).toBeGreaterThan(0);
    expect(right.rotate).toBeCloseTo(10);
  });

  it("keeps the pea behind the plate until it peeks at f54–80, and has it ducked by f90", () => {
    expect(pose("search-empty", "pea", 0).y).toBe(0);
    expect(pose("search-empty", "pea", 54).y).toBe(0);
    expect(pose("search-empty", "pea", 70).y).toBeLessThan(0);
    expect(pose("search-empty", "pea", 80).y).toBeLessThan(0);
    expect(pose("search-empty", "pea", 85).y).toBeGreaterThan(pose("search-empty", "pea", 80).y);
    expect(pose("search-empty", "pea", 90).y).toBe(0);
  });
});

const invisible = (p: Pose) => p.opacity < 0.001 || Math.abs(p.scaleX) < 0.001;

describe("milestone-10x", () => {
  it("starts on empty sage", () => {
    for (const part of ["pebble", "burst", "ring"]) {
      expect(invisible(pose("milestone-10x", part, 0)), part).toBe(true);
    }
  });

  it("pops the 10× pebble from f4 at −20°, overshooting to 1.12 at f18, settled by f26", () => {
    expect(pose("milestone-10x", "pebble", 4)).toMatchObject({ scaleX: 0, rotate: -20 });
    expect(pose("milestone-10x", "pebble", 18).scaleX).toBeCloseTo(1.12);
    expect(looksSame(pose("milestone-10x", "pebble", 26), REST)).toBe(true);
  });

  it("bursts pebbles outward from f8 to f35, and pulses a ring from f15", () => {
    expect(invisible(pose("milestone-10x", "burst", 8))).toBe(true);
    expect(invisible(pose("milestone-10x", "burst", 20))).toBe(false);
    expect(invisible(pose("milestone-10x", "burst", 35))).toBe(true);
    expect(invisible(pose("milestone-10x", "ring", 15))).toBe(true);
    expect(invisible(pose("milestone-10x", "ring", 25))).toBe(false);
  });

  it("ends on the still: the pebble resting, no burst, no ring", () => {
    const last = clip("milestone-10x").poses(53);
    expect(looksSame(last.pebble, REST)).toBe(true);
    expect(invisible(last.burst)).toBe(true);
    expect(invisible(last.ring)).toBe(true);
  });
});

describe("board-created", () => {
  const confetti = Array.from({ length: 10 }, (_, i) => `confetti.${i + 1}`);
  const distance = (p: Pose) => Math.hypot(p.x, p.y);

  it("starts empty", () => {
    for (const part of ["pebble", ...confetti]) {
      expect(invisible(pose("board-created", part, 0)), part).toBe(true);
    }
  });

  it("pops the pebble at f3 from −30°, past +8° at f9, upright at f13", () => {
    expect(pose("board-created", "pebble", 3).rotate).toBeCloseTo(-30);
    expect(pose("board-created", "pebble", 9).rotate).toBeCloseTo(8);
    expect(looksSame(pose("board-created", "pebble", 13), REST)).toBe(true);
  });

  it("bursts ten pieces of confetti radially from f3, gone by f18", () => {
    const directions = confetti.map((part) => {
      const p = pose("board-created", part, 12);
      return Math.round((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;
    });
    expect(new Set(directions).size).toBe(10);
    for (const part of confetti) {
      expect(invisible(pose("board-created", part, 10)), part).toBe(false);
      expect(distance(pose("board-created", part, 12))).toBeGreaterThan(
        distance(pose("board-created", part, 6)),
      );
      expect(invisible(pose("board-created", part, 18)), part).toBe(true);
    }
  });

  it("ends holding the pebble", () => {
    const last = clip("board-created").poses(35);
    expect(looksSame(last.pebble, REST)).toBe(true);
    for (const part of confetti) expect(invisible(last[part]), part).toBe(true);
  });
});

describe("invite-loop", () => {
  it("circles six upright veggies round the pebble, half-way by f210", () => {
    for (let i = 1; i <= 6; i++) {
      const start = pose("invite-loop", `veggie.${i}`, 0);
      const halfway = pose("invite-loop", `veggie.${i}`, 210);
      expect(halfway.x).toBeCloseTo(-start.x);
      expect(halfway.y).toBeCloseTo(-start.y);
      expect(halfway.rotate).toBe(0);
    }
    // veggie.1 starts at the top, the others a sixth of a lap apart.
    expect(pose("invite-loop", "veggie.1", 0).x).toBeCloseTo(0);
    expect(pose("invite-loop", "veggie.1", 0).y).toBeLessThan(0);
    expect(pose("invite-loop", "veggie.2", 0)).toEqual(pose("invite-loop", "veggie.1", 70));
  });

  it("bobs the pebble ±8 on an 84f cycle (90f would not loop in 420) and Topfbert on 84f", () => {
    expect(pose("invite-loop", "pebble", 0).y).toBeCloseTo(0);
    expect(pose("invite-loop", "pebble", 21).y).toBeCloseTo(-8);
    expect(pose("invite-loop", "pebble", 63).y).toBeCloseTo(8);
    expect(pose("invite-loop", "topfbert", 42).y).toBeCloseTo(-4);
  });
});

describe("invite-intro", () => {
  it("starts on the empty butter blob", () => {
    for (const part of ["pebble", "topfbert", "veggie.1", "veggie.6"]) {
      expect(invisible(pose("invite-intro", part, 0)), part).toBe(true);
    }
  });

  it("pops the pebble f6–27 and raises Topfbert from below f21–39", () => {
    expect(invisible(pose("invite-intro", "pebble", 6))).toBe(true);
    expect(invisible(pose("invite-intro", "pebble", 16))).toBe(false);
    expect(pose("invite-intro", "topfbert", 21).y).toBeGreaterThan(50);
    expect(pose("invite-intro", "topfbert", 30).y).toBeGreaterThan(0);
  });

  it("hands off to invite-loop's frame 0 at f45", () => {
    const loopStart = clip("invite-loop").poses(0);
    expect(differingParts(loopStart, clip("invite-intro").poses(45))).toEqual([]);
  });
});

describe("splash", () => {
  it("starts on the Board's background, then blooms the butter gradient from the centre by f10", () => {
    expect(pose("splash", "bloom", 0).scaleX).toBeCloseTo(0);
    expect(pose("splash", "bloom", 10).scaleX).toBeCloseTo(1.5);
    expect(invisible(pose("splash", "icon", 0))).toBe(true);
  });

  it("springs the icon in from .2 at f2, to 1.14 at f7, settling at 1 at f10", () => {
    expect(pose("splash", "icon", 2).scaleX).toBeCloseTo(0.2);
    expect(pose("splash", "icon", 7).scaleX).toBeCloseTo(1.14);
    expect(looksSame(pose("splash", "icon", 10), REST)).toBe(true);
  });

  it("pops the lid up 14 at −12° by f12, landing at f16", () => {
    expect(pose("splash", "lid", 12)).toMatchObject({ y: -14, rotate: -12 });
    expect(looksSame(pose("splash", "lid", 16), REST)).toBe(true);
  });

  // In place by the f16 still (the storyboard's "to f17", a frame early).
  it("raises the wordmark and pops its dot from f13, both in place by f16", () => {
    expect(pose("splash", "wordmark", 13).opacity).toBeCloseTo(0);
    expect(invisible(pose("splash", "dot", 13))).toBe(true);
    expect(looksSame(pose("splash", "wordmark", 16), REST)).toBe(true);
    expect(looksSame(pose("splash", "dot", 16), REST)).toBe(true);
  });

  it("zooms the icon 1.9× as it fades from f29, gone at f33 for Vue's cross-fade", () => {
    expect(looksSame(pose("splash", "icon", 29), REST)).toBe(true);
    expect(pose("splash", "icon", 33)).toMatchObject({ scaleX: 1.9, opacity: 0 });
  });
});
