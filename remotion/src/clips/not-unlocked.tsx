import { REST } from "../motion";
import { defineClip, swing } from "./clip";
import { ACCENT, Blob, Place, Stage } from "./draw";
import { Topfbert, type TopfbertPart, topfbertPoses } from "./topfbert";

// Account not unlocked: Topfbert happy beside his "Bald!" sign, which sways
// −8° ↔ +8° on its post. Laid out like the still on the login page.

const FRAMES = 84;

export const notUnlocked = defineClip<TopfbertPart | "sign">({
  id: "not-unlocked",
  art: { svgs: ["shapes/sign.svg"], topfbert: ["happy"] },
  poses: (frame) => ({
    ...topfbertPoses("happy", frame, { period: FRAMES, blink: FRAMES }),
    sign: { ...REST, rotate: swing(frame, FRAMES, 8) },
  }),
  Scene: ({ background, poses, art, width, height }) => {
    const sign = art.svgs["shapes/sign.svg"];
    const signWidth = 0.42 * width;
    const topfbertWidth = 0.62 * width;
    return (
      <Stage
        width={width}
        height={height}
        background={background}
        under={<Blob inset={12} background={ACCENT.sky} opacity={0.4} />}
      >
        <Topfbert
          layers={art.topfbert.happy!}
          poses={poses}
          x={0.08 * width}
          bottom={height}
          width={topfbertWidth}
        />
        <Place
          svg={sign}
          x={width - 0.02 * width - signWidth}
          y={0.06 * height}
          width={signWidth}
          pose={poses.sign}
          // The foot of the post.
          pivot={[58, 88]}
        />
      </Stage>
    );
  },
});
