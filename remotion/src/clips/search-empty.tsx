import { REST } from "../motion";
import { cycle, keys, swing, type Clip } from "./clip";
import { Place, Stage, themed } from "./draw";

// A search with no results: the magnifier sweeps over an empty plate, and
// while it looks the other way a pea peeks out from behind the plate. Laid
// out like SearchEmpty.vue's 132×102 drawing, which is this canvas at 1/5.

const FRAMES = 108;
const PEA = "characters/pea.svg";
const PLATE = "shapes/plate.svg";
const MAGNIFIER = "shapes/magnifier.svg";
// SearchEmpty.vue's units.
const UNIT = 5;
const SWEEP = 24;

export const searchEmpty: Clip = {
  id: "search-empty",
  art: { svgs: [PEA, PLATE, MAGNIFIER] },
  poses: (frame) => ({
    magnifier: {
      ...REST,
      x: SWEEP / 2 + swing(frame, FRAMES, SWEEP / 2),
      rotate: swing(frame, FRAMES, 10),
    },
    pea: keys(cycle(frame, FRAMES), [
      { at: 0 },
      { at: 54, ease: "ease-out" },
      { at: 62, y: -20 },
      { at: 86, y: -20, ease: "ease-in" },
      { at: 94 },
      { at: FRAMES },
    ]),
  }),
  Scene: ({ theme, background, poses, art, width, height }) => {
    const peaWidth = 30 * UNIT;
    return (
      <Stage width={width} height={height} background={background}>
        <g transform={`translate(0 ${poses.pea.y * UNIT})`}>
          <Place svg={art.svgs[PEA]} x={44 * UNIT - peaWidth / 2} y={82 * UNIT - (26 / 48) * peaWidth} width={peaWidth} />
        </g>
        {/* plate.svg's ellipse centred where SearchEmpty.vue draws it (66, 80) */}
        <Place svg={themed(art.svgs[PLATE], theme)} x={6 * UNIT} y={46 * UNIT} width={120 * UNIT} />
        <Place
          svg={themed(art.svgs[MAGNIFIER], theme)}
          x={22 * UNIT}
          y={6 * UNIT}
          width={64 * UNIT}
          pose={poses.magnifier}
        />
      </Stage>
    );
  },
};
