import { keys, type Clip } from "./clip";
import { ACCENT, palette, Place, Stage } from "./draw";
import { Pebble } from "./pebble";

// A Board was made: its pebble pops in with a twist while ten pebbles of
// confetti burst out radially, then it holds. One-shot. The Board's emoji is
// drawn by Vue on the pebble; the Columns, headline and button are Vue too.

const PEBBLE = "shapes/pebble.svg";
const COLOURS = [ACCENT.butter, ACCENT.sage, ACCENT.carrot, ACCENT.orchid, ACCENT.sky];
const PIECES = 10;

const size = (scale: number) => ({ scaleX: scale, scaleY: scale });

export const boardCreated: Clip = {
  id: "board-created",
  art: { svgs: [PEBBLE] },
  poses: (frame) => ({
    pebble: keys(frame, [
      { at: 3, ...size(0), rotate: -30, ease: "ease-out" },
      { at: 9, ...size(1.08), rotate: 8 },
      { at: 13 },
    ]),
    // x: how far out from the pebble's edge, in canvas px.
    confetti: keys(frame, [
      { at: 3, opacity: 0, ...size(0.4), ease: "ease-out" },
      { at: 5, x: 30, ...size(1) },
      { at: 18, x: 230, rotate: 120, opacity: 0, ...size(0.7) },
    ]),
  }),
  Scene: ({ theme, background, poses, art, width, height }) => {
    const cx = width / 2;
    const cy = height / 2;
    const pebbleSize = 0.4 * width;
    const pieceSize = 0.06 * width;
    const { confetti } = poses;
    return (
      <Stage width={width} height={height} background={background}>
        <g opacity={confetti.opacity}>
          {Array.from({ length: PIECES }, (_, i) => {
            const angle = (2 * Math.PI * i) / PIECES - Math.PI / 2;
            const distance = pebbleSize / 2 + confetti.x;
            const x = cx + distance * Math.cos(angle);
            const y = cy + distance * Math.sin(angle);
            return (
              <Place
                key={i}
                svg={art.svgs[PEBBLE]}
                x={x - pieceSize / 2}
                y={y - pieceSize / 2}
                width={pieceSize}
                color={COLOURS[i % COLOURS.length]}
                pose={{ ...confetti, x: 0, opacity: 1, rotate: confetti.rotate * (i % 2 ? 1 : -1) }}
              />
            );
          })}
        </g>
        <Pebble
          svg={art.svgs[PEBBLE]}
          cx={cx}
          cy={cy}
          size={pebbleSize}
          pose={poses.pebble}
          fill={palette(theme).surface}
        />
      </Stage>
    );
  },
};
