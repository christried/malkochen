import { Composition, Folder } from "remotion";
import { PLACEHOLDER_THEMES, PLACEHOLDERS } from "../../shared/placeholders";
import { clipBrief, placeholderBrief } from "./briefs";
import { calculateClipMetadata, ClipVideo } from "./ClipVideo";
import { CLIPS } from "./clips/registry";
import { calculatePlaceholderMetadata, Placeholder } from "./Placeholder";

// One composition per video and theme. scripts/render.ts names the output
// files from the props (public/placeholders/<dish>-<theme>.*,
// public/clips/<clip>-<theme>.*), so the id is only for Studio.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="placeholders">
        {PLACEHOLDERS.flatMap((dish) =>
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
          PLACEHOLDER_THEMES.map((theme) => (
            <Composition
              key={`${id}-${theme}`}
              id={`${id}-${theme}`}
              component={ClipVideo}
              {...clipBrief(id).video}
              defaultProps={{
                clip: id,
                theme,
                posterFrame: clipBrief(id).posterFrame,
                art: { svgs: {}, topfbert: {} },
              }}
              calculateMetadata={calculateClipMetadata}
            />
          )),
        )}
      </Folder>
    </>
  );
};
