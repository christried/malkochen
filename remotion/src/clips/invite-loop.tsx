import { clipBrief } from "../briefs";
import { REST } from "../motion";
import { type Clip, cycle, defineClip, type Poses, type SceneProps } from "./clip";
import { ACCENT, Blob, mix, palette, Place, Stage } from "./draw";
import { Pebble } from "./pebble";
import { Topfbert, type TopfbertPart, topfbertPoses } from "./topfbert";

// The invite landing, after the intro: the Board's pebble bobs, Topfbert
// bobs at the bottom left, and six veggies circle the pebble once per loop,
// staying upright, round a butter blob. Laid out like the still on the invite
// page, on the page's colour (briefs.ts).
// The Board's emoji and the Member avatars are Vue overlays.

export const INVITE_LOOP_FRAMES = 420;
// Topfbert's 78f bob and the pebble's 90f both become 84f: 420 = 5 × 84.
const BOB = 84;
const PEBBLE = "shapes/pebble.svg";
const VEGGIES = ["veggies/carrot.svg", "veggies/pea.svg", "veggies/pepper.svg"];
export const RING_SIZE = 6;

// The layout, in canvas px, shared by the timeline and the scene.
const { width: WIDTH, height: HEIGHT } = clipBrief("invite-loop").video;
const PEBBLE_SIZE = 0.42 * WIDTH;
const PEBBLE_CENTRE = { x: WIDTH / 2, y: 0.14 * HEIGHT + PEBBLE_SIZE / 2 };
const VEGGIE_SIZE = 0.11 * WIDTH;
const MARGIN = 0.02 * HEIGHT;
// The brief's r = 354px circle round the pebble, squashed to whatever the
// canvas leaves (the pebble sits high), so no veggie is cropped.
const RING = {
  x: Math.min(354, WIDTH / 2 - VEGGIE_SIZE / 2 - MARGIN),
  y: Math.min(354, PEBBLE_CENTRE.y - VEGGIE_SIZE / 2 - MARGIN),
};

export type InvitePart = TopfbertPart | "pebble" | `veggie.${number}`;

// Each veggie's offset from the pebble's centre: veggie.1 at the top at f0,
// the others a sixth of a lap ahead of the one before.
const onRing = (frame: number, i: number) => {
  const lap = INVITE_LOOP_FRAMES;
  const angle = (2 * Math.PI * cycle(frame + (i * lap) / RING_SIZE, lap)) / lap - Math.PI / 2;
  return { ...REST, x: RING.x * Math.cos(angle), y: RING.y * Math.sin(angle) };
};

export const inviteLoopPoses = (frame: number): Poses<InvitePart> => {
  const poses: Poses<InvitePart> = {
    ...topfbertPoses("happy", frame, { period: BOB, blink: BOB }),
    pebble: { ...REST, y: -8 * Math.sin((2 * Math.PI * frame) / BOB) },
  };
  for (let i = 0; i < RING_SIZE; i++) poses[`veggie.${i + 1}`] = onRing(frame, i);
  return poses;
};

export const InviteScene: React.FC<SceneProps<InvitePart>> = ({
  theme,
  background,
  poses,
  art,
  width,
  height,
}) => {
  const topfbertWidth = 0.4 * width;
  return (
    <Stage
      width={width}
      height={height}
      background={background}
      under={<Blob inset={6} background={mix(ACCENT.butter, 22, palette(theme).bg)} />}
    >
      {Array.from({ length: RING_SIZE }, (_, i) => {
        const { x, y, ...pose } = poses[`veggie.${i + 1}`];
        return (
          <Place
            key={i}
            svg={art.svgs[VEGGIES[i % VEGGIES.length]]}
            x={PEBBLE_CENTRE.x + x - VEGGIE_SIZE / 2}
            y={PEBBLE_CENTRE.y + y - VEGGIE_SIZE / 2}
            width={VEGGIE_SIZE}
            pose={{ ...pose, x: 0, y: 0 }}
          />
        );
      })}
      <Pebble
        svg={art.svgs[PEBBLE]}
        cx={PEBBLE_CENTRE.x}
        cy={PEBBLE_CENTRE.y}
        size={PEBBLE_SIZE}
        pose={poses.pebble}
        fill={palette(theme).surface}
      />
      <Topfbert
        layers={art.topfbert.happy!}
        poses={poses}
        x={0.04 * width}
        bottom={0.96 * height}
        width={topfbertWidth}
      />
    </Stage>
  );
};

export const INVITE_ART: Clip["art"] = { svgs: [PEBBLE, ...VEGGIES], topfbert: ["happy"] };

export const inviteLoop = defineClip<InvitePart>({
  id: "invite-loop",
  art: INVITE_ART,
  poses: inviteLoopPoses,
  Scene: InviteScene,
});
