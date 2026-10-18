import { ACCENT, palette } from "../clips/draw";

// The app's look, for the brag video: tokens.css colours and the two fonts.

export const LIGHT = palette("light");
export { ACCENT };

export const DISPLAY = "Petrona, Georgia, serif";
export const UI = "Figtree, system-ui, sans-serif";

// `color` mixed into white by `percent`, in sRGB, as a hex colour that
// interpolateColors can take (the app's own mixes are in oklch; close enough
// for a page tint).
export const tint = (color: string, percent: number, base: string = LIGHT.bg) => {
  const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [rgb(color), rgb(base)];
  return `#${a.map((v, i) => Math.round(v * (percent / 100) + b[i]! * (1 - percent / 100)).toString(16).padStart(2, "0")).join("")}`;
};

// The app's springy pop (motion.json "pop"), as a Remotion spring config.
export const POP = { damping: 12, stiffness: 180, mass: 0.8 };
export const SOFT = { damping: 20, stiffness: 120, mass: 1 };
