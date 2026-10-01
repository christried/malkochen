import { AbsoluteFill } from "remotion";
import { uniformScale } from "../motion";
import { defineClip, keys } from "./clip";
import { INK, palette, Place, piece, poseTransform, Stage } from "./draw";

// Cold start: on the Board's background the icon's butter gradient blooms
// from the centre, the icon springs in, its lid pops, the wordmark rises with
// its dot, and the icon zooms out as it fades for Vue's cross-fade to the
// Board at f33. One-shot.

const ICON = "icon/icon.svg";
const LID = "icon/icon-layers/03-lid.svg";
// gradient.icon: #FCD980 → #F29B32 at 160° (CSS: clockwise from "to top").
const GRADIENT_ANGLE = (160 * Math.PI) / 180;
// The icon's face colour.
const DOT = "#E0891E";

export const splash = defineClip<"bloom" | "icon" | "lid" | "wordmark" | "dot">({
  id: "splash",
  art: { svgs: [ICON, LID] },
  poses: (frame) => ({
    // A circle of CSS circle(100%)'s radius, grown to the brief's 150%.
    bloom: keys(frame, [{ at: 0, ...uniformScale(0) }, { at: 10, ...uniformScale(1.5) }]),
    icon: keys(frame, [
      { at: 0, ...uniformScale(0), opacity: 0 },
      { at: 2, ...uniformScale(0.2), ease: "ease-out" },
      { at: 7, ...uniformScale(1.14) },
      { at: 10 },
      { at: 29, ease: "ease-in" },
      { at: 33, ...uniformScale(1.9), opacity: 0 },
    ]),
    // In the icon's 108-unit viewBox.
    lid: keys(frame, [
      { at: 10, ease: "ease-out" },
      { at: 12, y: -14, rotate: -12, ease: "ease-in" },
      { at: 16 },
    ]),
    // Canvas px.
    // Settled by the f16 still, a frame before the storyboard's "to f17".
    wordmark: keys(frame, [{ at: 13, y: 60, opacity: 0, ease: "ease-out" }, { at: 16 }]),
    dot: keys(frame, [
      { at: 13, ...uniformScale(0), ease: "ease-out" },
      { at: 15, ...uniformScale(1.3) },
      { at: 16 },
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
    // circle(100%): the radius CSS takes as 100% for a box this size.
    const bloomRadius = Math.hypot(width, height) / Math.SQRT2;
    // The CSS gradient line: through the centre at the angle, as long as the
    // box's extent along it.
    const [dx, dy] = [Math.sin(GRADIENT_ANGLE), -Math.cos(GRADIENT_ANGLE)];
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    return (
      <AbsoluteFill>
        <Stage width={width} height={height} background={palette(theme).bg}>
          <defs>
            <linearGradient
              id="bloom"
              gradientUnits="userSpaceOnUse"
              x1={width / 2 - dx * half}
              y1={height / 2 - dy * half}
              x2={width / 2 + dx * half}
              y2={height / 2 + dy * half}
            >
              <stop offset="0" stopColor="#FCD980" />
              <stop offset="1" stopColor="#F29B32" />
            </linearGradient>
          </defs>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={bloomRadius}
            fill="url(#bloom)"
            transform={poseTransform(poses.bloom, [width / 2, height / 2])}
          />
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
});
