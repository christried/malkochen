import { REST } from "../motion";
import { cycle, keys, swing, type Clip } from "./clip";
import { ACCENT, Blob, mix, palette, poseTransform, Stage } from "./draw";
import { Topfbert, topfbertHeight, topfbertPoses } from "./topfbert";

// Generic error, "angebrannt": Topfbert oops wobbling over a carrot spill
// while three puffs of smoke rise from the pot. Laid out like error.vue.

const FRAMES = 72;

// A puff rises, grows and fades over the whole loop.
const puff = (frame: number, start: number) =>
  keys(cycle(frame, FRAMES, start), [
    { at: 0, y: 0, scaleX: 0.4, scaleY: 0.4, opacity: 0 },
    { at: 12, y: -14, scaleX: 0.7, scaleY: 0.7 },
    { at: FRAMES, y: -90, scaleX: 1.5, scaleY: 1.5, opacity: 0 },
  ], "ease-out");

export const error: Clip = {
  id: "error",
  art: { topfbert: ["oops"] },
  poses: (frame) => ({
    ...topfbertPoses("oops", frame, { period: FRAMES }),
    // 1 at f0, 1.12 at f36
    spill: { ...REST, scaleX: 1.06 + swing(frame, FRAMES, 0.06) },
    "puff.1": puff(frame, 0),
    "puff.2": puff(frame, 24),
    "puff.3": puff(frame, 48),
  }),
  Scene: ({ theme, background, poses, art, width, height }) => {
    const { bg, text } = palette(theme);
    const topfbertWidth = 0.56 * width;
    const left = (width - topfbertWidth) / 2;
    const top = height - 0.12 * height - topfbertHeight(topfbertWidth);
    const scale = topfbertWidth / 140;
    const spill = { cx: width / 2, cy: height * (1 - 0.1 - 0.045), rx: 0.27 * width, ry: 0.045 * height };
    return (
      <Stage
        width={width}
        height={height}
        background={background}
        under={<Blob inset={6} background={mix(ACCENT.carrot, 24, bg)} />}
      >
        <ellipse
          {...spill}
          transform={poseTransform(poses.spill, [spill.cx, spill.cy])}
          style={{ fill: mix(ACCENT.carrot, 40, bg) }}
        />
        {[1, 2, 3].map((i) => {
          // Over the right of the pot, clear of the hat.
          const cx = left + (62 + i * 12) * scale;
          const cy = top + 44 * scale;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={9 * scale}
              transform={poseTransform(poses[`puff.${i}`], [cx, cy])}
              opacity={poses[`puff.${i}`].opacity}
              style={{ fill: mix(text, 30, bg) }}
            />
          );
        })}
        <Topfbert layers={art.topfbert.oops!} poses={poses} x={left} y={top} width={topfbertWidth} />
      </Stage>
    );
  },
};
