// The brag video's soundtrack (#313), synthesised: a 120 BPM groove in F
// major (F, Am, B♭, C) and the effects, in the same key and the same room,
// on the composition's own timeline (src/brag/timeline.ts) and the captured
// touches (out/brag/shots/*/shot.json). Writes out/brag/brag-audio.wav.
//
//   node scripts/brag-audio.ts

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION, FPS, INTRO_TAPS, SCENES, SHOTS, type ShotName } from "../src/brag/timeline.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../out/brag");
const SR = 44100;
const LENGTH = Math.ceil((DURATION / FPS) * SR);

const at = (frame: number) => frame / FPS;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Two buses, stereo: dry, and what goes into the reverb.
const dry = [new Float32Array(LENGTH), new Float32Array(LENGTH)] as const;
const send = [new Float32Array(LENGTH), new Float32Array(LENGTH)] as const;
// The kick's envelope, which the keys and bass duck under.
const pump = new Float32Array(LENGTH);

type Voice = (t: number) => number;

// Places a voice at `start` seconds for `dur`, panned (-1…1), with some of it
// sent to the reverb.
function play(start: number, dur: number, voice: Voice, { gain = 1, pan = 0, verb = 0.2, duck = 0 } = {}) {
  const from = Math.max(0, Math.round(start * SR));
  const to = Math.min(LENGTH, Math.round((start + dur) * SR));
  const [gl, gr] = [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)];
  for (let i = from; i < to; i++) {
    const t = (i - from) / SR;
    const v = voice(t) * gain * (1 - duck * pump[i]!);
    dry[0][i]! += v * gl;
    dry[1][i]! += v * gr;
    send[0][i]! += v * gl * verb;
    send[1][i]! += v * gr * verb;
  }
}

const attack = (t: number, a: number) => (t < a ? t / a : 1);
const decay = (t: number, d: number) => Math.exp(-t / d);
const sin = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);

// Deterministic noise, so every render sounds the same.
let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};

// --- Instruments --------------------------------------------------------

const marimba = (f: number, d = 0.35): Voice => (t) =>
  attack(t, 0.002) * (sin(f, t) * decay(t, d) + 0.35 * sin(f * 3.93, t) * decay(t, d / 5) + 0.12 * sin(f * 9.2, t) * decay(t, d / 14));

// A soft electric piano: FM, the brightness falling away.
const keys = (f: number, d = 0.9): Voice => (t) =>
  attack(t, 0.006) * decay(t, d) * Math.sin(2 * Math.PI * f * t + 1.3 * decay(t, 0.25) * sin(f, t));

const bell = (f: number, d = 1.6): Voice => (t) =>
  attack(t, 0.002) * (sin(f, t) * decay(t, d) + 0.4 * sin(f * 2.76, t) * decay(t, d / 2.5) + 0.2 * sin(f * 5.4, t) * decay(t, d / 5));

const pad = (f: number, len: number): Voice => (t) =>
  Math.min(1, t / 0.25, (len - t) / 0.4) * (sin(f, t) + 0.5 * sin(f * 1.004, t) + 0.3 * sin(f * 2.003, t) + 0.15 * sin(f * 0.998 * 3, t)) * 0.4;

const bass = (f: number): Voice => (t) => attack(t, 0.004) * decay(t, 0.28) * (sin(f, t) + 0.25 * sin(2 * f, t) + 0.1 * sin(3 * f, t));

// A sine falling from 130 to 45 Hz: the phase is the integral of that.
const kick: Voice = (t) => Math.sin(2 * Math.PI * (45 * t + 85 * 0.035 * (1 - decay(t, 0.035)))) * decay(t, 0.22);

// Band-limited noise, one-pole filtered: low for a clap, high for a hat.
const filtered = (cutoff: number, highpass: boolean) => {
  let lp = 0;
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  return () => {
    const n = noise();
    lp += k * (n - lp);
    return highpass ? n - lp : lp;
  };
};

const clap = (): Voice => {
  const n = filtered(1800, true);
  return (t) => n() * (t < 0.03 ? decay(t % 0.01, 0.003) : decay(t - 0.03, 0.09)) * 0.9;
};

const hat = (): Voice => {
  const n = filtered(7000, true);
  return (t) => n() * decay(t, 0.03);
};

// Air moving past: noise through a band sweeping from `f0` to `f1`.
const whoosh = (len: number, f0: number, f1: number): Voice => {
  let low = 0;
  let band = 0;
  return (t) => {
    const f = f0 * (f1 / f0) ** (t / len);
    const k = 2 * Math.sin((Math.PI * f) / SR);
    const n = noise();
    low += k * band;
    band += k * (n - low - 0.5 * band);
    return band * Math.sin((Math.PI * t) / len) ** 2 * 0.6;
  };
};

// --- Music --------------------------------------------------------------

const BEAT = 0.5;
// Bars start every 2s from 0.5s: bar 0 is the hook, the groove drops on
// bar 1 with the reveal (frame 75, 2.5s).
const bar = (n: number) => 0.5 + n * 4 * BEAT;

