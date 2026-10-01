import type { Clip } from "./clip";
import { Stage } from "./draw";
import { Topfbert, topfbertHeight, topfbertPoses } from "./topfbert";

// The lookup failed: Topfbert oops, tilted, breaks into a sweat drop that
// slides off. Just him, on the card's surface-muted.

const FRAMES = 72;

export const lookupFailed: Clip = {
  id: "lookup-failed",
  art: { topfbert: ["oops"] },
  poses: (frame) => topfbertPoses("oops", frame, { period: FRAMES }),
  Scene: ({ background, poses, art, width, height }) => {
    const topfbertWidth = 0.78 * width;
    return (
      <Stage width={width} height={height} background={background}>
        <Topfbert
          layers={art.topfbert.oops!}
          poses={poses}
          x={(width - topfbertWidth) / 2}
          y={height - 0.04 * height - topfbertHeight(topfbertWidth)}
          width={topfbertWidth}
        />
      </Stage>
    );
  },
};
