import { loadFont as loadFigtree } from "@remotion/google-fonts/Figtree";
import { loadFont as loadPetrona } from "@remotion/google-fonts/Petrona";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  Freeze,
  Html5Audio,
  Img,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ACCENT, DISPLAY, LIGHT, POP, SOFT, tint, UI } from "./look";
import { Caption, Phone, type Touches } from "./Phone";
import { beat, CAPTIONS, CUE, POSTER_FRAME, SCENES, SHOTS, type ShotName, TINTS } from "./timeline";

// The brag video (#313): saved and never cooked → malkochen → the real app
// on a phone (shared from a food video, planned, a Column added, cooked) →
// the outro, every move on a beat of the music (timeline.ts). Its public
// dir is out/brag (scripts/render-brag.ts), where the capture, the
// soundtrack and the app's art are.

// Topfbert's bob: once every two beats.
const bob = (frame: number, height: number) => Math.sin((frame / beat(2)) * Math.PI * 2) * height;

loadFigtree("normal", { weights: ["500", "600", "700"], subsets: ["latin"] });
loadPetrona("normal", { weights: ["500"], subsets: ["latin"] });

// A tile of the opening grid: a saved Dish's photo, or its Placeholder Image
// (capture.ts writes grid.json).
export type GridTile = { photo: string } | { placeholder: string };
export type BragProps = { touches: Touches; grid: GridTile[] };

export const calculateBragMetadata: CalculateMetadataFunction<BragProps> = async () => {
  const touches = Object.fromEntries(
    await Promise.all(
      (Object.keys(SHOTS) as ShotName[]).map(async (shot) => {
        const res = await fetch(staticFile(`shots/${shot}/shot.json`));
        return [shot, ((await res.json()) as { touches: Touches[ShotName] }).touches] as const;
      }),
    ),
  ) as Touches;
  const grid = (await (await fetch(staticFile("grid.json"))).json()) as GridTile[];
  return { props: { touches, grid } };
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ACCENTS = [ACCENT.butter, ACCENT.orchid, ACCENT.sage, ACCENT.carrot, ACCENT.sky];

const TILE = 262;
const GAP = 26;

// Gespeichert … nie gekocht: saved Dishes piling up, one on every eighth
// note, each bookmarked; most as their photo, some drawn.
const Hook: React.FC<{ grid: GridTile[] }> = ({ grid }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame >= SCENES.hook.to + 8) return null;
  const never = spring({ frame: frame - beat(CUE.never), fps, config: POP });
  const leave = interpolate(frame, [SCENES.hook.to - 8, SCENES.hook.to + 4], [0, 1], clamp);
  const saved = spring({ frame, fps, config: POP });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 500,
          fontSize: 132,
          lineHeight: 1.08,
          letterSpacing: "-0.025em",
          color: LIGHT.text,
          opacity: 1 - leave,
          transform: `translateY(${-leave * 80}px)`,
        }}
      >
        <div style={{ transform: `scale(${0.7 + 0.3 * saved})`, opacity: saved }}>Gespeichert.</div>
        <div style={{ color: ACCENT.carrot, transform: `scale(${0.7 + 0.3 * never})`, opacity: never }}>Nie gekocht.</div>
      </div>
      {grid.map((tile, i) => {
        const pop = spring({ frame: frame - beat(i / 2), fps, config: POP });
        const mark = spring({ frame: frame - beat(i / 2) - 5, fps, config: POP });
        const out = spring({ frame: frame - (SCENES.hook.to - 10) - (i % 3) * 2, fps, config: SOFT });
        const [col, row] = [i % 3, Math.floor(i / 3)];
        const accent = ACCENTS[i % ACCENTS.length]!;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (1080 - 3 * TILE - 2 * GAP) / 2 + col * (TILE + GAP),
              top: 560 + row * (TILE + GAP),
              width: TILE,
              height: TILE,
              borderRadius: 64,
              background: tint(accent, 38, LIGHT.surface),
              boxShadow: "0 12px 30px rgba(31,30,28,0.10)",
              transform: `scale(${pop * (1 - out)}) rotate(${(1 - pop) * (i % 2 ? 12 : -12) + (row - 1) * never * 2}deg)`,
              filter: `saturate(${1 - 0.55 * never})`,
              opacity: 1 - 0.35 * never,
            }}
          >
            <div style={{ width: "100%", height: "100%", borderRadius: 64, overflow: "hidden" }}>
              <Img
                src={staticFile("photo" in tile ? tile.photo : `placeholders/${tile.placeholder}-light.svg`)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                right: -10,
                top: -10,
                width: 74,
                height: 74,
                borderRadius: "50%",
                background: LIGHT.text,
                display: "grid",
                placeItems: "center",
                transform: `scale(${mark})`,
              }}
            >
              <svg viewBox="0 0 24 24" width={34}>
                <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1z" fill={ACCENT.butter} />
              </svg>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Topfbert, from oops at the hook to waving at the reveal: one character
