import { createHash } from 'node:crypto'

// The Content Security Policy of public/offline.html (#344), the page the
// service worker shows when malkochen can't be loaded. A static file can't
// carry a nonce like a rendered page (server/plugins/headers.ts), so the
// policy names the page's inline scripts and styles by their hashes,
// computed from the file when the app is built (nuxt.config.ts): an edit to
// the page changes its policy with it. It reports nothing: the page shows
// when malkochen can't be reached, so there would be nowhere to report to.

const hashOf = (content: string) => `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`

// The hashes of the page's inline <script>s or <style>s, in page order. A
// script with a src is no inline script.
function inlineHashes(html: string, tag: 'script' | 'style'): string[] {
  return [...html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))]
    .filter(([, attributes]) => !/\bsrc=/.test(attributes ?? ''))
    .map(([, , content]) => hashOf(content!))
}

export function offlinePagePolicy(html: string): string {
  return [
    // Its fonts (public/fonts/) and its check whether malkochen answers again
    // (a HEAD to its own address).
    'default-src \'self\'',
    `script-src ${inlineHashes(html, 'script').join(' ')}`,
    `style-src ${inlineHashes(html, 'style').join(' ')}`,
    'form-action \'none\'',
    'base-uri \'none\'',
    'object-src \'none\'',
    // As every answer (nuxt.config.ts), whose policy this one replaces.
    'frame-ancestors \'none\'',
  ].join('; ')
}
