import { AbsoluteFill } from "remotion";
import { keys, type Clip } from "./clip";
import { INK, palette, Place, piece, poseTransform, Stage } from "./draw";

// Cold start: on the Board's background the icon's butter gradient blooms
// from the centre, the icon springs in, its lid pops, the wordmark rises with
// its dot, and the icon zooms out as it fades for Vue's cross-fade to the
// Board at f33. One-shot.

const ICON = "icon/icon.svg";
const LID = "icon/icon-layers/03-lid.svg";
// gradient.icon, 160°
const GRADIENT = "linear-gradient(160deg, #FCD980, #F29B32)";
// The icon's face colour.
const DOT = "#E0891E";

const size = (scale: number) => ({ scaleX: scale, scaleY: scale });

export const splash: Clip = {
  id: "splash",
  art: { svgs: [ICON, LID] },
  poses: (frame) => ({
    // scaleX is the clip circle's radius, 1 = circle(100%).
    bloom: keys(frame, [{ at: 0, ...size(0) }, { at: 10, ...size(1.5) }]),
    icon: keys(frame, [
      { at: 0, ...size(0), opacity: 0 },
      { at: 2, ...size(0.2), ease: "ease-out" },
      { at: 7, ...size(1.14) },
      { at: 10 },
      { at: 29, ease: "ease-in" },
      { at: 33, ...size(1.9), opacity: 0 },
    ]),
    // In the icon's 108-unit viewBox.
    lid: keys(frame, [
      { at: 10, ease: "ease-out" },
      { at: 12, y: -14, rotate: -12, ease: "ease-in" },
      { at: 16 },
    ]),
    // Canvas px.
    wordmark: keys(frame, [{ at: 13, y: 60, opacity: 0, ease: "ease-out" }, { at: 17 }]),
    dot: keys(frame, [
      { at: 13, ...size(0), ease: "ease-out" },
      { at: 15.5, ...size(1.3) },
      { at: 17 },
    ]),
  }),
  Scene: ({ theme, poses, art, width, height }) => {
    const icon = art.svgs[ICON];
    // The icon without its lid, which pops on its own.
    const pot = { ...icon, markup: icon.markup.replace(piece(icon, "lid").markup, "") };
    const iconSize = 0.36 * width;
    const cx = width / 2;
    const cy = 0.44 * height;
    const fontSize = 0.12 * width;
    return (
      <AbsoluteFill>
        <Stage
          width={width}
          height={height}
          background={palette(theme).bg}
          under={
            <AbsoluteFill
              style={{ background: GRADIENT, clipPath: `circle(${poses.bloom.scaleX * 100}% at 50% 50%)` }}
            />
          }
        >
          <g transform={poseTransform(poses.icon, [cx, cy])} opacity={poses.icon.opacity}>
            <g style={{ filter: "drop-shadow(0 24px 40px rgba(120,60,0,.25))" }}>
              <Place svg={pot} x={cx - iconSize / 2} y={cy - iconSize / 2} width={iconSize} />
            </g>
            <Place
              svg={art.svgs[LID]}
              x={cx - iconSize / 2}
              y={cy - iconSize / 2}
              width={iconSize}
              pose={poses.lid}
            />
          </g>
        </Stage>
        <div
          style={{
            position: "absolute",
            top: cy + iconSize / 2 + 0.06 * height,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            gap: fontSize * 0.06,
            fontFamily: "Newsreader",
            fontSize,
            color: INK,
          }}
        >
          <span
            style={{
              transform: `translateY(${poses.wordmark.y}px)`,
              opacity: poses.wordmark.opacity,
            }}
          >
            malkochen
          </span>
          <span
            style={{
              width: fontSize * 0.2,
              height: fontSize * 0.2,
              borderRadius: "50%",
              background: DOT,
              transform: `scale(${poses.dot.scaleX})`,
            }}
          />
        </div>
      </AbsoluteFill>
    );
  },
};
