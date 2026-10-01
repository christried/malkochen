import { REST } from "../motion";
import { defineClip, swing } from "./clip";
import { palette, Place, Stage } from "./draw";

// A Column with no Dishes: a pea rolls from side to side in a dashed bowl,
// riding up its walls, centred and upright half-way (the still). Laid out
// like EmptyColumn.vue.

const FRAMES = 132;
const PEA = "characters/pea.svg";
const BOWL = "shapes/bowl-outline.svg";
// In the bowl's 120-wide viewBox.
const REACH = 44;
const RIDE_UP = 8;

export const emptyColumn = defineClip<"pea">({
  id: "empty-column",
  art: { svgs: [PEA, BOWL] },
  poses: (frame) => {
    const x = swing(frame, FRAMES, REACH);
    const side = x / REACH;
    return { pea: { ...REST, x, y: -RIDE_UP * side * side, rotate: 240 * side } };
  },
  Scene: ({ theme, background, poses, art, width, height }) => {
    const bowl = art.svgs[BOWL];
    const unit = width / 120;
    const peaWidth = 0.34 * width;
    const { x, y, rotate } = poses.pea;
    return (
      <Stage width={width} height={height} background={background}>
        <Place
          svg={art.svgs[PEA]}
          x={width / 2 - peaWidth / 2 + x * unit}
          y={0.08 * height + y * unit}
          width={peaWidth}
          pose={{ ...REST, rotate }}
          pivot={[24, 26]}
        />
        <Place svg={bowl} x={0} y={height - (width * 80) / 120} width={width} color={palette(theme).textMuted} />
      </Stage>
    );
  },
});
