import { expect, test } from 'vitest'
import { videoPill } from '../../shared/video-embed'

// "Video abspielen" (#394): it shows when the Dish's stored playableVideo says
// the Source has a video that plays in malkochen. Only a Dish without a stored
// value yet (until #395) is decided by the old rule, with Instagram's answer.

const TIKTOK = { kind: 'tiktok', link: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' } as const
const PHOTO_POST = { kind: 'tiktok', link: 'https://www.tiktok.com/@scout2015/photo/6718335390845095173' } as const
const REEL = { kind: 'instagram-reel', link: 'https://www.instagram.com/reel/DFvsVH_OD9h/' } as const
const BLOG = { kind: 'blog', link: 'https://example.com/rezept' } as const

test('a stored yes shows the pill, whatever Instagram answers now', () => {
  expect(videoPill({ source: TIKTOK, playableVideo: true }, undefined)).toBe('play')
  expect(videoPill({ source: REEL, playableVideo: true }, undefined)).toBe('play')
  expect(videoPill({ source: REEL, playableVideo: true }, false)).toBe('play')
})

test('a stored no shows nothing', () => {
  expect(videoPill({ source: TIKTOK, playableVideo: false }, undefined)).toBeNull()
  expect(videoPill({ source: REEL, playableVideo: false }, true)).toBeNull()
})

test('a Source with no video to embed shows nothing, stored or not', () => {
  expect(videoPill({ source: null, playableVideo: true }, undefined)).toBeNull()
  expect(videoPill({ source: BLOG, playableVideo: true }, undefined)).toBeNull()
  expect(videoPill({ source: PHOTO_POST, playableVideo: true }, undefined)).toBeNull()
  expect(videoPill({ source: PHOTO_POST, playableVideo: null }, undefined)).toBeNull()
})

test('a Dish without a stored value yet keeps the old rule: TikTok and YouTube play', () => {
  expect(videoPill({ source: TIKTOK, playableVideo: null }, undefined)).toBe('play')
  expect(videoPill({ source: { kind: 'youtube-short', link: 'https://www.youtube.com/shorts/tPEE9ZwTmy0' }, playableVideo: null }, undefined)).toBe('play')
})

test('a Dish without a stored value yet waits for Instagram, and plays unless it says no', () => {
  expect(videoPill({ source: REEL, playableVideo: null }, undefined)).toBeNull()
  expect(videoPill({ source: REEL, playableVideo: null }, false)).toBeNull()
  expect(videoPill({ source: REEL, playableVideo: null }, true)).toBe('play')
  expect(videoPill({ source: REEL, playableVideo: null }, null)).toBe('play')
})
