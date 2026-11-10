import type { SourceLookupResult } from '../../server/source-lookup'

// What the test servers know Source Lookup answers (SOURCE_LOOKUP_FIXTURES,
// server/source-lookup/fixtures.ts), for the Dishes added offline, whose
// Source the server looks up once they arrive. Any link not named here is
// looked up as ever, which in tests finds nothing.

export const PASTA_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000001'
export const UNTITLED_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000002'
export const ANONYMOUS_TIKTOK = 'https://www.tiktok.com/@nobody/video/7300000000000000003'
export const REEL = 'https://www.instagram.com/reel/Cfixture0001/'
export const POST = 'https://www.instagram.com/p/Cfixture0002/'
export const SHORT = 'https://www.youtube.com/shorts/fixture00001'
export const PIN = 'https://www.pinterest.com/pin/7300000000000000004/'
export const BLOG = 'https://kochblog.example/rezepte/linsensuppe'
export const BARE_BLOG = 'https://bare.example/seite'
export const IMAGE = 'https://images.fixture.test/pilzpasta.png'

export const LOOKUP_FIXTURES: Record<string, Partial<SourceLookupResult>> = {
  [PASTA_TIKTOK]: { kind: 'tiktok', canonicalLink: PASTA_TIKTOK, suggestedTitle: 'Cremige Pilzpasta', creator: '@mara.kocht', caption: 'Pilzpasta in 15 Minuten', imageUrl: IMAGE },
  [UNTITLED_TIKTOK]: { kind: 'tiktok', canonicalLink: UNTITLED_TIKTOK, suggestedTitle: '', creator: '@mara.kocht' },
  [ANONYMOUS_TIKTOK]: { kind: 'tiktok', canonicalLink: ANONYMOUS_TIKTOK },
  [REEL]: { kind: 'instagram-reel', canonicalLink: REEL, creator: 'mara.kocht', playableVideo: true },
  [POST]: { kind: 'instagram-post', canonicalLink: POST },
  [SHORT]: { kind: 'youtube-short', canonicalLink: SHORT, creator: 'Kochkanal' },
  [PIN]: { kind: 'pinterest-pin', canonicalLink: PIN },
  [BLOG]: { kind: 'blog', canonicalLink: BLOG, creator: 'Kochblog' },
  [BARE_BLOG]: { kind: 'other', canonicalLink: BARE_BLOG },
}
