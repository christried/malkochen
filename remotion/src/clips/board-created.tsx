import { uniformScale } from "../motion";
import { defineClip, keys, type Poses } from "./clip";
import { ACCENT, palette, Place, placement, Stage } from "./draw";
import { Pebble } from "./pebble";

// A Board was made: its pebble pops in with a twist while ten pebbles of
// confetti burst out radially, then it holds. One-shot. The Board's emoji is
// drawn by Vue on the pebble; the Columns, headline and button are Vue too.

const PEBBLE = "shapes/pebble.svg";
const COLOURS = [ACCENT.butter, ACCENT.sage, ACCENT.carrot, ACCENT.orchid, ACCENT.sky];
const PIECES = 10;
// In the pebble's 100-unit viewBox: the pieces start at its edge.
const PIECE_SIZE = 15;
const EDGE = 50;

type Part = "pebble" | `confetti.${number}`;

// How far out from the pebble's centre a piece is, as the pose's x.
const burst = (frame: number) =>
  keys(frame, [
    { at: 3, x: EDGE, opacity: 0, ...uniformScale(0.4), ease: "ease-out" },
    { at: 5, x: EDGE + 10, ...uniformScale(1) },
    { at: 18, x: EDGE + 74, rotate: 120, opacity: 0, ...uniformScale(0.7) },
  ]);

export const boardCreated = defineClip<Part>({
  id: "board-created",
  art: { svgs: [PEBBLE] },
  poses: (frame) => {
    const poses: Poses<Part> = {
      pebble: keys(frame, [
        { at: 3, ...uniformScale(0), rotate: -30, ease: "ease-out" },
        { at: 9, ...uniformScale(1.08), rotate: 8 },
        { at: 13 },
      ]),
    };
    const { x: distance, ...spin } = burst(frame);
    for (let i = 0; i < PIECES; i++) {
      // Evenly round from the top, spinning alternately each way.
      const angle = (2 * Math.PI * i) / PIECES - Math.PI / 2;
      poses[`confetti.${i + 1}`] = {
        ...spin,
        x: distance * Math.cos(angle),
        y: distance * Math.sin(angle),
        rotate: i % 2 ? spin.rotate : -spin.rotate,
      };
    }
    return poses;
  },
  Scene: ({ theme, background, poses, art, width, height }) => {
    const pebble = art.svgs[PEBBLE];
    const pebbleSize = 0.4 * width;
    const left = (width - pebbleSize) / 2;
    const top = (height - pebbleSize) / 2;
    return (
      <Stage width={width} height={height} background={background}>
        {/* The confetti, in the pebble's viewBox. */}
        <g transform={placement(pebble, left, top, pebbleSize)}>
          {Array.from({ length: PIECES }, (_, i) => {
            const { x, y, ...pose } = poses[`confetti.${i + 1}`];
            return (
              <Place
                key={i}
                svg={pebble}
                x={EDGE + x - PIECE_SIZE / 2}
                y={EDGE + y - PIECE_SIZE / 2}
                width={PIECE_SIZE}
                color={COLOURS[i % COLOURS.length]}
                pose={{ ...pose, x: 0, y: 0 }}
              />
            );
          })}
        </g>
        <Pebble
          svg={pebble}
          cx={width / 2}
          cy={height / 2}
          size={pebbleSize}
          pose={poses.pebble}
          fill={palette(theme).surface}
        />
      </Stage>
    );
  },
});
