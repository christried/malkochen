import { Composition, Folder } from "remotion";
import { PLACEHOLDER_THEMES, PLACEHOLDERS } from "../../shared/placeholders";
import { placeholderBrief } from "./briefs";
import { calculatePlaceholderMetadata, Placeholder } from "./Placeholder";

// One composition per Placeholder Image and theme. scripts/render.ts names the
// output files from the props (public/placeholders/<dish>-<theme>.*), so the
// id is only for Studio.
export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
