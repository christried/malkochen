// The brag video's soundtrack (#313): its music (MUSIC in
// src/brag/timeline.ts), cut sample-exact at the video's first beat, with
// quiet effects under it on the same timeline: a soft tap for every touch,
// air for what moves, a sparkle for the confetti. The effects are unpitched,
// so they can't clash with the song's key. Writes out/brag/brag-audio.wav.
//
//   node scripts/brag-audio.ts

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beat, CUE, DURATION, FPS, INTRO_TAPS, MUSIC, MUSIC_START, SCENES, SHOT_ORDER, SHOTS, type ShotName } from "../src/brag/timeline.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out/brag");
const SR = 44100;
const LENGTH = Math.ceil((DURATION / FPS) * SR);
const at = (frame: number) => frame / FPS;

// --- The music ----------------------------------------------------------

// Decoded by Remotion's own ffmpeg, from the video's first beat, as 16-bit
// stereo at 44.1 kHz.
mkdirSync(join(OUT, "work"), { recursive: true });
const excerpt = join(OUT, "work", "music.wav");
execFileSync(
  "npx",
  ["remotion", "ffmpeg", "-loglevel", "error", "-y", "-i", join(OUT, MUSIC.file), "-ss", MUSIC_START.toFixed(4), "-t", (LENGTH / SR).toFixed(4), "-ac", "2", "-ar", String(SR), "-c:a", "pcm_s16le", excerpt],
  { stdio: "inherit", shell: true, cwd: ROOT },
);
const wav = readFileSync(excerpt);
let chunk = 12;
while (wav.toString("ascii", chunk, chunk + 4) !== "data") chunk += 8 + wav.readUInt32LE(chunk + 4);
const music = [new Float32Array(LENGTH), new Float32Array(LENGTH)] as const;
const decoded = Math.min(LENGTH, wav.readUInt32LE(chunk + 4) / 4);
for (let i = 0; i < decoded; i++) {
  music[0][i] = wav.readInt16LE(chunk + 8 + i * 4) / 32768;
  music[1][i] = wav.readInt16LE(chunk + 10 + i * 4) / 32768;
}

// --- The effects --------------------------------------------------------

const sfx = [new Float32Array(LENGTH), new Float32Array(LENGTH)] as const;
type Voice = (t: number) => number;

function play(start: number, dur: number, voice: Voice, gain: number, pan = 0) {
  const from = Math.max(0, Math.round(start * SR));
  const to = Math.min(LENGTH, Math.round((start + dur) * SR));
  const [gl, gr] = [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)];
  for (let i = from; i < to; i++) {
    const v = voice((i - from) / SR) * gain;
    sfx[0][i]! += v * gl;
    sfx[1][i]! += v * gr;
  }
}

const decay = (t: number, d: number) => Math.exp(-t / d);

// Deterministic noise, so every render sounds the same.
let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};

// High-passed noise, for the bright sounds.
const bright = (cutoff: number) => {
  let lp = 0;
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  return () => {
    const n = noise();
    lp += k * (n - lp);
    return n - lp;
  };
};

// A fingertip on glass: a short, soft click.
const tap = (): Voice => {
  const n = bright(2500);
  return (t) => n() * decay(t, 0.006);
};

// Air moving past: noise through a band sweeping from `f0` to `f1`.
const whoosh = (len: number, f0: number, f1: number): Voice => {
  let low = 0;
  let band = 0;
  return (t) => {
    const f = f0 * (f1 / f0) ** (t / len);
    const k = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    low += k * band;
    band += k * (noise() - low - 0.5 * band);
    return band * Math.sin((Math.PI * t) / len) ** 2 * 0.6;
  };
};

// Confetti: a spray of tiny bright grains, thinning out.
const sparkle = (len: number): Voice => {
  const n = bright(5000);
  return (t) => n() * (noise() > 0.9 ? 1 : 0.04) * decay(t, len / 2.5);
};

type Touch = { frame: number; phase: "down" | "move" | "up" };
const touches = (shot: ShotName) =>
  (JSON.parse(readFileSync(join(OUT, "shots", shot, "shot.json"), "utf8")) as { touches: Touch[] }).touches.map((t) => ({
    ...t,
    frame: SHOTS[shot].at + t.frame,
  }));
const all = SHOT_ORDER.flatMap(touches);

// Every touch: a tap as the finger comes down.
for (const f of [INTRO_TAPS.share - 3, INTRO_TAPS.malkochen - 4, ...all.filter((t) => t.phase === "down").map((t) => t.frame)]) {
  play(at(f), 0.05, tap(), 0.35);
}

// The phone rising, the share sheet, the app opening out of its icon.
play(at(SCENES.phone.from) - 0.05, 0.6, whoosh(0.6, 250, 2200), 0.16);
play(at(INTRO_TAPS.share), 0.35, whoosh(0.35, 600, 3000), 0.08, 0.2);
play(at(SHOTS.share.at) - 0.05, 0.45, whoosh(0.45, 1200, 4000), 0.09);

// The card carried onto the tab.
const moves = touches("plan").filter((t) => t.phase === "move");
if (moves.length) {
  const len = at(moves.at(-1)!.frame - moves[0]!.frame);
  play(at(moves[0]!.frame), len, whoosh(len, 300, 1400), 0.08, -0.2);
}

// Off to the settings and back.
play(at(beat(CUE.gear)), 0.35, whoosh(0.35, 900, 3500), 0.06, 0.3);
play(at(beat(CUE.back)), 0.35, whoosh(0.35, 3500, 900), 0.06, -0.3);

// Gekocht ✓, and the veggies at the outro.
play(at(beat(CUE.cooked)), 1.2, sparkle(1.2), 0.12);
play(at(beat(CUE.outro)), 0.5, whoosh(0.5, 300, 3000), 0.1);
play(at(beat(CUE.outro)), 1.2, sparkle(1.2), 0.1);

// --- Mix ----------------------------------------------------------------

// The effects under the music; a short fade at the very end; never above
// -1 dBFS.
const fadeFrom = LENGTH - Math.round(0.35 * SR);
const mix = [0, 1].map((c) => {
  const out = new Float32Array(LENGTH);
  for (let i = 0; i < LENGTH; i++) {
    const fade = i > fadeFrom ? (LENGTH - i) / (LENGTH - fadeFrom) : 1;
    out[i] = (music[c as 0 | 1][i]! + sfx[c as 0 | 1][i]!) * fade;
  }
  return out;
});
const peak = Math.max(...mix.map((ch) => ch.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const gain = peak > 0.89 ? 0.89 / peak : 1;

// 16-bit stereo WAV.
const data = Buffer.alloc(LENGTH * 4);
for (let i = 0; i < LENGTH; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[0]![i]! * gain)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[1]![i]! * gain)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(join(OUT, "brag-audio.wav"), Buffer.concat([header, data]));
console.log(`✓ out/brag/brag-audio.wav (${(LENGTH / SR).toFixed(2)}s, music from ${MUSIC_START.toFixed(3)}s, gain ${gain.toFixed(2)})`);
