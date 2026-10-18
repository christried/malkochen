import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, DISPLAY, LIGHT, POP, UI } from "./look";
import { INTRO_TAPS, SCENES, SHOTS, type ShotName, shotAt } from "./timeline";

// The phone, and on its screen the real app as captured (capture/capture.ts),
// after a made-up food video shared to it. Drawn in the app's CSS pixels
// (PHONE in capture/settings.ts), scaled to the screen's width.

export const SCREEN = { width: 412, height: 892 };
const SCREEN_PX = 700;
const SCALE = SCREEN_PX / SCREEN.width;
const BEZEL = 16;

export type Touch = { frame: number; x: number; y: number; phase: "down" | "move" | "up" };
export type Touches = Record<ShotName, Touch[]>;

// Every touch at its video frame: the shots' (from their shot.json) and the
// made-up share's taps.
const videoTouches = (touches: Touches, shareIcon: { x: number; y: number }, malkochenIcon: { x: number; y: number }) => [
  { frame: INTRO_TAPS.share, ...shareIcon, phase: "down" as const },
  { frame: INTRO_TAPS.share + 3, ...shareIcon, phase: "up" as const },
  { frame: INTRO_TAPS.malkochen, ...malkochenIcon, phase: "down" as const },
  { frame: INTRO_TAPS.malkochen + 4, ...malkochenIcon, phase: "up" as const },
  ...(Object.keys(SHOTS) as ShotName[]).flatMap((shot) =>
    touches[shot]
      .map((t) => ({ ...t, frame: SHOTS[shot].at + t.frame - SHOTS[shot].from }))
      .filter((t) => t.frame >= SHOTS[shot].at),
  ),
];

// The centres of the share icon and of malkochen's in the share sheet.
const SHARE_ICON = { x: 378, y: 645 };
const MALKOCHEN_ICON = { x: 255, y: 751 };

