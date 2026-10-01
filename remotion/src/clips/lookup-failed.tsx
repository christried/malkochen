import { defineClip } from "./clip";
import { Stage } from "./draw";
import { Topfbert, type TopfbertPart, topfbertPoses } from "./topfbert";

// The lookup failed: Topfbert oops, tilted, breaks into a sweat drop that
// slides off. Just him, on the card's surface-muted.

const FRAMES = 72;

export const lookupFailed = defineClip<TopfbertPart>({
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
          bottom={0.96 * height}
          width={topfbertWidth}
        />
      </Stage>
    );
  },
});
