import { cycle, defineClip, keys, type Poses } from "./clip";
import { ACCENT, Blob, mix, palette, Place, Stage } from "./draw";
import { Topfbert, type TopfbertPart, topfbertPoses } from "./topfbert";

// A Board with no Dishes: Topfbert happy with four veggies in his pot, which
// hop out and flip one at a time, on a butter blob. Laid out like
// EmptyBoard.vue, on the Column panel's colour (briefs.ts).

const FRAMES = 72;
// Each veggie's slot: it hops in the first 18 frames after its start.
const SLOT = 18;
const VEGGIES = ["veggies/carrot.svg", "veggies/pea.svg", "veggies/pepper.svg", "veggies/pea.svg"];
// Where each sits in the pot, in Topfbert's viewBox: clear of the hat.
const SPOTS = [64, 80, 96, 112];
const VEGGIE_SIZE = 24;

// Up and flipped 150° at the apex, a full turn by the landing. Veggie units.
const hop = (frame: number, start: number) =>
  keys(cycle(frame, FRAMES, start), [
    { at: 0, ease: "ease-out" },
    { at: 9, y: -64, rotate: 150, ease: "ease-in" },
    { at: 16, rotate: 360 },
    { at: SLOT, rotate: 360 },
  ]);

type Part = TopfbertPart | `veggie.${number}`;

export const emptyBoard = defineClip<Part>({
  id: "empty-board",
  art: { svgs: ["veggies/carrot.svg", "veggies/pea.svg", "veggies/pepper.svg"], topfbert: ["happy"] },
  poses: (frame) => {
    const poses: Poses<Part> = topfbertPoses("happy", frame, { period: FRAMES, blink: FRAMES });
    VEGGIES.forEach((_, i) => {
      // A full turn looks like none, so a landed veggie is at rest.
      const pose = hop(frame, i * SLOT);
      poses[`veggie.${i + 1}`] = { ...pose, rotate: pose.rotate % 360 };
    });
    return poses;
  },
  Scene: ({ theme, background, poses, art, width, height }) => {
    const topfbertWidth = 0.62 * width;
    return (
      <Stage
        width={width}
        height={height}
        background={background}
        under={<Blob inset={6} background={mix(ACCENT.butter, 24, palette(theme).bg)} />}
      >
        <Topfbert
          layers={art.topfbert.happy!}
          poses={poses}
          x={(width - topfbertWidth) / 2}
          bottom={0.96 * height}
          width={topfbertWidth}
          inPot={VEGGIES.map((path, i) => (
            <Place
              key={i}
              svg={art.svgs[path]}
              x={SPOTS[i] - VEGGIE_SIZE / 2}
              y={22}
              width={VEGGIE_SIZE}
              pose={poses[`veggie.${i + 1}`]}
            />
          ))}
        />
      </Stage>
    );
  },
});
