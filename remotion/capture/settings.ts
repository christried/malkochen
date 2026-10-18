import { resolve } from 'node:path'

// Where the captured app listens: next to the browser tests' 3100, so the
// two can run side by side.
export const CAPTURE_ORIGIN = 'http://localhost:3101'

// Everything captured lands in remotion/out/brag (gitignored), which is the
// public dir the brag video is rendered with (scripts/render-brag.ts).
export const OUT_DIR = resolve(import.meta.dirname, '../out/brag')
export const SERVER_FILE = resolve(OUT_DIR, 'server.json')

// A phone: a Pixel-sized viewport, drawn at 2.5× so the screen stays sharp
// when the video shows it about 860px wide.
export const PHONE = { width: 412, height: 892, deviceScaleFactor: 2.5 }

export const FPS = 30
