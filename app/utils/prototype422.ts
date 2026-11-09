// PROTOTYPE #422: throwaway, never merge. Dev only. How Snackbert shows up in
// malkochen (spec #421): the Snackbert Question after a Cooking, the report
// sheet with its confirmation, and "Snackbert melden" / "gemeldet" on a
// Cooking in the Dish History. Each question's variant lives in the address
// (?frage= ?wie= ?blase= ?blatt= ?danke= ?melden= ?text= ?sprache=), switched
// from the floating bar (Prototype422Bar) too. Nothing is sent anywhere: the
// photo stays in the page, the recording is a running clock, "Senden" only
// marks the Cooking as reported until the page reloads.

export type P422Question = 'frage' | 'wie' | 'blase' | 'text' | 'blatt' | 'danke' | 'melden' | 'sprache'

export const P422_QUESTIONS: { key: P422Question, label: string, where: string, variants: { key: string, name: string }[] }[] = [
  {
    key: 'frage',
    label: 'Frage: wo',
    where: 'Board, nach dem Kochen',
    variants: [
      { key: 'A', name: 'Vom Bildschirmrand rechts' },
      { key: 'B', name: 'Von unten, schaut über die Kante' },
      { key: 'C', name: 'Am Platz des Toasts' },
    ],
  },
  {
    key: 'wie',
    label: 'Frage: wie',
    where: 'Wie er reinkommt',
    variants: [
      { key: 'slide', name: 'Gleitet rein' },
      { key: 'peek', name: 'Lugt erst, dann ganz' },
      { key: 'bounce', name: 'Hüpft rein' },
    ],
  },
  {
    key: 'blase',
    label: 'Blase',
    where: 'Die Sprechblase',
    variants: [
      { key: 'A', name: 'Hell, Comic-Spitze zu ihm' },
      { key: 'B', name: 'Dunkel wie der Toast' },
      { key: 'C', name: 'Butter-Rand, ohne Spitze' },
    ],
  },
  {
    key: 'text',
    label: 'Wortlaut',
    where: 'Frage, Blatt, Bestätigung',
    variants: [
      { key: '1', name: 'Kurz: "Traust du dich?"' },
      { key: '2', name: 'Beichte, mit dem Gericht' },
      { key: '3', name: 'Frech: "Was ist in dir gelandet?"' },
    ],
  },
  {
    key: 'blatt',
    label: 'Blatt',
    where: 'Nach "Ja", oder "Snackbert melden"',
    variants: [
      { key: 'A', name: 'Liste: Foto, Aufnahme, Text untereinander' },
      { key: 'B', name: 'Drei Kacheln mit Snackbert' },
      { key: 'C', name: 'Chat mit Snackbert' },
    ],
  },
  {
    key: 'danke',
    label: 'Bestätigung',
    where: 'Nach "Senden"',
    variants: [
      { key: 'A', name: 'Im Blatt, dann zu' },
      { key: 'B', name: 'Er schnappt es sich und verschwindet' },
      { key: 'C', name: 'Toast mit seinem Kopf' },
    ],
  },
  {
    key: 'melden',
    label: 'Verlauf',
    where: 'Dish-Detail, Verlauf',
    variants: [
      { key: 'A', name: 'Pille unter dem Kochen' },
      { key: 'B', name: 'Sein Kopf als Knopf' },
      { key: 'C', name: 'Textlink in der Zeile darunter' },
    ],
  },
  {
    key: 'sprache',
    label: 'Sprache',
    where: 'Nur Snackberts Texte',
    variants: [
      { key: 'de', name: 'Deutsch' },
      { key: 'en', name: 'English' },
      { key: 'it', name: 'Italiano' },
    ],
  },
]

export type P422Lang = 'de' | 'en' | 'it'

// One wording of the Question and its answers.
interface Ask { line: (dish: string) => string, yes: string, no: string, gone: string }

export interface P422Copy {
  ask: Record<'1' | '2' | '3', Ask>
  sheetTitle: string
  sheetSub: (dish: string) => string
  optional: string
  photo: string
  camera: string
  gallery: string
  photoChange: string
  photoRemove: string
  recording: string
  record: string
  stop: string
  rerecord: string
  play: string
  limit: string
  words: string
  wordsPrompt: string
  send: string
  sendBare: string
  chatHello: (dish: string) => string
  chatPrompt: string
  thanks: Record<'1' | '2' | '3', string>
  thanksSub: string
  done: string
  toast: string
  report: string
  reported: string
  reportedLong: string
  close: string
  tiles: { photo: string, voice: string, text: string }
}

