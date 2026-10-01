import { AbsoluteFill } from "remotion";
import { REST, type Pose } from "../motion";
import type { Svg, Theme } from "./clip";

// Drawing helpers shared by the clip scenes. A scene is a blob (HTML, for the
// app's border-radius blob shape) under one SVG in canvas pixels, into which
// the handoff's art is placed. Poses apply in the art's own viewBox units, so
// the briefs' and layers.json's distances and pivots read as written.

// tokens.css
const THEMES = {
  light: { bg: "#F7F6F2", surface: "#FFFFFF", surfaceMuted: "#EFEDE8", text: "#1F1E1C", textMuted: "#6F6B65" },
  dark: { bg: "#131211", surface: "#1E1C1A", surfaceMuted: "#2A2825", text: "#F3EFE8", textMuted: "#A8A298" },
} as const;

export const ACCENT = {
  butter: "#F7B94A",
  orchid: "#DE8CF2",
  sage: "#A5C7AE",
  carrot: "#F08A5D",
  sky: "#A8BEE3",
} as const;

// The ink every character keeps in both themes (topfbert/layers.json).
export const INK = "#1F1E1C";

export const palette = (theme: Theme) => THEMES[theme];

// Tailwind's color-mix(in oklch, accent p%, base), as the app's stills mix.
export const mix = (color: string, percent: number, base: string) =>
  `color-mix(in oklch, ${color} ${percent}%, ${base})`;

// tokens.css --radius-blob
const BLOB_RADIUS = "48% 52% 46% 54% / 55% 50% 50% 45%";

// The shapes are drawn in ink on white; in the dark theme they take the
// theme's text and surface instead, as the app's stills draw them.
export const themed = (svg: Svg, theme: Theme): Svg => {
  if (theme === "light") return svg;
  const { text, surface } = palette(theme);
  return {
    ...svg,
    markup: svg.markup.replace(/#1F1E1C/gi, text).replace(/#FFFFFF\b|#fff\b/gi, surface),
  };
};

export const Blob: React.FC<{ inset: number; background: string; opacity?: number }> = ({
  inset,
  background,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      inset: `${inset}%`,
      borderRadius: BLOB_RADIUS,
      background,
      opacity,
    }}
  />
);

export const Stage: React.FC<{
  width: number;
  height: number;
  background: string;
  under?: React.ReactNode;
  children: React.ReactNode;
}> = ({ width, height, background, under, children }) => (
  <AbsoluteFill style={{ background }}>
    {under}
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ position: "absolute" }}>
      {children}
    </svg>
  </AbsoluteFill>
);

// A pose as an SVG transform about a pivot, in the same units as the pose.
export const poseTransform = (pose: Pose, [px, py]: [number, number]) =>
  `translate(${pose.x} ${pose.y}) translate(${px} ${py}) rotate(${pose.rotate}) scale(${pose.scaleX} ${pose.scaleY}) translate(${-px} ${-py})`;

// Scales an SVG's viewBox onto `width` canvas pixels with its top-left at x, y.
export const placement = (svg: Svg, x: number, y: number, width: number) => {
  const [minX, minY, w] = svg.viewBox;
  return `translate(${x} ${y}) scale(${width / w}) translate(${-minX} ${-minY})`;
};

export const heightFor = (svg: Svg, width: number) => (width * svg.viewBox[3]) / svg.viewBox[2];

// One piece of art at x, y (top-left, canvas px), `width` wide. `pivot` is in
// the art's viewBox units and defaults to its centre.
export const Place: React.FC<{
  svg: Svg;
  x: number;
  y: number;
  width: number;
  pose?: Pose;
  pivot?: [number, number];
  color?: string;
  filter?: string;
}> = ({ svg, x, y, width, pose = REST, pivot, color, filter }) => {
  const [minX, minY, w, h] = svg.viewBox;
  return (
    <g transform={placement(svg, x, y, width)} style={{ color, filter }}>
      <g
        transform={poseTransform(pose, pivot ?? [minX + w / 2, minY + h / 2])}
        opacity={pose.opacity}
        dangerouslySetInnerHTML={{ __html: svg.markup }}
      />
    </g>
  );
};

// One <g id="…"> of a handoff SVG (the Wi-Fi sign's arcs, say), on its own.
// The handoff's groups don't nest, so the first </g> closes it.
export const piece = (svg: Svg, id: string): Svg => {
  const start = svg.markup.indexOf(`<g id="${id}"`);
  if (start === -1) throw new Error(`No <g id="${id}">`);
  const end = svg.markup.indexOf("</g>", start) + "</g>".length;
  return { ...svg, markup: svg.markup.slice(start, end) };
};
