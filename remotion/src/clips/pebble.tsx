import type { Pose } from "../motion";
import type { Svg } from "./clip";
import { Place, poseTransform } from "./draw";

// The Board pebble (shapes/pebble.svg) on a surface, posed about its centre,
// with an optional label in it. The Board's own emoji is Vue's to draw on
// top, so the clips leave it out.
export const Pebble: React.FC<{
  svg: Svg;
  cx: number;
  cy: number;
  size: number;
  pose: Pose;
  fill: string;
  label?: { text: string; color: string };
}> = ({ svg, cx, cy, size, pose, fill, label }) => (
  <g transform={poseTransform(pose, [cx, cy])} opacity={pose.opacity}>
    <g style={{ filter: "drop-shadow(0 12px 18px rgba(70,55,30,.18))" }}>
      <Place svg={svg} x={cx - size / 2} y={cy - size / 2} width={size} color={fill} />
    </g>
    {label ? (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Newsreader"
        fontSize={size * 0.36}
        fill={label.color}
      >
        {label.text}
      </text>
    ) : null}
  </g>
);