export const P422_COPY: Record<P422Lang, P422Copy> = {
  de: {
    ask: {
      '1': { line: () => 'Na? Traust du dich, mir davon zu erzählen?', yes: 'Ja', no: 'Nein', gone: 'Schon gut, ich hab nix gesehen.' },
      '2': { line: dish => `Mmh, ${dish}! Beichtest du mir, wie viel du davon hattest?`, yes: 'Ich beichte', no: 'Heute nicht', gone: 'Dein Geheimnis ist bei mir sicher.' },
      '3': { line: () => 'Gekocht ist schön und gut. Aber was davon ist in dir gelandet?', yes: 'Sag ich dir', no: 'Geht dich nix an', gone: 'Pff. Ich merk mir das trotzdem.' },
    },
    sheetTitle: 'Snackbert melden',
    sheetSub: dish => `${dish}, heute gekocht`,
    optional: 'Alles hier ist freiwillig. Schickst du nichts mit, nimmt Snackbert eine normale Portion an.',
    photo: 'Foto deiner Portion',
    camera: 'Kamera',
    gallery: 'Galerie',
    photoChange: 'Anderes Foto',
    photoRemove: 'Foto entfernen',
    recording: 'Erzähl’s ihm',
    record: 'Aufnehmen',
    stop: 'Stopp',
    rerecord: 'Neu aufnehmen',
    play: 'Anhören',
    limit: 'Höchstens 2 Minuten',
    words: 'Ein paar Worte',
    wordsPrompt: 'Zum Beispiel: eine halbe Portion, dazu ein Glas Saft',
    send: 'Senden',
    sendBare: 'Ohne alles senden',
    chatHello: dish => `${dish}, soso. Wie viel war’s denn? Zeig’s mir, sag’s mir oder schreib’s mir.`,
    chatPrompt: 'Schreib Snackbert…',
    thanks: {
      '1': 'Hab’s! Ich rechne nach.',
      '2': 'Danke für die Beichte. Ich rechne nach.',
      '3': 'Notiert. Ich kau mal drauf rum.',
    },
    thanksSub: 'Was er draus macht, siehst du in Snackbert.',
    done: 'Fertig',
    toast: 'An Snackbert gemeldet',
    report: 'Snackbert melden',
    reported: 'gemeldet',
    reportedLong: 'An Snackbert gemeldet',
    close: 'Schließen',
    tiles: { photo: 'Foto', voice: 'Aufnahme', text: 'Text' },
  },
  en: {
    ask: {
      '1': { line: () => 'Well? Dare to tell me about it?', yes: 'Yes', no: 'No', gone: 'Fine, I saw nothing.' },
      '2': { line: dish => `Mmm, ${dish}! Will you confess how much you had?`, yes: 'I confess', no: 'Not today', gone: 'Your secret is safe with me.' },
      '3': { line: () => 'Cooking is all well and good. But how much of it ended up in you?', yes: 'I’ll tell you', no: 'None of your business', gone: 'Pff. I’ll remember anyway.' },
    },
    sheetTitle: 'Tell Snackbert',
    sheetSub: dish => `${dish}, cooked today`,
    optional: 'Everything here is optional. Send nothing and Snackbert assumes a normal portion.',
    photo: 'Photo of your portion',
    camera: 'Camera',
    gallery: 'Gallery',
    photoChange: 'Other photo',
    photoRemove: 'Remove photo',
    recording: 'Tell him',
    record: 'Record',
    stop: 'Stop',
    rerecord: 'Record again',
    play: 'Listen',
    limit: '2 minutes at most',
    words: 'A few words',
    wordsPrompt: 'For example: half a portion, with a glass of juice',
    send: 'Send',
    sendBare: 'Send without anything',
    chatHello: dish => `${dish}, I see. So how much was it? Show me, tell me or write it.`,
    chatPrompt: 'Write to Snackbert…',
    thanks: {
      '1': 'Got it! I’ll do the maths.',
      '2': 'Thanks for confessing. I’ll do the maths.',
      '3': 'Noted. I’ll chew on that.',
    },
    thanksSub: 'What he makes of it, you’ll see in Snackbert.',
    done: 'Done',
    toast: 'Sent to Snackbert',
    report: 'Tell Snackbert',
    reported: 'told',
    reportedLong: 'Sent to Snackbert',
    close: 'Close',
    tiles: { photo: 'Photo', voice: 'Recording', text: 'Text' },
  },
  it: {
    ask: {
      '1': { line: () => 'Allora? Hai il coraggio di raccontarmelo?', yes: 'Sì', no: 'No', gone: 'Va bene, non ho visto niente.' },
      '2': { line: dish => `Mmh, ${dish}! Mi confessi quanto ne hai mangiato?`, yes: 'Confesso', no: 'Oggi no', gone: 'Il tuo segreto è al sicuro con me.' },
      '3': { line: () => 'Cucinare va benissimo. Ma quanto ne è finito dentro di te?', yes: 'Te lo dico', no: 'Non sono affari tuoi', gone: 'Pff. Me lo ricordo lo stesso.' },
    },
    sheetTitle: 'Dillo a Snackbert',
    sheetSub: dish => `${dish}, cucinato oggi`,
    optional: 'Qui è tutto facoltativo. Se non mandi niente, Snackbert conta una porzione normale.',
    photo: 'Foto della tua porzione',
    camera: 'Fotocamera',
    gallery: 'Galleria',
    photoChange: 'Altra foto',
    photoRemove: 'Togli la foto',
    recording: 'Raccontaglielo',
    record: 'Registra',
    stop: 'Stop',
    rerecord: 'Registra di nuovo',
    play: 'Ascolta',
    limit: 'Al massimo 2 minuti',
    words: 'Due parole',
    wordsPrompt: 'Per esempio: mezza porzione, con un bicchiere di succo',
    send: 'Invia',
    sendBare: 'Invia senza niente',
    chatHello: dish => `${dish}, eh? Quanto ne hai mangiato? Fammelo vedere, dimmelo o scrivimelo.`,
    chatPrompt: 'Scrivi a Snackbert…',
    thanks: {
      '1': 'Ricevuto! Faccio due conti.',
      '2': 'Grazie della confessione. Faccio due conti.',
      '3': 'Segnato. Ci rimugino un po’.',
    },
    thanksSub: 'Cosa ne ricava, lo vedi in Snackbert.',
    done: 'Fatto',
    toast: 'Inviato a Snackbert',
    report: 'Dillo a Snackbert',
    reported: 'inviato',
    reportedLong: 'Inviato a Snackbert',
    close: 'Chiudi',
    tiles: { photo: 'Foto', voice: 'Registrazione', text: 'Testo' },
  },
}

