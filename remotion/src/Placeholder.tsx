import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Placeholder as Dish, PlaceholderTheme } from "../../shared/placeholders";
import { placeholderBrief } from "./briefs";
import { type Pose, poseAt } from "./motion";
import { innerMarkup } from "./svg";

// One Placeholder Image loop: the dish's full-canvas layers stacked by z in the
// shared 120×120 viewBox, drawn into the centred 800×800 safe square of the
// 800×1000 canvas. The baked-in background is the dish's ground tint, so the
// strip outside the square blends in and object-fit: cover crops cleanly.

type Layer = {
  name: string;
  markup: string;
  loop: string | null;
  pivot: string | null;
};

export type PlaceholderProps = {
  dish: Dish;
  theme: PlaceholderTheme;
  // Filled in by calculateMetadata from the handoff's assets.
  layers: Layer[];
};

type LayerSpec = {
  file: string;
  name: string;
  animated: boolean;
  loop: string | null;
  pivot: string | null;
};

export const calculatePlaceholderMetadata: CalculateMetadataFunction<
  PlaceholderProps
> = async ({ props }) => {
  const dir = `assets/illustrations/${props.dish}`;
  const spec = await fetch(staticFile(`${dir}/layers.json`)).then((r) => r.json());
  const layers = await Promise.all(
    (spec[props.theme] as LayerSpec[]).map(async (layer) => ({
      name: layer.name,
      markup: innerMarkup(await fetch(staticFile(`${dir}/${layer.file}`)).then((r) => r.text())),
      loop: layer.animated ? layer.loop : null,
      pivot: layer.pivot,
    })),
  );
  return { ...placeholderBrief(props.dish).video, props: { ...props, layers } };
};

const transform = (pose: Pose) =>
  `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scaleX}, ${pose.scaleY})`;

export const Placeholder: React.FC<PlaceholderProps> = ({ dish, theme, layers }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const side = Math.min(width, height);

  return (
    <AbsoluteFill style={{ backgroundColor: placeholderBrief(dish).background[theme] }}>
      <svg
        viewBox="0 0 120 120"
        width={side}
        height={side}
        style={{ position: "absolute", left: (width - side) / 2, top: (height - side) / 2 }}
      >
        {layers.map((layer) => {
          const pose = layer.loop ? poseAt(layer.loop, frame, fps) : null;
          return (
            <g
              key={layer.name}
              style={
                pose
                  ? {
                      // Pivots in layers.json are relative to the layer's own
                      // bounding box, null meaning its centre.
                      transformBox: "fill-box",
                      transformOrigin: layer.pivot ?? "center",
                      transform: transform(pose),
                      opacity: pose.opacity,
                    }
                  : undefined
              }
              dangerouslySetInnerHTML={{ __html: layer.markup }}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
