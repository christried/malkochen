import { defineClip } from "./clip";
import { Stage } from "./draw";
import { Topfbert, type TopfbertPart, topfbertPoses } from "./topfbert";

// The sign-in hero's centre: Topfbert wow, bobbing, with three sparkles. The
// ring of Placeholder tiles around him is Vue.

const FRAMES = 84;

export const topfbertWow = defineClip<TopfbertPart>({
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
          bottom={0.94 * height}
          width={topfbertWidth}
        />
      </Stage>
    );
  },
});
