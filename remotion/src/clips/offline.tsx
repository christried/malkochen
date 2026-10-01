import { REST } from "../motion";
import { cycle, defineClip, keys } from "./clip";
import { ACCENT, Blob, mix, palette, piece, Place, Stage } from "./draw";
import { Topfbert, type TopfbertPart, topfbertPoses } from "./topfbert";

// Offline: Topfbert asleep, desaturated, on a sky blob beside a Wi-Fi sign
// whose outer two arcs fade out one after the other and come back. Laid out
// like OfflineIllustration.vue, which draws the f40 still.

const FRAMES = 72;
const WIFI = "shapes/wifi.svg";

const fade = (frame: number, start: number) =>
  keys(cycle(frame, FRAMES), [
    { at: 0 },
    { at: start },
    { at: start + 9, opacity: 0.12 },
    { at: 62, opacity: 0.12 },
    { at: FRAMES },
  ]);

export const offline = defineClip<TopfbertPart | "wifi.outer" | "wifi.inner">({
  id: "offline",
  art: { svgs: [WIFI], topfbert: ["sleep"] },
  poses: (frame) => ({
    ...topfbertPoses("sleep", frame, { period: FRAMES }),
    "wifi.outer": fade(frame, 20),
    "wifi.inner": fade(frame, 31),
  }),
  Scene: ({ theme, background, poses, art, width, height }) => {
    const { bg, text } = palette(theme);
    const wifi = art.svgs[WIFI];
    const topfbertWidth = 0.56 * width;
    const wifiAt = { x: width - 0.1 * width - 0.26 * width, y: 0.1 * height, width: 0.26 * width };
    return (
      <Stage
        width={width}
        height={height}
        background={background}
        under={<Blob inset={6} background={mix(ACCENT.sky, 28, bg)} />}
      >
        <Topfbert
          layers={art.topfbert.sleep!}
          poses={poses}
          x={0.12 * width}
          bottom={0.96 * height}
          width={topfbertWidth}
          filter="saturate(.4)"
        />
        <Place svg={piece(wifi, "arc_3")} {...wifiAt} pose={poses["wifi.outer"]} color={text} />
        <Place svg={piece(wifi, "arc_2")} {...wifiAt} pose={poses["wifi.inner"]} color={text} />
        <Place svg={piece(wifi, "arc_1")} {...wifiAt} pose={REST} color={text} />
        <Place svg={piece(wifi, "dot")} {...wifiAt} color={text} />
      </Stage>
    );
  },
});
