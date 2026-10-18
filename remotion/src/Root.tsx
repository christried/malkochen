import { Composition, Folder } from "remotion";
import { PLACEHOLDER_THEMES } from "../../shared/placeholders";
import { Brag, calculateBragMetadata } from "./brag/Brag";
import { DURATION, FPS, HEIGHT, WIDTH } from "./brag/timeline";
import { clipBrief, clipVideo, LANDSCAPE_CLIPS, placeholderBrief, STUDIO_PLACEHOLDERS } from "./briefs";
import { calculateClipMetadata, ClipVideo } from "./ClipVideo";
import { CLIPS } from "./clips/registry";
import { calculatePlaceholderMetadata, Placeholder } from "./Placeholder";
import { clipName } from "./render-settings";

// One composition per video and theme. scripts/render.ts names the output
// files from the props (public/placeholders/<dish>-<theme>.*,
// public/clips/<clip>[-landscape]-<theme>.*), so the id is only for Studio.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="placeholders">
        {STUDIO_PLACEHOLDERS.flatMap((dish) =>
          PLACEHOLDER_THEMES.map((theme) => (
            <Composition
              key={`${dish}-${theme}`}
              id={`placeholder-${dish}-${theme}`}
              component={Placeholder}
              {...placeholderBrief(dish).video}
              defaultProps={{ dish, theme, layers: [] }}
              calculateMetadata={calculatePlaceholderMetadata}
            />
          )),
        )}
      </Folder>
      <Folder name="clips">
        {CLIPS.flatMap(({ id }) =>
          [false, ...(LANDSCAPE_CLIPS.includes(id) ? [true] : [])].flatMap((landscape) =>
            PLACEHOLDER_THEMES.map((theme) => {
              const name = `${clipName(id, landscape)}-${theme}`;
              return (
                <Composition
                  key={name}
                  id={name}
                  component={ClipVideo}
                  {...clipVideo(id, landscape)}
                  defaultProps={{
                    clip: id,
                    theme,
                    landscape,
                    poster: clipBrief(id).poster,
                    art: { svgs: {}, topfbert: {} },
                  }}
                  calculateMetadata={calculateClipMetadata}
                />
              );
            }),
          ),
        )}
      </Folder>
      {/* The brag video (#313): rendered with out/brag as its public dir
          (scripts/render-brag.ts), not the handoff. */}
      <Composition
        id="brag"
        component={Brag}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ touches: { share: [], plan: [], columns: [], cook: [] } }}
        calculateMetadata={calculateBragMetadata}
      />
    </>
  );
};
