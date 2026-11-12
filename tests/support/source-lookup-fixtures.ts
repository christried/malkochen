import { readFileSync } from 'node:fs'
import type { LookupFixtures } from '../../server/source-lookup/fixtures'
import { ANTHROPIC_PORT } from './anthropic-port'

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

// The Captions the Recipe Finder reads when a page has no recipe data (#501).
// A TikTok whose Caption holds a recipe ...
export const RECIPE_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000005'
export const RECIPE_CAPTION = 'Cremige Linsensuppe in 20 Minuten 🍲\n\nZutaten:\n250 g rote Linsen\n1 Zwiebel\n800 ml Brühe\n\nErst die Zwiebel anbraten, dann Linsen und Brühe dazu und 15 Min. köcheln lassen.\n\nFolgt mir für mehr! #linsensuppe #fyp'
// ... one whose Caption holds none ...
export const CHATTER_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000006'
// ... a blog with recipe data on its page and a Caption besides ...
export const RECIPE_BLOG_WITH_CAPTION = 'https://ofenliebe.example/linsenlasagne-mit-text/'
// ... and one whose page has no recipe data, or can't be read, with a Caption.
export const NO_RECIPE_BLOG_WITH_CAPTION = 'https://salt-and-pan.example/weekend-shakshuka-mit-text'
export const DOWN_BLOG_WITH_CAPTION = 'https://kochblog.example/rezepte/gerade-nicht-da-mit-text'

// The pages the Recipe Finder follows (#502), from a link in a Caption or from
// a Pin. A page with recipe data (the same page as RECIPE_BLOG's) ...
export const LINKED_RECIPE_PAGE = 'https://ofenliebe.example/linsenlasagne-vom-blech'
// ... one with none, whose text the model reads ...
export const TEXT_PAGE = 'https://veggie-kueche.example/ofentofu'
// ... one whose text is longer than what is sent ...
export const LONG_PAGE = 'https://langer-text.example/mega-rezept'
// ... one that can't be read ...
export const DOWN_LINKED_PAGE = 'https://kochblog.example/rezepte/auch-nicht-da'
// ... and one whose text names a further page with a recipe.
export const FURTHER_PAGE = 'https://weiterleiter.example/rezepte'
// What reading TEXT_PAGE gives: the text of its article, nothing around it.
export const TEXT_PAGE_TEXT = [
  'Knuspriger Ofentofu',
  '',
  'Dieser Tofu wird auch ohne Frittieren richtig knusprig.',
  'Perfekt zu Reis.',
  '',
  'Zutaten',
  '',
  '400 g Tofu',
  '2 EL Speisestärke',
  '1 EL Sojasauce & etwas Salz',
  '',
  'Zubereitung',
  '',
  'Den Tofu pressen und in Würfel schneiden.',
  'Mit Speisestärke und Sojasauce mischen.',
  'Bei 200 °C 25 Minuten backen.',
].join('\n')
// Posts whose Captions point to those pages ...
export const LINKING_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000007'
export const LINKING_CAPTION = 'Linsenlasagne wie von Oma 🍝 Das ganze Rezept findest du auf meinem Blog: ofenliebe.example/linsenlasagne-vom-blech #lasagne'
export const TEXT_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000008'
export const TEXT_CAPTION = 'Knuspriger Ofentofu 🌱 Rezept: https://veggie-kueche.example/ofentofu #tofu'
export const LONG_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000009'
export const LONG_CAPTION = 'Das längste Rezept der Welt: https://langer-text.example/mega-rezept'
export const DOWN_LINK_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000010'
export const DOWN_LINK_CAPTION = 'Rezept gerade nicht erreichbar? https://kochblog.example/rezepte/auch-nicht-da'
export const FURTHER_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000011'
export const FURTHER_CAPTION = 'Alle meine Rezepte: https://weiterleiter.example/rezepte'
// ... and one pointing at a page on the machine itself, which is never fetched.
export const PRIVATE_TIKTOK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000012'
export const PRIVATE_PATH = '/rezept'
export const PRIVATE_CAPTION = `Rezept bei mir zu Hause: http://127.0.0.1:${ANTHROPIC_PORT}${PRIVATE_PATH}`
// Pins whose destinations are those pages: the recorded Pin page of Pin
// 85779567902561995 with its destination (og:see_also and pinterestapp:source,
// both) changed to the page.
export const PIN_TO_RECIPE = 'https://www.pinterest.com/pin/7300000000000000008/'
export const PIN_TO_TEXT = 'https://www.pinterest.com/pin/7300000000000000009/'
function pinPage(destination: string) {
  const html = readFileSync(new URL('../source-lookup/fixtures/pinterest-pin-page-plain-title.html', import.meta.url), 'utf8')
  return { html: html.replaceAll('https://l8r.it/7RDT', destination) }
}