export const P422_FACE = {
  happy: '/prototype422/face.webp',
  smart: '/prototype422/face_smart.webp',
  shush: '/prototype422/face_shush.webp',
  think: '/prototype422/face_think.webp',
  error: '/prototype422/face_error.webp',
  cam: '/prototype422/cam.webp',
  mic: '/prototype422/mic.webp',
  shrug: '/prototype422/shrug.webp',
} as const

// What the prototype is showing: the Question for a Dish, the sheet for a
// Cooking, the confirmation, and the Cookings reported so far (this visit).
export interface P422State {
  asking: { dish: string, cookingId: string | null, key: number } | null
  sheet: { dish: string, cookingId: string | null } | null
  thanks: { key: number } | null
  toast: boolean
  reported: string[]
}

export function useP422() {
  return useState<P422State>('prototype-422', () => ({ asking: null, sheet: null, thanks: null, toast: false, reported: [] }))
}

let askKey = 0
// The Question for a Dish just cooked (from BoardScreen, once its undo
// window has passed, or from the bar's "Nochmal").
export function p422Ask(dish: string, cookingId: string | null = null) {
  useP422().value.asking = { dish, cookingId, key: ++askKey }
}

export function p422Thanks() {
  useP422().value.thanks = { key: ++askKey }
}

const KEY = 'prototype-422-picks'

// The variant of one question: the address's, else the one picked before
// (kept for the visit), else the first.
export function p422Variant(question: P422Question, query: Record<string, unknown>): string {
  const q = P422_QUESTIONS.find(x => x.key === question)!
  const asked = typeof query[question] === 'string' ? query[question] as string : null
  const pick = asked ?? stored()[question] ?? q.variants[0]!.key
  return q.variants.some(v => v.key === pick) ? pick : q.variants[0]!.key
}

export function p422Remember(question: P422Question, variant: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...stored(), [question]: variant }))
  }
  catch {
    // Without storage the pick lasts until the page reloads.
  }
}

function stored(): Partial<Record<P422Question, string>> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  }
  catch {
    return {}
  }
}

// All picks at once, for the components.
export function useP422Picks() {
  const route = useRoute()
  return computed(() => ({
    frage: p422Variant('frage', route.query) as 'A' | 'B' | 'C',
    wie: p422Variant('wie', route.query) as 'slide' | 'peek' | 'bounce',
    blase: p422Variant('blase', route.query) as 'A' | 'B' | 'C',
    text: p422Variant('text', route.query) as '1' | '2' | '3',
    blatt: p422Variant('blatt', route.query) as 'A' | 'B' | 'C',
    danke: p422Variant('danke', route.query) as 'A' | 'B' | 'C',
    melden: p422Variant('melden', route.query) as 'A' | 'B' | 'C',
    copy: P422_COPY[p422Variant('sprache', route.query) as P422Lang],
  }))
}