// travelling, his pose swapped on the cut.
const Topfbert: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < beat(CUE.never + 1) || frame >= SCENES.reveal.to + 4) return null;
  const pop = spring({ frame: frame - beat(CUE.never + 1), fps, config: POP });
  const travel = spring({ frame: frame - SCENES.reveal.from, fps, config: SOFT });
  const leave = interpolate(frame, [SCENES.phone.from - 12, SCENES.phone.from + 2], [0, 1], clamp);
  const size = 400 + 160 * travel;
  const cy = 1600 - 860 * travel - leave * 260;
  const pose = frame < SCENES.reveal.from ? "oops" : "waving";
  return (
    <Img
      src={staticFile(`illustrations/topfbert-${pose}.svg`)}
      style={{
        position: "absolute",
        left: 540 - size / 2,
        top: cy - size / 2 + bob(frame, 8) * travel,
        width: size,
        transform: `scale(${pop})`,
        opacity: 1 - leave,
      }}
    />
  );
};

const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < SCENES.reveal.from || frame >= SCENES.reveal.to + 4) return null;
  const line = spring({ frame: frame - beat(CUE.drop) - 2, fps, config: SOFT });
  const word = spring({ frame: frame - beat(CUE.malkochen), fps, config: POP });
  const leave = interpolate(frame, [SCENES.phone.from - 12, SCENES.phone.from + 2], [0, 1], clamp);
  // The sign-in screen's headline (strings: signIn.headline), the name
  // highlighted as it is there.
  return (
    <AbsoluteFill style={{ opacity: 1 - leave, transform: `translateY(${-leave * 260}px)` }}>
      <div
        style={{
          position: "absolute",
          top: 1070,
          width: "100%",
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 500,
          fontSize: 104,
          letterSpacing: "-0.02em",
          color: LIGHT.text,
          opacity: line,
          transform: `translateY(${(1 - line) * 30}px)`,
        }}
      >
        Was willst du
      </div>
      <div
        style={{
          position: "absolute",
          top: 1190,
          width: "100%",
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 500,
          fontSize: 168,
          letterSpacing: "-0.03em",
          color: LIGHT.text,
          opacity: word,
          transform: `translateY(${(1 - word) * 60}px) scale(${0.85 + 0.15 * word})`,
        }}
      >
        <span style={{ background: `linear-gradient(transparent 62%, ${ACCENT.butter} 62%, ${ACCENT.butter} 90%, transparent 90%)`, padding: "0 12px" }}>
          malkochen
        </span>
        ?
      </div>
    </AbsoluteFill>
  );
};

const VEGGIES = ["carrot", "pea", "pepper"];

