import { describe, expect, it } from "vitest";
import briefs from "../../docs/design handoff/remotion-briefs.json";
import { CLIP_IDS, clipBrief } from "./briefs";

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
    expect(clipBrief("empty-column").poster.frame).toBe(33);
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
});

describe("CLIP_IDS", () => {
  it("lists every video brief that is not a Placeholder Image or transparent, in order", () => {
    const fromHandoff = (briefs as { id: string; transparent: boolean }[])
      .filter((b) => !b.id.startsWith("placeholder-") && !b.transparent)
      .map((b) => b.id);
    expect(fromHandoff).toHaveLength(15);
    expect(CLIP_IDS).toEqual(fromHandoff);
  });
});
