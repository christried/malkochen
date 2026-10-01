import { REST } from "../motion";
import { cycle, type Clip } from "./clip";
import { Place, Stage } from "./draw";
import { Topfbert, topfbertHeight, topfbertPoses } from "./topfbert";

// A link is being looked up: Topfbert stirs, eyes squeezed, while a carrot, a
// pea and a pepper fly round the pot on an ellipse, a third of a lap apart,
// passing behind the spoon and in front of the rim. The status text is Vue.

const LAP = 48;
const VEGGIES = ["veggies/carrot.svg", "veggies/pea.svg", "veggies/pepper.svg"];
const VEGGIE_SIZE = 26;
// The orbit in Topfbert's viewBox: centred over the pot (layers.json's
// "x −40↔40 and y −12↔8").
const CENTRE = { x: 70, y: 30 };
const RADIUS = { x: 40, y: 10 };

// Where a veggie is on its lap, relative to the orbit's centre; the near half
// (y > 0) passes in front.
const orbit = (frame: number, ahead: number) => {
  const angle = (2 * Math.PI * cycle(frame + ahead, LAP)) / LAP;
  return { ...REST, x: RADIUS.x * Math.sin(angle), y: -2 + RADIUS.y * Math.cos(angle) };
};

export const lookupStir: Clip = {
  id: "lookup-stir",
  art: { svgs: VEGGIES, topfbert: ["stir"] },
  poses: (frame) => ({
    ...topfbertPoses("stir", frame, { period: 36 }),
    "orbit.1": orbit(frame, 0),
    "orbit.2": orbit(frame, 32),
    "orbit.3": orbit(frame, 64),
  }),
  Scene: ({ background, poses, art, width, height }) => {
    const topfbertWidth = 0.52 * width;
    const veggies = (near: boolean) =>
      VEGGIES.map((path, i) => {
        const pose = poses[`orbit.${i + 1}`];
        if (pose.y > -2 !== near) return null;
        return (
          <Place
            key={path}
            svg={art.svgs[path]}
            x={CENTRE.x + pose.x - VEGGIE_SIZE / 2}
            y={CENTRE.y + pose.y - VEGGIE_SIZE / 2}
            width={VEGGIE_SIZE}
          />
        );
      });
    return (
      <Stage width={width} height={height} background={background}>
        <Topfbert
          layers={art.topfbert.stir!}
          poses={poses}
          x={(width - topfbertWidth) / 2}
          y={height - 0.04 * height - topfbertHeight(topfbertWidth)}
          width={topfbertWidth}
          // The handoff's own orbit chunks give way to the veggie drawings.
          hide={["orbit_1", "orbit_2", "orbit_3"]}
          inPot={veggies(false)}
          front={veggies(true)}
        />
      </Stage>
    );
  },
};
