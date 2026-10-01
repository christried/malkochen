import { REST } from "../motion";
import { swing, type Clip } from "./clip";
import { ACCENT, Blob, mix, Place, Stage } from "./draw";
import { Topfbert, topfbertHeight, topfbertPoses } from "./topfbert";

// A Dish never cooked yet (empty Cooking History): Topfbert happy resting on
// a sage blob while a pea rolls back and forth at his feet.

const FRAMES = 90;
const PEA = "characters/pea.svg";
// Half the pea's roll, in its 48-unit viewBox; its body has radius 16.
const ROLL = 16;
const PEA_RADIUS = 16;

export const neverCooked: Clip = {
  id: "never-cooked",
  art: { svgs: [PEA], topfbert: ["happy"] },
  poses: (frame) => {
    const x = swing(frame, FRAMES, ROLL);
    return {
      ...topfbertPoses("happy", frame, { period: FRAMES, blink: FRAMES }),
      // Upright at the left, where the still has it.
      pea: { ...REST, x, rotate: ((x + ROLL) / PEA_RADIUS) * (180 / Math.PI) },
    };
  },
  Scene: ({ background, poses, art, width, height }) => {
    const topfbertWidth = 0.4 * width;
    const bottom = height - 0.08 * height;
    const peaWidth = 0.13 * width;
    return (
      <Stage
        width={width}
        height={height}
        background={background}
        under={<Blob inset={6} background={mix(ACCENT.sage, 30, background)} />}
      >
        <Topfbert
          layers={art.topfbert.happy!}
          poses={poses}
          x={0.56 * width - topfbertWidth / 2}
          y={bottom - topfbertHeight(topfbertWidth)}
          width={topfbertWidth}
        />
        <Place
          svg={art.svgs[PEA]}
          x={0.3 * width - peaWidth / 2}
          // The pea's body ends 6 units above its viewBox's foot.
          y={bottom - peaWidth * (42 / 48)}
          width={peaWidth}
          pose={poses.pea}
          pivot={[24, 26]}
        />
      </Stage>
    );
  },
};