// Topfbert happy, a burst of the Gekocht confetti's veggies, and the name.
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - SCENES.outro.from;
  if (t < 0) return null;
  // Topfbert and the veggies on the outro's downbeat, the name on the next
  // beat, a word on each beat after, the last one and the address as the
  // music breaks.
  const at = (cue: number) => frame - beat(cue);
  const pop = spring({ frame: at(CUE.outro), fps, config: POP });
  const word = spring({ frame: at(CUE.name), fps, config: POP });
  const steps = ["Sammeln.", "Planen.", "Kochen."];
  const url = spring({ frame: at(CUE.breakdown), fps, config: SOFT });
  return (
    <AbsoluteFill>
      {Array.from({ length: 16 }, (_, i) => {
        const age = at(CUE.outro) / fps;
        if (age < 0 || age > 1.6) return null;
        const angle = (i / 16) * Math.PI * 2 + 0.3;
        const speed = 900 + (i % 4) * 160;
        const x = 540 + Math.cos(angle) * speed * age;
        const y = 720 + Math.sin(angle) * speed * age + 900 * age * age;
        return (
          <Img
            key={i}
            src={staticFile(`illustrations/veggies/${VEGGIES[i % 3]}.svg`)}
            style={{
              position: "absolute",
              left: x - 36,
              top: y - 36,
              width: 72,
              transform: `rotate(${age * (i % 2 ? 400 : -400)}deg)`,
              opacity: interpolate(age, [1.1, 1.6], [1, 0], clamp),
            }}
          />
        );
      })}
      <Img
        src={staticFile("illustrations/topfbert-happy.svg")}
        style={{ position: "absolute", left: 540 - 250, top: 470 + bob(frame, 10), width: 500, transform: `scale(${pop})` }}
      />
      <div
        style={{
          position: "absolute",
          top: 1030,
          width: "100%",
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 500,
          fontSize: 190,
          letterSpacing: "-0.03em",
          color: LIGHT.text,
          opacity: word,
          transform: `translateY(${(1 - word) * 60}px)`,
        }}
      >
        malkochen
      </div>
      <div style={{ position: "absolute", top: 1290, width: "100%", display: "flex", justifyContent: "center", gap: 28 }}>
        {steps.map((step, i) => {
          const s = spring({ frame: at(CUE.steps + i), fps, config: POP });
          return (
            <span
              key={step}
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: 58,
                color: LIGHT.text,
                padding: "10px 30px",
                borderRadius: 999,
                background: [ACCENT.butter, ACCENT.orchid, ACCENT.sage][i],
                opacity: s,
                transform: `translateY(${(1 - s) * 40}px) scale(${0.8 + 0.2 * s})`,
              }}
            >
              {step}
            </span>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1640,
          width: "100%",
          textAlign: "center",
          opacity: url,
          transform: `translateY(${(1 - url) * 30}px)`,
        }}
      >
        <span
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: 50,
            color: LIGHT.surface,
            background: LIGHT.text,
            padding: "18px 40px",
            borderRadius: 999,
          }}
        >
          malkochen.christried.me
        </span>
      </div>
    </AbsoluteFill>
  );
};

// The page behind, in the tint of what the phone shows (TINTS).
const TINT_COLOURS = { bg: LIGHT.bg, butter: tint(ACCENT.butter, 26), orchid: tint(ACCENT.orchid, 24) };
const background = (frame: number) =>
  interpolateColors(
    frame,
    TINTS.map(([f]) => f),
    TINTS.map(([, colour]) => TINT_COLOURS[colour]),
  );

// Frame 0 is the poster (POSTER_FRAME), so every platform's thumbnail shows
// it; the soundtrack runs on regardless.
export const Brag: React.FC<BragProps> = ({ touches, grid }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Html5Audio src={staticFile("brag-audio.wav")} />
      <Freeze frame={POSTER_FRAME} active={frame === 0}>
        <Picture touches={touches} grid={grid} />
      </Freeze>
    </>
  );
};

const Picture: React.FC<BragProps> = ({ touches, grid }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: background(frame), overflow: "hidden" }}>
      <Hook grid={grid} />
      <Reveal />
      <Topfbert />
      {CAPTIONS.map((c) => (
        <Caption key={c.text} {...c} />
      ))}
      {frame >= SCENES.phone.from && frame < SCENES.phone.to + 20 ? <Phone touches={touches} /> : null}
      <Outro />
    </AbsoluteFill>
  );
};
