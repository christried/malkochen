import { Composition, Folder } from "remotion";
import { PLACEHOLDER_THEMES, PLACEHOLDERS } from "../../shared/placeholders";
import { clipBrief, clipVideo, LANDSCAPE_CLIPS, placeholderBrief } from "./briefs";
import { calculateClipMetadata, ClipVideo } from "./ClipVideo";
import { CLIPS } from "./clips/registry";
import { calculatePlaceholderMetadata, Placeholder } from "./Placeholder";

// One composition per video and theme. scripts/render.ts names the output
// files from the props (public/placeholders/<dish>-<theme>.*,
// public/clips/<clip>[-landscape]-<theme>.*), so the id is only for Studio.
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
          [false, ...(LANDSCAPE_CLIPS.includes(id) ? [true] : [])].flatMap((landscape) =>
            PLACEHOLDER_THEMES.map((theme) => {
              const name = `${id}${landscape ? "-landscape" : ""}-${theme}`;
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
    </>
  );
};
