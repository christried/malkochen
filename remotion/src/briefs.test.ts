import { describe, expect, it } from "vitest";
import briefs from "../../docs/design handoff/remotion-briefs.json";
import { CLIP_IDS, clipBrief, clipVideo, LANDSCAPE_CLIPS } from "./briefs";

describe("clipBrief", () => {
  it("reads canvas, length, loop and backgrounds from the handoff", () => {
    expect(clipBrief("offline")).toEqual({
      video: { width: 660, height: 600, durationInFrames: 72, fps: 30 },
      loop: true,
      background: { light: "#F7F6F2", dark: "#131211" },
      poster: { clip: "offline", frame: 40 },
    });
  });

  it("takes the poster from the brief's 'frame N' still", () => {
    expect(clipBrief("lookup-failed").poster.frame).toBe(30);
    expect(clipBrief("empty-column").poster.frame).toBe(0);
    expect(clipBrief("not-unlocked").poster.frame).toBe(21);
    expect(clipBrief("splash").poster.frame).toBe(16);
    expect(clipBrief("error").poster.frame).toBe(0);
  });

  it("takes the last frame for a still that is the last frame", () => {
    expect(clipBrief("milestone-10x").poster).toEqual({ clip: "milestone-10x", frame: 53 });
    expect(clipBrief("board-created").poster.frame).toBe(35);
  });

  it("takes another clip's frame for a still that names one", () => {
    expect(clipBrief("invite-intro").poster).toEqual({ clip: "invite-loop", frame: 0 });
  });

  it("bakes in the colour the app shows a clip on, where that isn't the brief's", () => {
    const surfaceMuted = { light: "#EFEDE8", dark: "#2A2825" };
    const bg = { light: "#F7F6F2", dark: "#131211" };
    // The Column panel.
    expect(clipBrief("empty-board").background).toEqual(surfaceMuted);
    expect(clipBrief("empty-column").background).toEqual(surfaceMuted);
    // The invite page.
    expect(clipBrief("invite-intro").background).toEqual(bg);
    expect(clipBrief("invite-loop").background).toEqual(bg);
  });
});

describe("CLIP_IDS", () => {
  it("lists every video brief that is not a Placeholder Image, transparent or new in Round 11, in order", () => {
    const fromHandoff = (briefs as { id: string; transparent: boolean; r11?: string }[])
      .filter((b) => !b.id.startsWith("placeholder-") && !b.transparent && !b.r11?.startsWith("new"))
      .map((b) => b.id);
    expect(fromHandoff).toHaveLength(14);
    expect(CLIP_IDS).toEqual(fromHandoff);
  });
});

describe("clipVideo", () => {
  it("is the brief's canvas, unless the clip is asked for in landscape", () => {
    expect(clipVideo("splash", false)).toEqual(clipBrief("splash").video);
    expect(clipVideo("offline", false)).toEqual(clipBrief("offline").video);
  });

  // Covering a wide window, the portrait splash is cut and blown up (#112).
  it("renders the splash a second time on a 16:9 canvas sharp at 1440p, as long and as fast", () => {
    expect(LANDSCAPE_CLIPS).toEqual(["splash"]);
    expect(clipVideo("splash", true)).toEqual({ width: 2560, height: 1440, durationInFrames: 33, fps: 30 });
  });

  it("has no landscape render of any other clip", () => {
    expect(() => clipVideo("offline", true)).toThrow(/offline/);
  });
});
