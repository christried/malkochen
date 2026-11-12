import { readFileSync } from 'node:fs'
import type { LookupFixtures } from '../../server/source-lookup/fixtures'

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

// The pages the Recipe Finder reads (#500): the recorded pages of the Source
// Lookup tests (tests/source-lookup/fixtures), served at these links.
function sourcePage(name: string, options: { delayMs?: number } = {}) {
  return { html: readFileSync(new URL(`../source-lookup/fixtures/${name}`, import.meta.url), 'utf8'), ...options }
}

// A blog page with recipe data: Steps grouped in sections.
export const RECIPE_BLOG = 'https://ofenliebe.example/linsenlasagne/'
export const RECIPE_BLOG_RECIPE = {
  ingredients: ['250 g rote Linsen', '1 Dose gehackte Tomaten', '12 Lasagneplatten', '500 ml Hafermilch & 40 g Mehl'],
  steps: [
    'Zwiebel und Knoblauch in Öl anbraten.',
    'Linsen und Tomaten dazugeben, 20 Min. köcheln lassen.',
    'Mehl in Margarine anschwitzen, Hafermilch einrühren.',
    'Alles schichten und 35 Minuten bei 200 °C backen.',
  ],
}
// ... one that answers slowly, for a Member to type a Recipe while it is read.
export const SLOW_RECIPE_BLOG = 'https://suppenglueck.example/kuerbissuppe'
export const SLOW_RECIPE_BLOG_RECIPE = {
  ingredients: ['1 Hokkaido', '400 ml Kokosmilch'],
  steps: ['Den Kürbis waschen, entkernen und würfeln.', 'Mit 600 ml Brühe ca. 20 Min. weich kochen. Dann pürieren.', 'Kokosmilch einrühren & abschmecken.'],
}
// ... one with Ingredients only, for a Source change to move to.
export const OTHER_RECIPE_BLOG = 'https://veggie-kueche.example/knuspriger-tofu/'
export const OTHER_RECIPE_BLOG_RECIPE = { ingredients: ['400 g Tofu', '2 EL Speisestärke'], steps: [] }
// A blog page without recipe data, and one that doesn't answer.
export const NO_RECIPE_BLOG = 'https://salt-and-pan.example/weekend-shakshuka'
export const DOWN_BLOG = 'https://kochblog.example/rezepte/gerade-nicht-da'

export const LOOKUP_FIXTURES: LookupFixtures = {
  [RECIPE_BLOG]: { page: sourcePage('blog-recipe-sections.html') },
  [SLOW_RECIPE_BLOG]: { page: sourcePage('blog-recipe-text.html', { delayMs: 1500 }) },
  [OTHER_RECIPE_BLOG]: { page: sourcePage('blog-recipe-string.html') },
  [NO_RECIPE_BLOG]: { page: sourcePage('blog-og-only.html') },
  [DOWN_BLOG]: { page: { status: 500 } },
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
