import { resolve } from 'node:path'

// Where the captured app listens: next to the browser tests' 3100, so the
// two can run side by side.
export const CAPTURE_ORIGIN = 'http://localhost:3101'

// Where serve.ts says where the app and its database are, for capture.ts.
export const SERVER_FILE = resolve(import.meta.dirname, '../out/brag/server.json')

// A phone: a Pixel-sized viewport, drawn at 2.5× so the screen stays sharp
// when the video shows it about 860px wide.
export const PHONE = { width: 412, height: 892, deviceScaleFactor: 2.5 }

export const FPS = 30