// Per bar from 1: its chord (root, then the notes the keys play).
const F = { root: 41, notes: [65, 69, 72] };
const AM = { root: 45, notes: [64, 69, 72] };
const BB = { root: 46, notes: [65, 70, 74] };
const C = { root: 48, notes: [64, 67, 72] };
const CHORDS = [F, AM, BB, C, F, AM, BB, F, F];

// The hook: a soft F underneath, nothing else.
for (const n of [53, 57, 60]) play(0, bar(1), pad(hz(n), bar(1)), { gain: 0.07, verb: 0.4 });

CHORDS.forEach((chord, i) => {
  const start = bar(i + 1);
  const last = i === CHORDS.length - 1;
  if (last) {
    // The end: one chord, left to ring.
    for (const n of chord.notes) play(start, 1.6, keys(hz(n), 1.2), { gain: 0.16, verb: 0.45 });
    play(start, 1.6, bass(hz(chord.root)), { gain: 0.32 });
    play(start, 1.5, bell(hz(chord.notes[2]! + 12)), { gain: 0.09, verb: 0.6 });
    return;
  }
  for (const n of chord.notes) play(start, 2, pad(hz(n - 12), 2), { gain: 0.035, verb: 0.3, duck: 0.5 });
  for (let b = 0; b < 4; b++) {
    const beat = start + b * BEAT;
    // Four on the floor from bar 2 (the reveal has kick on 1 and 3 only).
    if (i > 0 || b % 2 === 0) {
      play(beat, 0.4, kick, { gain: 0.55, verb: 0.02 });
      const from = Math.round(beat * SR);
      for (let s = 0; s < 0.25 * SR && from + s < LENGTH; s++) pump[from + s] = Math.max(pump[from + s]!, decay(s / SR, 0.08));
    }
    if (b % 2 === 1 && i > 0) play(beat, 0.3, clap(), { gain: 0.16, pan: 0.1, verb: 0.3 });
    play(beat + BEAT / 2, 0.08, hat(), { gain: 0.06 + (i > 0 ? 0.03 : 0), pan: 0.35 });
    // Keys on the off-beats.
    for (const n of chord.notes) play(beat + BEAT / 2, 0.5, keys(hz(n), 0.35), { gain: 0.06, pan: -0.2, verb: 0.25, duck: 0.4 });
  }
  // Bass: 1, the "and" of 2, 3, 4.
  for (const b of [0, 1.5, 2, 3]) play(start + b * BEAT, 0.4, bass(hz(chord.root + (b === 3 ? 12 : 0))), { gain: 0.3, duck: 0.35 });
});

// The marimba tune, over bars 2–8: a two-bar phrase and its answer.
const PHRASE_A: [number, number, number][] = [[0, 69, 0.5], [1, 72, 0.5], [1.5, 74, 0.5], [2, 72, 1], [3.5, 69, 0.5], [4, 67, 0.5], [4.5, 69, 0.5], [5, 72, 1.5], [7, 65, 0.5]];
const PHRASE_B: [number, number, number][] = [[0, 74, 0.5], [1, 72, 0.5], [1.5, 70, 0.5], [2, 69, 1], [4, 72, 0.5], [4.5, 74, 0.5], [5, 77, 1.5], [7, 76, 0.5]];
for (const [phrase, from] of [[PHRASE_A, 2], [PHRASE_B, 4], [PHRASE_A, 6]] as const) {
  for (const [b, n, len] of phrase) play(bar(from) + b * BEAT, len * BEAT + 0.4, marimba(hz(n + 12), 0.3), { gain: 0.11, pan: 0.25, verb: 0.3 });
}

// --- Effects ------------------------------------------------------------

const PENTATONIC = [65, 67, 69, 72, 74, 77, 79, 81, 84];
const sfx = { gain: 1, pan: 0, verb: 0.3 };
const effect = (start: number, dur: number, voice: Voice, gain: number, pan = 0) => play(start, dur, voice, { ...sfx, gain, pan });

// The hook: a note for every saved dish popping in, up the scale; then
// "Never cooked." falls; then a roll and a rise into the drop.
PENTATONIC.forEach((n, i) => effect(at(2 + i * 3), 0.4, marimba(hz(n), 0.18), 0.13, (i % 3) * 0.3 - 0.3));
[72, 69, 65].forEach((n, i) => effect(at(34) + i * 0.13, 0.6, marimba(hz(n - 12), 0.4), 0.2));
for (let i = 0; i < 8; i++) play(bar(1) - 0.5 + i * 0.0625, 0.2, clap(), { gain: 0.03 + i * 0.012, verb: 0.3 });
effect(bar(1) - 0.7, 0.7, whoosh(0.7, 400, 5000), 0.08);

// The reveal: the name rings.
for (const n of [77, 81, 84]) effect(at(84), 2, bell(hz(n)), 0.05);

// The phone rises; the share sheet; the app opening.
effect(at(SCENES.phone.from) - 0.05, 0.6, whoosh(0.6, 250, 2200), 0.1);
effect(at(INTRO_TAPS.share + 3), 0.35, whoosh(0.35, 600, 3000), 0.05, 0.2);
effect(at(SHOTS.share.at) - 0.1, 0.45, whoosh(0.45, 1200, 4000), 0.05);

