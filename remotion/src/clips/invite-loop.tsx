import { REST } from "../motion";
import { cycle, type Clip, type Poses, type SceneProps } from "./clip";
import { palette, Place, Stage } from "./draw";
import { Pebble } from "./pebble";
import { Topfbert, topfbertHeight, topfbertPoses } from "./topfbert";

// The invite landing, after the intro: the Board's pebble bobs, Topfbert
// bobs at the bottom left, and six veggies circle everything once per loop,
// staying upright. Laid out like the still on the invite page. The clip's
// background is the butter blob's tint, so the blob is the video's frame.
// The Board's emoji and the Member avatars are Vue overlays.

export const INVITE_LOOP_FRAMES = 420;
// Topfbert's 78f bob and the pebble's 90f both become 84f: 420 = 5 × 84.
const BOB = 84;
const PEBBLE = "shapes/pebble.svg";
const VEGGIES = ["veggies/carrot.svg", "veggies/pea.svg", "veggies/pepper.svg"];
export const RING_SIZE = 6;
// The brief's r = 354px, around the canvas centre, pulled in just enough
// that no veggie is cropped by the 750px height.
const RING_RADIUS = 354;

export const inviteLoopPoses = (frame: number): Poses => {
  const poses: Poses = {
    ...topfbertPoses("happy", frame, { period: BOB, blink: BOB }),
    ring: { ...REST, rotate: (360 * cycle(frame, INVITE_LOOP_FRAMES)) / INVITE_LOOP_FRAMES },
    pebble: { ...REST, y: -8 * Math.sin((2 * Math.PI * frame) / BOB) },
  };
  for (let i = 1; i <= RING_SIZE; i++) poses[`veggie.${i}`] = REST;
  return poses;
};

export const InviteScene: React.FC<SceneProps> = ({ theme, background, poses, art, width, height }) => {
  const pebbleSize = 0.42 * width;
  const topfbertWidth = 0.4 * width;
  const veggieSize = 0.11 * width;
  const turn = (poses.ring.rotate * Math.PI) / 180;
  const radius = Math.min(RING_RADIUS, height / 2 - veggieSize / 2 - 0.02 * height);
  return (
    <Stage width={width} height={height} background={background}>
      {Array.from({ length: RING_SIZE }, (_, i) => {
        // Counter-rotated: only the positions turn.
        const angle = turn + (2 * Math.PI * i) / RING_SIZE - Math.PI / 2;
        const x = width / 2 + radius * Math.cos(angle);
        const y = height / 2 + radius * Math.sin(angle);
        return (
          <Place
            key={i}
            svg={art.svgs[VEGGIES[i % VEGGIES.length]]}
            x={x - veggieSize / 2}
            y={y - veggieSize / 2}
            width={veggieSize}
            pose={poses[`veggie.${i + 1}`]}
          />
        );
      })}
      <Pebble
        svg={art.svgs[PEBBLE]}
        cx={width / 2}
        cy={0.14 * height + pebbleSize / 2}
        size={pebbleSize}
        pose={poses.pebble}
        fill={palette(theme).surface}
      />
      <Topfbert
        layers={art.topfbert.happy!}
        poses={poses}
        x={0.04 * width}
        y={height - 0.04 * height - topfbertHeight(topfbertWidth)}
        width={topfbertWidth}
      />
    </Stage>
  );
};

export const INVITE_ART: Clip["art"] = { svgs: [PEBBLE, ...VEGGIES], topfbert: ["happy"] };

export const inviteLoop: Clip = {
  id: "invite-loop",
  art: INVITE_ART,
  poses: inviteLoopPoses,
  Scene: InviteScene,
};
