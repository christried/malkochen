import { expect, test } from 'vitest'
import { shareReturnPath, sharedLink } from '../../app/utils/shared-link'

// Seam 4: Share to malkochen (issue #204). Apps share a link as the URL, in
// a caption, or only in the title; the first http(s) link wins, URL first.

test('the shared URL is taken as it is', () => {
  expect(sharedLink({ url: 'https://www.tiktok.com/@cook/video/1', text: 'https://other.example/x', title: '' }))
    .toBe('https://www.tiktok.com/@cook/video/1')
})

test('without a URL, the first link in the text is taken and the caption around it ignored', () => {
  expect(sharedLink({ text: 'Schau mal! 🍜 https://www.instagram.com/reel/abc/?igsh=1 so gut, auch https://second.example', title: 'Reel' }))
    .toBe('https://www.instagram.com/reel/abc/?igsh=1')
})

test('without a link in the URL or the text, the title is searched', () => {
  expect(sharedLink({ url: '', text: 'nur Text', title: 'Pin: http://pin.it/xyz' })).toBe('http://pin.it/xyz')
})

test('a link right before closing punctuation stops before it', () => {
  expect(sharedLink({ text: 'Rezept (https://blog.example/curry).' })).toBe('https://blog.example/curry')
  expect(sharedLink({ text: '„https://blog.example/dal“' })).toBe('https://blog.example/dal')
})

test('a URL that isn\'t a web link falls through to the text', () => {
  expect(sharedLink({ url: 'intent://foo', text: 'https://youtube.com/shorts/1' })).toBe('https://youtube.com/shorts/1')
})

test('nothing with a web link gives null', () => {
  expect(sharedLink({})).toBeNull()
  expect(sharedLink({ url: '', text: 'Lecker!', title: 'ftp://files.example/a' })).toBeNull()
})

test('only the share route is kept as the way back from sign-in', () => {
  expect(shareReturnPath('/share?url=https%3A%2F%2Fx.example')).toBe('/share?url=https%3A%2F%2Fx.example')
  expect(shareReturnPath('/share')).toBe('/share')
  expect(shareReturnPath(undefined)).toBe('/')
  expect(shareReturnPath('/b/kochclub')).toBe('/')
  expect(shareReturnPath('//evil.example/share')).toBe('/')
  expect(shareReturnPath('https://evil.example/share')).toBe('/')
  expect(shareReturnPath('/shared-elsewhere')).toBe('/')
})
