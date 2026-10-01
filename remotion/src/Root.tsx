import { Composition, Folder } from "remotion";
import { PLACEHOLDERS } from "../../shared/placeholders";
import { FPS, placeholderBrief, THEMES } from "./briefs";
import { calculatePlaceholderMetadata, Placeholder } from "./Placeholder";

// One composition per Placeholder Image and theme, named like the files the
// app serves: placeholder-pasta-light renders to public/placeholders/pasta-light.*
export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="placeholders">
      {PLACEHOLDERS.flatMap((dish) =>
        THEMES.map((theme) => {
          const { frames, canvas } = placeholderBrief(dish);
          return (
            <Composition
              key={`${dish}-${theme}`}
              id={`placeholder-${dish}-${theme}`}
              component={Placeholder}
              durationInFrames={frames}
              fps={FPS}
              width={canvas[0]}
              height={canvas[1]}
              defaultProps={{ dish, theme, layers: [] }}
              calculateMetadata={calculatePlaceholderMetadata}
            />
          );
        }),
      )}
    </Folder>
  );
};
