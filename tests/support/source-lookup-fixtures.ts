import type { LookupFixture } from '../../server/source-lookup/fixtures'

// What the test servers know Source Lookup answers, and the recipe a page
// carries for the Recipe Finder (SOURCE_LOOKUP_FIXTURES,
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
export const RECIPE_BLOG = 'https://kochblog.example/rezepte/kichererbsen-curry'
export const SLOW_RECIPE_BLOG = 'https://kochblog.example/rezepte/schmorbraten'
export const UNREADABLE_BLOG = 'https://kochblog.example/rezepte/nicht-erreichbar'
export const LONG_RECIPE_BLOG = 'https://kochblog.example/rezepte/festtagsmenue'
export const BARE_BLOG = 'https://bare.example/seite'
export const IMAGE = 'https://images.fixture.test/pilzpasta.png'

// The recipe RECIPE_BLOG's and SLOW_RECIPE_BLOG's pages carry.
export const BLOG_RECIPE = {
  ingredients: ['1 Dose Kichererbsen', '400 ml Kokosmilch', '2 EL Currypaste', '200 g Spinat'],
  steps: ['Currypaste in etwas Öl anrösten.', 'Kichererbsen und Kokosmilch dazugeben, zehn Minuten köcheln.', 'Spinat unterheben und abschmecken.'],
}

// More than a Recipe holds (shared/recipe.ts): 70 Ingredients, the third of
// 250 characters; 45 Steps, the second of 1200 characters.
export const LONG_BLOG_RECIPE = {
  ingredients: Array.from({ length: 70 }, (_, i) => i === 2 ? 'z'.repeat(250) : `Zutat ${i + 1}`),
  steps: Array.from({ length: 45 }, (_, i) => i === 1 ? 's'.repeat(1200) : `Schritt ${i + 1}`),
}

export const LOOKUP_FIXTURES: Record<string, LookupFixture> = {
  [PASTA_TIKTOK]: { kind: 'tiktok', canonicalLink: PASTA_TIKTOK, suggestedTitle: 'Cremige Pilzpasta', creator: '@mara.kocht', caption: 'Pilzpasta in 15 Minuten', imageUrl: IMAGE },
  [UNTITLED_TIKTOK]: { kind: 'tiktok', canonicalLink: UNTITLED_TIKTOK, suggestedTitle: '', creator: '@mara.kocht' },
  [ANONYMOUS_TIKTOK]: { kind: 'tiktok', canonicalLink: ANONYMOUS_TIKTOK },
  [REEL]: { kind: 'instagram-reel', canonicalLink: REEL, creator: 'mara.kocht', playableVideo: true },
  [POST]: { kind: 'instagram-post', canonicalLink: POST },
  [SHORT]: { kind: 'youtube-short', canonicalLink: SHORT, creator: 'Kochkanal' },
  [PIN]: { kind: 'pinterest-pin', canonicalLink: PIN },
  [BLOG]: { kind: 'blog', canonicalLink: BLOG, creator: 'Kochblog' },
  [BARE_BLOG]: { kind: 'other', canonicalLink: BARE_BLOG },
  [RECIPE_BLOG]: { kind: 'blog', canonicalLink: RECIPE_BLOG, creator: 'Kochblog', recipe: BLOG_RECIPE },
  [SLOW_RECIPE_BLOG]: { kind: 'blog', canonicalLink: SLOW_RECIPE_BLOG, recipe: BLOG_RECIPE, recipeDelayMs: 1500 },
  [UNREADABLE_BLOG]: { kind: 'blog', canonicalLink: UNREADABLE_BLOG, recipe: 'unreadable' },
  [LONG_RECIPE_BLOG]: { kind: 'blog', canonicalLink: LONG_RECIPE_BLOG, recipe: LONG_BLOG_RECIPE },
}
