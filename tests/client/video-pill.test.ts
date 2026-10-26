import { expect, test } from 'vitest'
import { videoPill } from '../../shared/video-embed'

// "Video abspielen" (#394, #395): it shows when the Dish's stored playableVideo
// says the Source has a video that plays in malkochen. Null (not known yet)
// shows nothing: the per-open Instagram check is gone.

const TIKTOK = { kind: 'tiktok', link: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' } as const
const PHOTO_POST = { kind: 'tiktok', link: 'https://www.tiktok.com/@scout2015/photo/6718335390845095173' } as const
const REEL = { kind: 'instagram-reel', link: 'https://www.instagram.com/reel/DFvsVH_OD9h/' } as const
const BLOG = { kind: 'blog', link: 'https://example.com/rezept' } as const
const SHORT = { kind: 'youtube-short', link: 'https://www.youtube.com/shorts/tPEE9ZwTmy0' } as const

test('a stored yes shows the pill', () => {
  expect(videoPill({ source: TIKTOK, playableVideo: true })).toBe('play')
  expect(videoPill({ source: REEL, playableVideo: true })).toBe('play')
  expect(videoPill({ source: SHORT, playableVideo: true })).toBe('play')
})

test('a stored no shows nothing', () => {
  expect(videoPill({ source: TIKTOK, playableVideo: false })).toBeNull()
  expect(videoPill({ source: REEL, playableVideo: false })).toBeNull()
})

test('a Dish with no stored value yet shows nothing, whatever its Source', () => {
  expect(videoPill({ source: TIKTOK, playableVideo: null })).toBeNull()
  expect(videoPill({ source: SHORT, playableVideo: null })).toBeNull()
  expect(videoPill({ source: REEL, playableVideo: null })).toBeNull()
})

test('a Source with no video to embed shows nothing, stored or not', () => {
  expect(videoPill({ source: null, playableVideo: true })).toBeNull()
  expect(videoPill({ source: BLOG, playableVideo: true })).toBeNull()
  expect(videoPill({ source: PHOTO_POST, playableVideo: true })).toBeNull()
  expect(videoPill({ source: PHOTO_POST, playableVideo: null })).toBeNull()
})
