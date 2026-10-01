import { uniformScale } from "../motion";
import { defineClip, keys, stack } from "./clip";
import { INVITE_ART, type InvitePart, InviteScene, inviteLoopPoses, RING_SIZE } from "./invite-loop";

// The invite landing's first 1.5s: on the empty butter blob the Board's
// pebble pops in, Topfbert rises from the bottom left, and the veggies pop
// in around the ring, ending exactly on invite-loop's frame 0. Everything
// already moves as it will in the loop (the loop's poses 45 frames early),
// with the entrances layered on top. The Member avatars (f33) are Vue.

const FRAMES = 45;

export const inviteIntro = defineClip<InvitePart>({
  id: "invite-intro",
  art: INVITE_ART,
  poses: (frame) => {
    const poses = inviteLoopPoses(frame - FRAMES);
    poses.pebble = stack(
      keys(frame, [
        { at: 6, ...uniformScale(0), rotate: -12, ease: "ease-out" },
        { at: 18, ...uniformScale(1.1), rotate: 4 },
        { at: 27 },
      ]),
      poses.pebble,
    );
    // From below the canvas, in Topfbert's viewBox units.
    poses.topfbert = stack(
      keys(frame, [
        { at: 21, x: -20, y: 160, opacity: 0 },
        { at: 22, x: -19, y: 150, ease: "ease-out" },
        { at: 39 },
      ]),
      poses.topfbert,
    );
    for (let i = 1; i <= RING_SIZE; i++) {
      const start = 24 + 2 * i;
      poses[`veggie.${i}`] = stack(
        keys(frame, [
          { at: start, ...uniformScale(0), ease: "ease-out" },
          { at: start + 5, ...uniformScale(1.15) },
          { at: start + 8 },
        ]),
        poses[`veggie.${i}`],
      );
    }
    return poses;
  },
  Scene: InviteScene,
});