// Every touch on the phone: a soft tap.
type Touch = { frame: number; phase: "down" | "move" | "up" };
const touches = (shot: ShotName) =>
  (JSON.parse(readFileSync(join(OUT, "shots", shot, "shot.json"), "utf8")) as { touches: Touch[] }).touches
    .map((t) => ({ ...t, frame: SHOTS[shot].at + t.frame - SHOTS[shot].from }))
    .filter((t) => t.frame >= SHOTS[shot].at);
const downs = [INTRO_TAPS.share, INTRO_TAPS.malkochen, ...(["share", "plan", "cook"] as const).flatMap((s) => touches(s).filter((t) => t.phase === "down").map((t) => t.frame))];
for (const f of downs) effect(at(f), 0.2, marimba(hz(84), 0.05), 0.07);

// Saved: the card flies into Ideen.
const [save] = touches("share").filter((t) => t.phase === "down");
if (save) [72, 77, 81].forEach((n, i) => effect(at(save.frame + 8) + i * 0.06, 0.6, marimba(hz(n + 12), 0.2), 0.05));

// The drag: lifted, carried, swallowed by the tab.
const drag = touches("plan");
const moves = drag.filter((t) => t.phase === "move");
if (moves.length) {
  effect(at(moves[0]!.frame), at(moves.at(-1)!.frame - moves[0]!.frame), whoosh(at(moves.at(-1)!.frame - moves[0]!.frame), 300, 1400), 0.06, -0.2);
  const up = drag.find((t) => t.phase === "up")!;
  effect(at(up.frame + 4), 0.4, marimba(hz(69), 0.12), 0.1);
  effect(at(up.frame + 7), 0.4, marimba(hz(77), 0.12), 0.08);
}

// Gekocht ✓: the confetti bursts, Topfbert's pill pops.
const [cooked] = touches("cook").filter((t) => t.phase === "down");
if (cooked) {
  const t0 = at(cooked.frame + 2);
  effect(t0, 0.4, whoosh(0.4, 900, 6000), 0.06);
  PENTATONIC.slice(2).forEach((n, i) => effect(t0 + i * 0.035, 0.5, marimba(hz(n + 12), 0.15), 0.05, i % 2 ? 0.4 : -0.4));
  effect(t0 + 0.3, 1.2, bell(hz(84), 0.8), 0.05);
}

// The outro: Topfbert pops, the veggies burst, the three words land.
const outro = SCENES.outro.from;
effect(at(outro + 6), 0.5, whoosh(0.5, 300, 3000), 0.07);
PENTATONIC.forEach((n, i) => effect(at(outro + 8) + i * 0.03, 0.5, marimba(hz(n + 12), 0.15), 0.04, i % 2 ? 0.5 : -0.5));
[72, 77, 81].forEach((n, i) => effect(at(outro + 22 + i * 7), 0.5, marimba(hz(n), 0.2), 0.1));

// --- Room and master ----------------------------------------------------

// Freeverb, small: four damped combs into two allpasses, per side.
function reverb(input: Float32Array, spread: number) {
  const out = new Float32Array(LENGTH);
  for (const size of [1557, 1617, 1491, 1422]) {
    const buf = new Float32Array(size + spread);
    let idx = 0;
    let store = 0;
    for (let i = 0; i < LENGTH; i++) {
      const y = buf[idx]!;
      store = y * 0.7 + store * 0.3;
      buf[idx] = input[i]! + store * 0.8;
      idx = (idx + 1) % buf.length;
      out[i]! += y * 0.25;
    }
  }
  for (const size of [556, 441]) {
    const buf = new Float32Array(size + spread);
    let idx = 0;
    for (let i = 0; i < LENGTH; i++) {
      const b = buf[idx]!;
      const x = out[i]!;
      buf[idx] = x + b * 0.5;
      out[i] = b - x;
      idx = (idx + 1) % buf.length;
    }
  }
  return out;
}

const wet = [reverb(send[0], 0), reverb(send[1], 23)];
const mix = [0, 1].map((c) => dry[c as 0 | 1].map((v, i) => v + 0.35 * wet[c]![i]!));
// Gentle saturation, then the level, then a short fade at the very end.
const drive = 1.4;
for (const ch of mix) for (let i = 0; i < LENGTH; i++) ch[i] = Math.tanh(ch[i]! * drive) / Math.tanh(drive);
const peak = Math.max(...mix.map((ch) => ch.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const fadeFrom = LENGTH - Math.round(0.5 * SR);
for (const ch of mix) for (let i = 0; i < LENGTH; i++) ch[i] = (ch[i]! / peak) * 0.89 * (i > fadeFrom ? (LENGTH - i) / (LENGTH - fadeFrom) : 1);

// 16-bit stereo WAV.
const data = Buffer.alloc(LENGTH * 4);
for (let i = 0; i < LENGTH; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[0]![i]!)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[1]![i]!)) * 32767), i * 4 + 2);
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
console.log(`✓ out/brag/brag-audio.wav (${(LENGTH / SR).toFixed(1)}s)`);
