import type { Clip } from "./clip";
import { Stage } from "./draw";
import { Topfbert, topfbertHeight, topfbertPoses } from "./topfbert";

// The sign-in hero's centre: Topfbert wow, bobbing, with three sparkles. The
// ring of Placeholder tiles around him is Vue.

const FRAMES = 84;

export const topfbertWow: Clip = {
  id: "topfbert-wow",
  art: { topfbert: ["wow"] },
  poses: (frame) => topfbertPoses("wow", frame, { period: FRAMES }),
  Scene: ({ background, poses, art, width, height }) => {
    const topfbertHeightPx = 0.84 * height;
    const topfbertWidth = (topfbertHeightPx * 140) / 150;
    return (
      <Stage width={width} height={height} background={background}>
        <Topfbert
          layers={art.topfbert.wow!}
          poses={poses}
          x={(width - topfbertWidth) / 2}
          y={height - 0.06 * height - topfbertHeight(topfbertWidth)}
          width={topfbertWidth}
        />
      </Stage>
    );
  },
};