export const LOOKUP_FIXTURES: LookupFixtures = {
  [LINKED_RECIPE_PAGE]: { page: sourcePage('blog-recipe-sections.html') },
  [TEXT_PAGE]: { page: sourcePage('blog-page-text-only.html') },
  [LONG_PAGE]: { page: { html: `<html><body><article><h1>Langes Rezept</h1><p>${'a'.repeat(30_000)}</p></article></body></html>` } },
  [DOWN_LINKED_PAGE]: { page: { status: 500 } },
  [FURTHER_PAGE]: { page: { html: `<html><body><article><h1>Meine Rezepte</h1><p>Zum Beispiel ${LINKED_RECIPE_PAGE}</p></article></body></html>` } },
  [LINKING_TIKTOK]: { kind: 'tiktok', canonicalLink: LINKING_TIKTOK, suggestedTitle: 'Linsenlasagne', creator: '@mara.kocht', caption: LINKING_CAPTION },
  [TEXT_TIKTOK]: { kind: 'tiktok', canonicalLink: TEXT_TIKTOK, suggestedTitle: 'Ofentofu', creator: '@mara.kocht', caption: TEXT_CAPTION },
  [LONG_TIKTOK]: { kind: 'tiktok', canonicalLink: LONG_TIKTOK, suggestedTitle: 'Langes Rezept', creator: '@mara.kocht', caption: LONG_CAPTION },
  [DOWN_LINK_TIKTOK]: { kind: 'tiktok', canonicalLink: DOWN_LINK_TIKTOK, suggestedTitle: 'Rezept weg', creator: '@mara.kocht', caption: DOWN_LINK_CAPTION },
  [FURTHER_TIKTOK]: { kind: 'tiktok', canonicalLink: FURTHER_TIKTOK, suggestedTitle: 'Rezeptsammlung', creator: '@mara.kocht', caption: FURTHER_CAPTION },
  [PRIVATE_TIKTOK]: { kind: 'tiktok', canonicalLink: PRIVATE_TIKTOK, suggestedTitle: 'Rezept zu Hause', creator: '@mara.kocht', caption: PRIVATE_CAPTION },
  [PIN_TO_RECIPE]: { kind: 'pinterest-pin', canonicalLink: PIN_TO_RECIPE, suggestedTitle: 'Linsenlasagne', page: pinPage(LINKED_RECIPE_PAGE) },
  [PIN_TO_TEXT]: { kind: 'pinterest-pin', canonicalLink: PIN_TO_TEXT, suggestedTitle: 'Ofentofu', caption: 'Ofentofu mit Reis', page: pinPage(TEXT_PAGE) },
  [RECIPE_TIKTOK]: { kind: 'tiktok', canonicalLink: RECIPE_TIKTOK, suggestedTitle: 'Linsensuppe', creator: '@mara.kocht', caption: RECIPE_CAPTION },
  [CHATTER_TIKTOK]: { kind: 'tiktok', canonicalLink: CHATTER_TIKTOK, suggestedTitle: 'Neues Video', creator: '@mara.kocht', caption: 'Heute gibt es etwas ganz Besonderes! Wer errät, was es wird? #foodtok #fyp' },
  [RECIPE_BLOG_WITH_CAPTION]: { kind: 'blog', canonicalLink: RECIPE_BLOG_WITH_CAPTION, caption: RECIPE_CAPTION, page: sourcePage('blog-recipe-sections.html') },
  [NO_RECIPE_BLOG_WITH_CAPTION]: { kind: 'blog', canonicalLink: NO_RECIPE_BLOG_WITH_CAPTION, caption: RECIPE_CAPTION, page: sourcePage('blog-og-only.html') },
  [DOWN_BLOG_WITH_CAPTION]: { kind: 'blog', canonicalLink: DOWN_BLOG_WITH_CAPTION, caption: RECIPE_CAPTION, page: { status: 500 } },
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
