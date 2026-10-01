import { describe, expect, it } from "vitest";
import { CLIP_IDS, clipBrief } from "./briefs";

describe("clipBrief", () => {
  it("reads canvas, length, loop and backgrounds from the handoff", () => {
    expect(clipBrief("offline")).toEqual({
      video: { width: 660, height: 600, durationInFrames: 72, fps: 30 },
      loop: true,
      background: { light: "#F7F6F2", dark: "#131211" },
      posterFrame: 40,
    });
  });

  it("takes the poster from the brief's 'frame N' still", () => {
    expect(clipBrief("empty-column").posterFrame).toBe(33);
    expect(clipBrief("not-unlocked").posterFrame).toBe(21);
    expect(clipBrief("splash").posterFrame).toBe(16);
    expect(clipBrief("error").posterFrame).toBe(0);
  });

  it("takes the last frame for a still that is the last frame", () => {
    expect(clipBrief("milestone-10x").posterFrame).toBe(53);
    expect(clipBrief("board-created").posterFrame).toBe(35);
  });

  it("takes invite-intro's last frame, where it hands off to invite-loop frame 0", () => {
    expect(clipBrief("invite-intro").posterFrame).toBe(44);
  });
});

describe("CLIP_IDS", () => {
  it("lists the 15 state, system and celebration clips: no placeholders, nothing transparent", () => {
    expect(CLIP_IDS).toEqual([
      "empty-board",
      "empty-column",
      "search-empty",
      "lookup-stir",
      "lookup-failed",
      "never-cooked",
      "milestone-10x",
      "board-created",
      "invite-intro",
      "invite-loop",
      "splash",
      "topfbert-wow",
      "not-unlocked",
      "offline",
      "error",
    ]);
  });
});