// A fingertip: in 4 frames before it touches, pressed while down (following
// its moves), a ripple as it lets go.
const Finger: React.FC<{ touches: Touches }> = ({ touches }) => {
  const frame = useCurrentFrame();
  const all = videoTouches(touches, SHARE_ICON, MALKOCHEN_ICON);
  const next = all.find((t) => t.frame > frame);
  const last = [...all].reverse().find((t) => t.frame <= frame);
  let x: number, y: number, pressed: number, opacity: number, ripple = 0;
  if (last && last.phase !== "up") {
    const moveTo = next && next.phase === "move" ? next : null;
    const k = moveTo ? (frame - last.frame) / (moveTo.frame - last.frame) : 0;
    x = last.x + ((moveTo?.x ?? last.x) - last.x) * k;
    y = last.y + ((moveTo?.y ?? last.y) - last.y) * k;
    pressed = 1;
    opacity = 1;
  } else if (next && next.phase === "down" && next.frame - frame <= 5) {
    ({ x, y } = next);
    pressed = 0;
    opacity = interpolate(next.frame - frame, [0, 5], [1, 0]);
  } else if (last && last.phase === "up" && frame - last.frame <= 8) {
    ({ x, y } = last);
    pressed = 0;
    ripple = (frame - last.frame) / 8;
    opacity = 1 - ripple;
  } else {
    return null;
  }
  const size = 46 * (1 - 0.18 * pressed);
  return (
    <>
      {ripple > 0 ? (
        <div
          style={{
            position: "absolute",
            left: x - 30 - 26 * ripple,
            top: y - 30 - 26 * ripple,
            width: 60 + 52 * ripple,
            height: 60 + 52 * ripple,
            borderRadius: "50%",
            border: `3px solid rgba(255,255,255,${0.9 * (1 - ripple)})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.72)",
          boxShadow: "0 4px 18px rgba(31,30,28,0.35), inset 0 0 0 2px rgba(31,30,28,0.12)",
          opacity,
        }}
      />
    </>
  );
};

const Icon: React.FC<{ d: string; label?: string; y: number }> = ({ d, label, y }) => (
  <div style={{ position: "absolute", left: 352, top: y, width: 52, textAlign: "center", color: "#fff", fontFamily: UI, fontSize: 12, fontWeight: 600 }}>
    <svg viewBox="0 0 24 24" width={34} height={34} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))" }}>
      <path d={d} fill="#fff" />
    </svg>
    {label ? <div style={{ marginTop: 2 }}>{label}</div> : null}
  </div>
);

const AppTile: React.FC<{ label: string; children: React.ReactNode; lit?: number }> = ({ label, children, lit = 0 }) => (
  <div style={{ width: 76, textAlign: "center", fontFamily: UI, fontSize: 13, color: LIGHT.text }}>
    <div
      style={{
        width: 58,
        height: 58,
        margin: "0 auto",
        borderRadius: "50%",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        transform: `scale(${1 + 0.12 * lit})`,
      }}
    >
      {children}
    </div>
    <div style={{ marginTop: 8, fontWeight: lit ? 700 : 500 }}>{label}</div>
  </div>
);

// A food video, shared: its share icon, then the share sheet, then
// malkochen in it.
const ShareIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sheet = spring({ frame: frame - INTRO_TAPS.share - 3, fps, config: { damping: 18, stiffness: 160 } });
  const lit = interpolate(frame, [INTRO_TAPS.malkochen, INTRO_TAPS.malkochen + 3, INTRO_TAPS.malkochen + 8], [0, 1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = interpolate(frame, [SCENES.shareIntro.from, SCENES.shareIntro.to], [1.04, 1.12]);
  const progress = interpolate(frame, [SCENES.shareIntro.from, SCENES.shareIntro.to], [0.18, 0.46]);
  return (
    // The dark bowl's own ground, so its square doesn't show.
    <AbsoluteFill style={{ background: "#3B423D" }}>
      <Img
        src={staticFile("placeholders/bowl-dark.svg")}
        style={{ position: "absolute", left: 26, top: 170, width: 360, transform: `scale(${drift})` }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, transparent 35%, rgba(12,11,10,.7) 90%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(transparent 55%, rgba(0,0,0,.55))" }} />
      <Icon y={440} d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
      <Icon y={520} d="M12 3C6.5 3 2 6.9 2 11.6c0 2.4 1.2 4.6 3.1 6.1L4.4 21l4.1-2c1.1.3 2.3.5 3.5.5 5.5 0 10-3.9 10-8.6S17.5 3 12 3z" />
      <Icon y={600} d="M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1z" />
      <Icon y={628} label="Teilen" d="M14 4l8 7.5-8 7.5v-4.6c-5.6 0-9.2 1.7-12 5.6 1.1-5.6 4.5-11 12-12.1V4z" />
      <div style={{ position: "absolute", left: 18, bottom: 54, right: 90, color: "#fff", fontFamily: UI, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>@veganfoodclub</div>
        <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.35 }}>Crispy Tofu Bowl in 15 Minuten 🔥 #vegan #mealprep</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, height: 3, background: "rgba(255,255,255,.25)" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: "#fff" }} />
      </div>
      <AbsoluteFill style={{ background: `rgba(0,0,0,${0.4 * sheet})` }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 250,
          background: LIGHT.surface,
          borderRadius: "26px 26px 0 0",
          transform: `translateY(${(1 - sheet) * 260}px)`,
          padding: "12px 18px",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: LIGHT.surfaceMuted, margin: "0 auto" }} />
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 18, color: LIGHT.text, marginTop: 18 }}>Teilen mit</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "0 4px" }}>
          <AppTile label="Nachricht">
            <div style={{ width: "100%", height: "100%", background: ACCENT.sky, display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" width={28}><path fill={LIGHT.text} d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>
            </div>
          </AppTile>
          <AppTile label="Link kopieren">
            <div style={{ width: "100%", height: "100%", background: LIGHT.surfaceMuted, display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" width={26}><path fill="none" stroke={LIGHT.text} strokeWidth={2.4} strokeLinecap="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
            </div>
          </AppTile>
          <AppTile label="malkochen" lit={lit}>
            <Img src={staticFile("icons/icon.svg")} style={{ width: "100%", height: "100%" }} />
          </AppTile>
          <AppTile label="Mehr">
            <div style={{ width: "100%", height: "100%", background: LIGHT.surfaceMuted, display: "grid", placeItems: "center", fontSize: 26, color: LIGHT.text }}>
              ⋯
            </div>
          </AppTile>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// The captured app at this frame, opening out of its icon in the share
// sheet as Android opens an app.
const App: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = shotAt(frame);
  if (!at) return null;
  const open = spring({ frame: frame - SHOTS.share.at, fps, config: { damping: 22, stiffness: 170 } });
  return (
    <Img
      src={staticFile(`shots/${at.shot}/${String(at.frame).padStart(4, "0")}.jpeg`)}
      style={{
        position: "absolute",
        inset: 0,
        width: SCREEN.width,
        height: SCREEN.height,
        transformOrigin: `${MALKOCHEN_ICON.x}px ${MALKOCHEN_ICON.y}px`,
        transform: `scale(${0.14 + 0.86 * open})`,
        borderRadius: (1 - open) * 160,
        opacity: Math.min(1, (frame - SHOTS.share.at + 1) / 3),
      }}
    />
  );
};

// Gekocht ✓: the screen leans in on the top, where Topfbert's pill pops
// and the confetti falls, then back.
const cookZoom = (frame: number) =>
  interpolate(frame, [SHOTS.cook.at + 6, SHOTS.cook.at + 18, SHOTS.cook.at + 58, SHOTS.cook.at + 72], [1, 1.28, 1.28, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

export const Phone: React.FC<{ touches: Touches }> = ({ touches }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - SCENES.phone.from, fps, config: { damping: 17, stiffness: 110 } });
  const leave = spring({ frame: frame - SCENES.outro.from, fps, config: { damping: 20, stiffness: 140 } });
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - SCREEN_PX) / 2 - BEZEL,
        top: 360,
        width: SCREEN_PX + 2 * BEZEL,
        height: SCREEN.height * SCALE + 2 * BEZEL,
        borderRadius: 74,
        background: LIGHT.text,
        padding: BEZEL,
        boxShadow: "0 40px 90px rgba(31,30,28,0.28), 0 10px 24px rgba(31,30,28,0.18)",
        transform: `translateY(${(1 - rise) * 1500 + leave * 1500}px) rotate(${(1 - rise) * 6}deg)`,
      }}
    >
      <div style={{ width: SCREEN_PX, height: SCREEN.height * SCALE, borderRadius: 58, overflow: "hidden", position: "relative", background: LIGHT.bg }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: SCREEN.width, height: SCREEN.height, transform: `scale(${SCALE})`, transformOrigin: "0 0" }}>
          <AbsoluteFill style={{ transformOrigin: "60px 40px", transform: `scale(${cookZoom(frame)})` }}>
            {frame < SCENES.shareIntro.to ? <ShareIntro /> : null}
            <App />
            <Finger touches={touches} />
          </AbsoluteFill>
          <div style={{ position: "absolute", left: SCREEN.width / 2 - 6, top: 8, width: 12, height: 12, borderRadius: "50%", background: "#0c0b0a" }} />
        </div>
      </div>
    </div>
  );
};

// The caption above the phone: in from below as its scene starts, out as
// the next one comes.
export const Caption: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const inn = spring({ frame: frame - from, fps, config: POP });
  const out = interpolate(frame, [to - 6, to], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top: 96,
        height: 230,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: DISPLAY,
        fontWeight: 500,
        fontSize: 92,
        lineHeight: 1.04,
        letterSpacing: "-0.02em",
        textWrap: "balance",
        color: LIGHT.text,
        opacity: Math.min(inn, out),
        transform: `translateY(${(1 - inn) * 40 - (1 - out) * 20}px)`,
      }}
    >
      {text}
    </div>
  );
};
