import { loadFont as loadFigtree } from "@remotion/google-fonts/Figtree";
import { loadFont as loadPetrona } from "@remotion/google-fonts/Petrona";
import {
  type CalculateMetadataFunction,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type ClipId, clipBrief, clipVideo, type Poster } from "./briefs";
import type { Art, Mood, Theme } from "./clips/clip";
import { clipById } from "./clips/registry";
import { innerMarkup, viewBoxOf } from "./svg";

// One state, system or celebration clip in one theme. calculateMetadata loads
// the handoff art the clip asks for; the clip's Scene draws its timeline.

// The app's fonts (tokens.json font): Figtree 700 for the sign and the z's,
// Petrona 500 (the display weight) for the wordmark and the 10×.
loadFigtree("normal", { weights: ["700"], subsets: ["latin"] });
loadPetrona("normal", { weights: ["500"], subsets: ["latin"] });

export type ClipProps = {
  clip: ClipId;
  theme: Theme;
  // The clip's landscape render (LANDSCAPE_CLIPS), on its 16:9 canvas.
  landscape: boolean;
  // The brief's still, for scripts/render.ts, which can't read the briefs.
  poster: Poster;
  // Filled in by calculateMetadata.
  art: Art;
};

const text = (path: string) => fetch(staticFile(path)).then((r) => r.text());

type MoodSpec = { layers: { file: string; name: string }[] };

export const calculateClipMetadata: CalculateMetadataFunction<ClipProps> = async ({ props }) => {
  const { art } = clipById(props.clip);
  const svgs = Object.fromEntries(
    await Promise.all(
      (art.svgs ?? []).map(async (path) => {
        const svg = await text(`assets/${path}`);
        return [path, { viewBox: viewBoxOf(svg), markup: innerMarkup(svg) }] as const;
      }),
    ),
  );
  const moods: Record<Mood, MoodSpec> = art.topfbert?.length
    ? (JSON.parse(await text("assets/topfbert/layers.json")).moods as Record<Mood, MoodSpec>)
    : ({} as Record<Mood, MoodSpec>);
  const topfbert = Object.fromEntries(
    await Promise.all(
      (art.topfbert ?? []).map(async (mood) => {
        const layers = await Promise.all(
          moods[mood].layers.map(async (layer) => ({
            name: layer.name,
            markup: innerMarkup(await text(`assets/topfbert/${layer.file}`)),
          })),
        );
        return [mood, layers] as const;
      }),
    ),
  );
  return { ...clipVideo(props.clip, props.landscape), props: { ...props, art: { svgs, topfbert } } };
};

export const ClipVideo: React.FC<ClipProps> = ({ clip, theme, art }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { Scene, poses } = clipById(clip);
  return (
    <Scene
      theme={theme}
      background={clipBrief(clip).background[theme]}
      poses={poses(frame)}
      art={art}
      width={width}
      height={height}
    />
  );
};
