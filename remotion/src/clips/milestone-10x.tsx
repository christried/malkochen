import { keys, type Clip } from "./clip";
import { palette, Place, poseTransform, Stage } from "./draw";
import { Pebble } from "./pebble";

// The 10th cooking: a "10×" pebble pops in on the sage wash, pebbles burst
// out of it and a ring pulses, and it comes to rest. One-shot; the last frame
// holds. The "Klassiker!" headline is Vue.

const PEBBLE = "shapes/pebble.svg";
const BURST = "shapes/burst-pebbles.svg";

const gone = { scaleX: 0, scaleY: 0, opacity: 0 };
const size = (scale: number) => ({ scaleX: scale, scaleY: scale });

export const milestone10x: Clip = {
  id: "milestone-10x",
  art: { svgs: [PEBBLE, BURST] },
  poses: (frame) => ({
    pebble: keys(frame, [
      { at: 4, ...size(0), rotate: -20, ease: "ease-out" },
      { at: 18, ...size(1.12), rotate: -3 },
      { at: 26 },
    ]),
    // From inside the pebble out past where burst-pebbles.svg draws them.
    burst: keys(frame, [
      { at: 8, ...gone },
      { at: 9, ...size(0.3), ease: "ease-out" },
      { at: 22, ...size(1.2) },
      { at: 35, ...size(1.5), opacity: 0 },
    ]),
    ring: keys(frame, [
      { at: 15, ...size(0.9), opacity: 0 },
      { at: 18, ...size(1), opacity: 0.7, ease: "ease-out" },
      { at: 42, ...size(1.9), opacity: 0 },
    ]),
  }),
  Scene: ({ theme, background, poses, art, width, height }) => {
    const { surface, text } = palette(theme);
    const cx = width / 2;
    const cy = height / 2;
    const pebbleSize = 0.42 * width;
    const burstSize = 0.8 * width;
    return (
      <Stage width={width} height={height} background={background}>
        <circle
          cx={cx}
          cy={cy}
          r={pebbleSize * 0.52}
          fill="none"
          stroke={surface}
          strokeWidth={10}
          transform={poseTransform(poses.ring, [cx, cy])}
          opacity={poses.ring.opacity}
        />
        <g transform={poseTransform(poses.burst, [cx, cy])} opacity={poses.burst.opacity}>
          <Place svg={art.svgs[BURST]} x={cx - burstSize / 2} y={cy - burstSize / 2} width={burstSize} />
        </g>
        <Pebble
          svg={art.svgs[PEBBLE]}
          cx={cx}
          cy={cy}
          size={pebbleSize}
          pose={poses.pebble}
          fill={surface}
          label={{ text: "10×", color: text }}
        />
      </Stage>
    );
  },
};
