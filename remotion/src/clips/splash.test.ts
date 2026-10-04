import { describe, expect, it } from "vitest";
import { splashLayout } from "./splash";

// Where the splash draws its icon and wordmark, on the brief's portrait
// canvas and on the landscape one for wide windows. (Its timeline is checked
// in clips.test.ts with the other clips'.)

describe("splash layout", () => {
  it("is the brief's on its own portrait canvas", () => {
    const layout = splashLayout(1080, 1920);
    expect(layout.cx).toBeCloseTo(540);
    expect(layout.cy).toBeCloseTo(0.44 * 1920);
    expect(layout.iconSize).toBeCloseTo(0.36 * 1080);
    expect(layout.fontSize).toBeCloseTo(0.12 * 1080);
    expect(layout.wordmarkTop).toBeCloseTo(0.44 * 1920 + 0.18 * 1080 + 0.06 * 1920);
    expect(layout.scale).toBeCloseTo(1);
  });

  describe("on a 16:9 canvas", () => {
    const [width, height] = [2560, 1440];
    const { cx, cy, iconSize, fontSize, wordmarkTop, scale } = splashLayout(width, height);
    // The icon's highest point: the lid popped up 14 of its 108 units (above
    // the icon's 1.14 overshoot).
    const top = cy - iconSize / 2 - (14 / 108) * iconSize;
    // The wordmark's line box.
    const bottom = wordmarkTop + 1.3 * fontSize;

    it("centres the icon and the wordmark", () => {
      expect(cx).toBeCloseTo(width / 2);
      expect(Math.abs((top + bottom) / 2 - height / 2)).toBeLessThan(0.05 * height);
    });

    it("sizes them as the portrait does, to the height", () => {
      expect(iconSize / height).toBeCloseTo((0.36 * 1080) / 1920);
      expect(fontSize / height).toBeCloseTo((0.12 * 1080) / 1920);
      expect(scale).toBeCloseTo(height / 1920);
    });

    // Covering a 32:9 window, the video shows only the middle half of its height.
    it("keeps them whole even on an ultrawide window", () => {
      expect(top).toBeGreaterThan(height / 4);
      expect(bottom).toBeLessThan((3 * height) / 4);
    });
  });
});
