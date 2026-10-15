import { expect, test } from 'vitest'
import { instagramEmbedState, videoEmbed } from '../../app/utils/video-embed'

// Click-to-play video (#221): which Dishes get "Video abspielen", and the
// player each one loads only once it is tapped.

test('a TikTok video plays in TikTok\'s embed player, starting at once', () => {
  expect(videoEmbed({ kind: 'tiktok', link: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' }))
    .toEqual({ platform: 'tiktok', src: 'https://www.tiktok.com/player/v1/6718335390845095173?autoplay=1&rel=0' })
})

test('a YouTube Short plays in YouTube\'s no-cookie player, in place on phones', () => {
  expect(videoEmbed({ kind: 'youtube-short', link: 'https://www.youtube.com/shorts/tPEE9ZwTmy0' }))
    .toEqual({ platform: 'youtube', src: 'https://www.youtube-nocookie.com/embed/tPEE9ZwTmy0?autoplay=1&playsinline=1&rel=0' })
})

test('an Instagram Reel or post plays in Instagram\'s embed', () => {
  expect(videoEmbed({ kind: 'instagram-reel', link: 'https://www.instagram.com/reel/C0WUh-tqkxU/' }))
    .toEqual({ platform: 'instagram', src: 'https://www.instagram.com/reel/C0WUh-tqkxU/embed/' })
  expect(videoEmbed({ kind: 'instagram-post', link: 'https://www.instagram.com/p/C0WUh-tqkxU/' }))
    .toEqual({ platform: 'instagram', src: 'https://www.instagram.com/p/C0WUh-tqkxU/embed/' })
})

test('Pinterest, blogs, other links and Dishes without a Source get no video', () => {
  expect(videoEmbed({ kind: 'pinterest-pin', link: 'https://www.pinterest.com/pin/99360735500167749/' })).toBeNull()
  expect(videoEmbed({ kind: 'blog', link: 'https://www.loveandlemons.com/brownies-recipe/' })).toBeNull()
  expect(videoEmbed({ kind: 'other', link: 'https://example.com/video/1' })).toBeNull()
  expect(videoEmbed(null)).toBeNull()
})

test('a link that names no video gets none: a TikTok photo post, short links never resolved', () => {
  expect(videoEmbed({ kind: 'tiktok', link: 'https://www.tiktok.com/@cook/photo/7400000000000000000' })).toBeNull()
  expect(videoEmbed({ kind: 'tiktok', link: 'https://vm.tiktok.com/ZMabc123/' })).toBeNull()
  expect(videoEmbed({ kind: 'instagram-reel', link: 'https://www.instagram.com/share/reel/BAabc123/' })).toBeNull()
})

test('only the platform\'s own hosts are trusted, whatever the stored kind says', () => {
  expect(videoEmbed({ kind: 'tiktok', link: 'https://evil.example/@x/video/123' })).toBeNull()
  expect(videoEmbed({ kind: 'youtube-short', link: 'https://www.youtube.com.evil.example/shorts/tPEE9ZwTmy0' })).toBeNull()
  expect(videoEmbed({ kind: 'instagram-post', link: 'https://instagram.evil.example/p/abc/' })).toBeNull()
  expect(videoEmbed({ kind: 'tiktok', link: 'not a link' })).toBeNull()
})

// Instagram's embed tells its parent page how it is doing (checked
// 2026-10-15): "LOADING" first, then "MEASURE" and "MOUNTED" once the post
// shows. A post that can't be embedded only ever says "LOADING".
test('Instagram\'s embed is showing a post once it measures or mounts it', () => {
  expect(instagramEmbedState('{"details":{"height":708},"type":"MEASURE"}')).toEqual({ shown: true, height: 708 })
  expect(instagramEmbedState('{"details":{"styles":[]},"type":"MOUNTED"}')).toEqual({ shown: true, height: null })
})

test('anything else from Instagram\'s embed says nothing about the post', () => {
  expect(instagramEmbedState('{"details":{},"type":"LOADING"}')).toBeNull()
  expect(instagramEmbedState('[tea-sdk]ready')).toBeNull()
  expect(instagramEmbedState({ type: 'MEASURE' })).toBeNull()
  expect(instagramEmbedState('{"type":"MEASURE","details":{"height":"tall"}}')).toEqual({ shown: true, height: null })
})
