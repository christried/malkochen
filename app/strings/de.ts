// Every piece of UI text lives here. Components read it through useStrings(),
// so adding English later means adding an `en.ts` of type `Strings` and
// choosing between them in useStrings() -- no component changes. Its types
// come by relative paths: the tests read it too, and their typecheck
// (.nuxt/tsconfig.node.json) has no `~` aliases.
import type { AchievementLevel } from '../utils/achievement'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceBadgeKind } from '../../shared/source-badge'

// "3. Sept.", with the year only when it isn't this year. Always in German
// time, so the server and the browser render the same day.
function addedDate(date: Date): string {
  const zone = 'Europe/Berlin'
  const year = (d: Date) => new Intl.DateTimeFormat('de-DE', { year: 'numeric', timeZone: zone }).format(d)
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'short',
    year: year(date) === year(new Date()) ? undefined : 'numeric',
    timeZone: zone,
  }).format(date)
}

// "1 Gericht", "4 Gerichte".
function dishCount(count: number): string {
  return count === 1 ? '1 Gericht' : `${count} Gerichte`
}

export const de = {
  app: {
    name: 'malkochen',
  },
  // A Dish's note field suggests one of these made-up notes, a new one each
  // time it shows. Vegan, like everything in the app.
  dishNote: {
    examples: [
      'mit extra Knoblauch',
      'Tofu vorher gut auspressen',
      'doppelte Menge Erdnusssoße',
      'mit Räuchertofu und Frühlingszwiebeln',
      'Kichererbsen über Nacht einweichen',
      'statt Reis mit Couscous',
      'schärfer als im Video',
      'mit Kokosmilch statt Wasser',
      'Linsen vorher kurz anrösten',
      'mit Hefeflocken obendrauf',
      'reicht locker für vier',
      'Ofen auf 200 Grad, nicht 180',
      'zum Schluss Zitronenabrieb drüber',
    ],
    prompt: (example: string) => `Optional, z. B. „${example}“`,
  },
  // The links to the legal pages (utils/legal.ts), under the sign-in screen
  // and in the user menu.
  legal: {
    impressum: 'Impressum',
    privacy: 'Datenschutz',
  },
  signIn: {
    // "Was willst du malkochen?": the app's name (app.name) goes between
    // the two, highlighted.
    headline: { before: 'Was willst du ', after: '?' },
    intro: 'Sammle Essen, das du online findest, und plane, was du als Nächstes kochst.',
    google: 'Mit Google anmelden',
    pending: 'Einen Moment …',
    failed: 'Die Anmeldung hat nicht geklappt. Versuch es gleich noch mal.',
  },
  notUnlocked: {
    headline: 'Gleich geht’s los!',
    // Chris runs malkochen and keeps its Allowlist, so the name is written
    // out here (#205).
    body: 'Du bist noch nicht für malkochen freigeschaltet. Sag Chris Bescheid, dann kannst du loslegen.',
    otherAccount: 'Mit einem anderen Konto anmelden',
    // Arriving through an Invite Link: the Owner is the one to ask.
    invitedBody: (owner: string, board: string) => `Du bist noch nicht für malkochen freigeschaltet. Sag ${owner} Bescheid, dann geht’s los. Deine Einladung zu ${board} merken wir uns.`,
  },
  invite: {
    headline: (board: string) => `Du wurdest zu ${board} eingeladen`,
    body: (owner: string) => `${owner} lädt dich ein, gemeinsam Essen zu sammeln und zu planen, was ihr kocht.`,
    members: 'Schon dabei',
    invalidHeadline: 'Dieser Link geht nicht mehr.',
    invalidBody: 'Vielleicht wurde er zurückgesetzt. Frag nach einem neuen Link.',
    toApp: 'Zu malkochen',
  },
  board: {
    emptyBoardTitle: 'Noch nichts hier.',
    emptyBoardBody: 'Füg deinen ersten Link ein!',
    emptyColumn: 'Noch nichts hier.',
    columns: 'Spalten',
    loading: 'Board lädt …',
  },
  search: {
    open: 'Gerichte suchen',
    label: 'Gerichte suchen',
    prompt: 'Welches Gericht suchst du?',
    close: 'Suche schließen',
    resultsLabel: 'Suchergebnisse',
    found: (count: number) => `${dishCount(count)} gefunden`,
    noResultsTitle: 'Nichts gefunden.',
    noResultsBody: (query: string) => `Kein Gericht mit „${query}“ im Namen.`,
    failed: 'Die Suche hat nicht geklappt. Versuch es gleich noch mal.',
  },
  dish: {
    addedBy: (name: string) => `Hinzugefügt von ${name}`,
    hasNote: 'Mit Notiz',
    // The Creator's field in edit mode, and read out before the Creator
    // (CONTEXT.md) where it shows as just its name.
    creator: 'Veröffentlicht von',
    // The marker on a New Dish (CONTEXT.md).
    new: 'Neu',
    menu: (title: string) => `Mehr zu „${title}“`,
    // The same button's Tooltip: the card under it already says which Dish.
    more: 'Mehr',
    closeMenu: 'Schließen',
    delete: 'Löschen',
    deleted: (title: string) => `„${title}“ gelöscht`,
    undo: 'Rückgängig',
    deleteFailed: (title: string) => `„${title}“ ließ sich nicht löschen. Versuch es gleich noch mal.`,
    restoreFailed: (title: string) => `„${title}“ ließ sich nicht zurückholen.`,
    moveTo: 'Verschieben nach…',
    back: 'Zurück',
    moved: (title: string, column: string) => `„${title}“ nach „${column}“ verschoben`,
    movedToBoard: (title: string, board: string, column: string) => `„${title}“ ist jetzt in ${board} · ${column}`,
    thisBoard: 'Dieses Board',
    moveFailed: (title: string) => `„${title}“ ließ sich nicht verschieben. Versuch es gleich noch mal.`,
    cook: 'Gekocht ✓',
    // Under "Gekocht ✓" in the celebration's pill, for a Dish moved into
    // another Board's Gekocht Column: that Board, with its emoji.
    cookedOn: (board: string) => `in ${board}`,
    // "Gekocht ✓" on its button, where the check is drawn (CookButton).
    cookWord: 'Gekocht',
    cookLabel: (title: string) => `Gekocht ✓: „${title}“`,
    // Topfbert's speech bubble in the Gekocht celebration: one at random
    // each time, never the same twice in a row (utils/cheer). Short enough
    // for the bubble beside the toast on a 360px phone, and vegan.
    cheers: [
      'Mmh!',
      'Lecker!',
      'Hmm, fein!',
      'Yes, Chef!',
      'Mjam!',
      'Köstlich!',
      'Himmlisch!',
      'Ein Genuss!',
      'Gut gemacht!',
      'Bravo!',
      'Na, lecker!',
      'Guten Appetit!',
      'Weiter so!',
      'Top gekocht!',
      'So gut!',
      'Klasse!',
    ],
    cookedCount: (count: number) => `${count}× gekocht`,
    addNote: 'Notiz hinzufügen',
    cookFailed: (title: string) => `„${title}“ ließ sich nicht als gekocht eintragen. Versuch es gleich noch mal.`,
    uncookFailed: (title: string) => `„${title}“ ließ sich nicht zurückholen.`,
  },
  cooking: {
    noteHeading: 'Notiz zum Kochen',
    note: 'Notiz',
    // About how it went this time, so not one of the Dish note examples.
    notePrompt: 'Optional, z. B. „nächstes Mal mehr Knoblauch“',
    save: 'Speichern',
    saving: 'Speichert …',
    close: 'Schließen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    summary: (count: number, last: Date) => `${count}× gekocht · zuletzt ${addedDate(last)}`,
    date: (date: Date) => addedDate(date),
    by: (name: string) => `von ${name}`,
    addNote: '+ Notiz',
    addNoteLabel: (date: Date) => `Notiz zum Kochen am ${addedDate(date)} hinzufügen`,
    editNoteLabel: (date: Date) => `Notiz zum Kochen am ${addedDate(date)} bearbeiten`,
    deleteLabel: (date: Date) => `Kochen am ${addedDate(date)} löschen`,
    // Their Tooltips: the entry they sit in already shows the date.
    editNoteTip: 'Notiz bearbeiten',
    deleteTip: 'Kochen löschen',
    deleted: (date: Date) => `Kochen am ${addedDate(date)} gelöscht`,
    deleteFailed: 'Das Löschen hat nicht geklappt. Versuch es gleich noch mal.',
    restoreFailed: 'Das Zurückholen hat nicht geklappt.',
  },
  achievement: {
    level: {
      tried: 'Ausprobiert',
      favourite: 'Wird Liebling',
      regular: 'Stammgericht',
      classic: 'Klassiker',
    } satisfies Record<AchievementLevel, string>,
    count: (count: number) => `${count}×`,
    // "Wird Liebling: 4× gekocht, noch 1× bis Stammgericht".
    label: (level: string, count: number, next: { level: string, left: number } | null) =>
      `${level}: ${count}× gekocht${next ? `, noch ${next.left}× bis ${next.level}` : ''}`,
  },
  milestone: {
    headline: 'Klassiker!',
    body: (title: string, count: number) => `${title} ist jetzt ein Klassiker: ${count}× gekocht.`,
    close: 'Schließen',
  },
  boardCreated: {
    headline: (emoji: string, name: string) => `${emoji} ${name} ist bereit`,
    body: 'Sammle hier, was du kochen willst, und lade andere ein.',
    start: 'Los geht’s',
    close: 'Schließen',
  },
  detail: {
    close: 'Schließen',
    goneMeanwhile: (title: string) => `„${title}“ ist nicht mehr auf diesem Board.`,
    openOriginal: 'Original öffnen',
    noSource: 'Ohne Link',
    placement: (board: string, column: string) => `${board} · ${column}`,
    added: (name: string | null, date: Date) => {
      const day = addedDate(date)
      return name ? `Hinzugefügt von ${name} am ${day}` : `Hinzugefügt am ${day}`
    },
    cookingHistory: 'Gekocht',
    cookingHistoryEmpty: 'Noch nie gekocht.',
    edit: 'Bearbeiten',
    editing: 'Gericht bearbeiten',
    title: 'Titel',
    note: 'Notiz',
    creatorPrompt: 'z. B. @christried oder ein Blog',
    source: 'Link',
    sourcePrompt: 'Link von TikTok, Instagram, YouTube, Pinterest oder einem Blog',
    sourceHint: 'Ein neuer Link ändert das Bild nicht. Dafür gibt es „Bild neu laden“.',
    image: 'Bild',
    chooseImage: 'Bild wählen',
    reloadImage: 'Bild neu laden',
    reloadingImage: 'Lädt …',
    reloadFound: 'Neues Bild vom Link. Es wird beim Speichern übernommen.',
    reloadNothingFound: 'Kein Bild gefunden. Beim Speichern bekommt das Gericht sein Platzhalterbild.',
    reloadFailed: 'Das Nachschauen hat nicht geklappt. Versuch es gleich noch mal.',
    reloadTooMany: 'Zu viele Versuche. Gleich klappt das Nachschauen wieder.',
    save: 'Speichern',
    saving: 'Speichert …',
    cancel: 'Abbrechen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    imageNotStored: (title: string) => `Das neue Bild ließ sich nicht speichern. „${title}“ behält sein bisheriges Bild.`,
  },
  // The Source pill on a Dish's image: short, so it fits on a card's.
  sources: {
    tiktok: 'TikTok',
    instagram: 'Insta',
    youtube: 'YouTube',
    pinterest: 'Pin',
    web: 'Web',
  } satisfies Record<SourceBadgeKind, string>,
  // The image dialog ("Bild wählen") in Add Dish and the Dish detail.
  imageDialog: {
    fromLink: 'Bild vom Link',
    ownPhoto: 'Eigenes Foto',
    placeholders: 'Platzhalter',
    uploading: 'Foto wird hochgeladen …',
    tooLarge: 'Das Foto ist zu groß. Ein kleineres oder ein JPEG klappt bestimmt.',
    notAnImage: 'Das ist kein Foto, das ich lesen kann. JPEG, PNG, WebP oder HEIC gehen.',
    failed: 'Das Hochladen hat nicht geklappt. Versuch es gleich noch mal.',
    // Over the user's upload limit (server/rate-limits.ts).
    tooMany: 'Zu viele Fotos auf einmal. In einer Weile klappt es wieder.',
    // Shifting a Source image or own photo within the card's frame.
    focus: 'Ausschnitt',
    focusHint: 'Verschieb das Bild, bis das Essen im Rahmen ist.',
    focusValue: (x: number, y: number) => `${x} % von links, ${y} % von oben`,
  },
  addDish: {
    open: 'Gericht hinzufügen',
    heading: 'Gericht hinzufügen',
    link: 'Link',
    linkPrompt: 'Link von TikTok, Instagram, YouTube, Pinterest oder einem Blog',
    paste: 'Einfügen',
    lookingUp: 'Ich schau mal nach …',
    titleNeeded: 'Titel eingeben',
    titleNeededHint: 'Zu diesem Link gibt es keinen Titel. Wie heißt das Gericht?',
    nothingFound: 'Kein Bild gefunden. Such dir eins aus!',
    lookupFailed: 'Das Nachschauen hat nicht geklappt. Speichern geht trotzdem: mit Titel und Bild von dir.',
    // Over the user's Source Lookup limit (server/rate-limits.ts).
    lookupTooMany: 'Zu viele Versuche. Gleich klappt das Nachschauen wieder. Speichern geht trotzdem: mit Titel und Bild von dir.',
    sourceImage: 'Bild vom Link',
    changeImage: 'Bild ändern',
    useSourceImage: 'Bild vom Link nehmen',
    board: 'Board',
    duplicate: (title: string, column: string) => `Schon auf dem Board: „${title}“ in ${column}`,
    openDuplicate: 'Öffnen',
    saveAnyway: 'Trotzdem speichern',
    // By the switched-off "Speichern", pointing up to the warning above.
    duplicateHint: 'Schon auf dem Board. Oben kannst du es trotzdem speichern.',
    withoutLink: 'Ohne Link hinzufügen',
    title: 'Titel',
    titlePrompt: 'Wie heißt das Gericht?',
    note: 'Notiz',
    image: 'Bild',
    chooseImage: 'Bild wählen',
    save: 'Speichern',
    saving: 'Speichert …',
    close: 'Schließen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    imageNotStored: (title: string) => `Das Bild vom Link ließ sich nicht speichern. „${title}“ hat jetzt ein Platzhalterbild.`,
    photoNotStored: (title: string) => `Dein Foto ließ sich nicht speichern. „${title}“ hat jetzt ein Platzhalterbild.`,
  },
  placeholders: {
    pasta: 'Pasta',
    ramen: 'Ramen',
    bowl: 'Salat / Bowl',
    breakfast: 'Frühstück',
    burger: 'Burger',
    tacos: 'Tacos',
    wok: 'Wok',
    bread: 'Brot',
    cake: 'Kuchen',
    dumplings: 'Dumplings',
    smoothie: 'Smoothie',
    eintopf: 'Eintopf',
  } satisfies Record<Placeholder, string>,
  boards: {
    switcher: (board: string) => `Board wechseln, jetzt: ${board}`,
    // The switcher's Tooltip: it shows the Board's name itself.
    switch: 'Board wechseln',
    label: 'Deine Boards',
    current: 'Aktuelles Board',
    dishCount,
    newBoard: 'Neues Board',
    name: 'Name',
    // A new Board's name field suggests one of these, a new one each time.
    nameExamples: [
      'Kochclub',
      'Sonntagsküche',
      'Feierabendküche',
      'Wir kochen',
      'Lieblingsrezepte',
      'Kochabend',
      'Meal Prep',
      'Was essen wir heute?',
      'Küchenexperimente',
      'Mittagspause',
    ],
    namePrompt: (example: string) => `z. B. „${example}“`,
    emoji: 'Emoji',
    create: 'Board erstellen',
    creating: 'Erstellt …',
    close: 'Schließen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
  },
  settings: {
    title: 'Board-Einstellungen',
    back: 'Zurück zum Board',
    board: 'Board',
    name: 'Name',
    emoji: 'Emoji ändern',
    chooseEmoji: 'Emoji wählen',
    close: 'Schließen',
    columns: 'Spalten',
    columnName: (name: string) => `Name der Spalte „${name}“`,
    columnSubtitle: (name: string) => `Untertitel der Spalte „${name}“`,
    subtitlePrompt: 'Untertitel (optional)',
    notDeletable: 'Kann nicht gelöscht werden',
    dishCount,
    moveUp: (name: string) => `„${name}“ nach oben`,
    moveDown: (name: string) => `„${name}“ nach unten`,
    deleteColumn: (name: string) => `Spalte „${name}“ löschen`,
    // Their Tooltips: the row they sit in already shows the Column's name.
    moveUpTip: 'Nach oben',
    moveDownTip: 'Nach unten',
    deleteColumnTip: 'Spalte löschen',
    lastColumn: 'Ein Board braucht neben „Gekocht“ noch mindestens eine Spalte.',
    newColumn: 'Neue Spalte',
    // A new Column's name field suggests one of these, a new one each time.
    newColumnExamples: [
      'Wochenende',
      'Meal Prep',
      'Für Gäste',
      'Schnell & einfach',
      'Sonntagsbrunch',
      'Nachtisch',
      'Grillsaison',
      'Lunchbox',
      'Feierabendküche',
      'Weihnachten',
    ],
    newColumnPrompt: (example: string) => `z. B. „${example}“`,
    add: 'Hinzufügen',
    moveDishes: (count: number, column: string) => `${dishCount(count)} in „${column}“. Wohin verschieben?`,
    moveAndDelete: 'Verschieben und löschen',
    cancel: 'Abbrechen',
    invite: 'Einladen',
    inviteLink: 'Einladungslink',
    inviteHint: 'Wer den Link öffnet und für malkochen freigeschaltet ist, kommt auf dieses Board.',
    copyLink: 'Link kopieren',
    copied: 'Link kopiert',
    // On the button, for a moment after copying.
    copiedShort: 'Kopiert ✓',
    shareLink: 'Link teilen',
    shareText: (board: string) => `Komm auf unser Board ${board} bei malkochen!`,
    resetLink: 'Link zurücksetzen',
    resetConfirm: 'Link zurücksetzen?',
    resetBody: 'Der bisherige Link funktioniert dann nicht mehr. Wer schon auf dem Board ist, bleibt drauf.',
    resetDone: 'Neuer Link erstellt. Der alte funktioniert nicht mehr.',
    members: 'Mitglieder',
    you: 'du',
    owner: 'Besitzer:in',
    manageMember: (name: string) => `${name} verwalten`,
    handOver: 'Besitz übertragen',
    handOverConfirm: (name: string) => `Besitz an ${name} übertragen?`,
    handOverBody: (name: string) => `${name} kann dann Mitglieder entfernen, den Link zurücksetzen und das Board löschen. Du bleibst Mitglied.`,
    handedOver: (name: string) => `${name} hat jetzt den Besitz.`,
    removeMember: 'Vom Board entfernen',
    removeConfirm: (name: string) => `${name} entfernen?`,
    removeBody: (name: string) => `Die Gerichte von ${name} bleiben auf dem Board. Mit dem Einladungslink kann ${name} wieder beitreten, bis du ihn zurücksetzt.`,
    removed: (name: string) => `${name} ist nicht mehr auf dem Board.`,
    leave: 'Board verlassen',
    leaveConfirm: 'Board verlassen?',
    leaveBody: 'Deine Gerichte bleiben auf dem Board, mit deinem Namen. Zurück kommst du nur über den Einladungslink.',
    ownerLeaveHint: 'Um das Board zu verlassen, übertrag erst den Besitz an ein anderes Mitglied.',
    aloneHint: 'Du bist allein auf dem Board. Wenn du es nicht mehr brauchst, lösch es.',
    deleteBoard: 'Board löschen',
    deleteConfirm: 'Board löschen?',
    deleteBody: (board: string) => `${board} verschwindet dann für alle, mit allen Spalten, Gerichten und was ihr gekocht habt. Das lässt sich nicht rückgängig machen.`,
    deleteTypeName: (name: string) => `Tipp zum Bestätigen „${name}“ ein`,
    deleteForGood: 'Endgültig löschen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
  },
  // public/offline.html repeats these, for the service worker. It also has
  // the only copy of "malkochen ist gerade nicht erreichbar", which only it
  // shows.
  offline: {
    headline: 'Du bist offline.',
    body: 'Sobald du wieder Netz hast, geht’s hier weiter.',
    retry: 'Nochmal versuchen',
  },
  // The error screen: a page that isn't there, or anything unexpected --
  // which is on malkochen's side, and it says so.
  error: {
    headline: 'Da ist was angebrannt.',
    body: 'Das liegt an uns, nicht an dir. Versuch es gleich noch mal.',
    retry: 'Nochmal versuchen',
    notFoundHeadline: 'Das gibt’s hier nicht.',
    notFoundBody: 'Diese Seite gibt es nicht, oder du bist dort nicht (mehr) dabei.',
    toApp: 'Zu malkochen',
  },
  // Your own settings (PRD stories 73–75), not a Board's.
  userSettings: {
    title: 'Einstellungen',
    open: 'Deine Einstellungen',
    // Your Profile Picture at the top right of the Board: opens the user menu.
    menu: 'Dein Konto',
    back: 'Zurück zum Board',
    account: 'Konto',
    language: 'Sprache',
    german: 'Deutsch',
    moreLanguages: 'Weitere Sprachen kommen später.',
    signOut: 'Abmelden',
    // Your own Profile Picture, shown instead of your Google photo.
    pickPicture: 'Eigenes Bild hochladen',
    changePicture: 'Anderes Bild hochladen',
    removePicture: 'Eigenes Bild entfernen',
    uploadingPicture: 'Bild wird hochgeladen …',
    previewTitle: 'Dein Profilbild',
    previewAlt: 'Vorschau',
    previewHint: 'So sehen dich die anderen auf euren Boards.',
    usePicture: 'Übernehmen',
    savingPicture: 'Speichert …',
    cancelPicture: 'Abbrechen',
    closePreview: 'Schließen',
  },
  theme: {
    label: 'Darstellung',
    light: 'Hell',
    dark: 'Dunkel',
    system: 'System',
  },
  // The Board's keyboard shortcuts (utils/shortcuts.ts): the "?" dialog and
  // the section in your settings.
  shortcuts: {
    title: 'Tastenkürzel',
    intro: 'Mit einer Tastatur geht auf dem Board einiges schneller. Nur nicht, während du in ein Feld tippst.',
    ok: 'OK',
    close: 'Schließen',
    does: {
      addDish: 'Gericht hinzufügen',
      search: 'Gerichte suchen',
      close: 'Schließt, was offen ist: Dialog, Gericht oder Suche',
      boardSettings: 'Board-Einstellungen',
      switchBoard: 'Zum 1. bis 9. Board wechseln',
      help: 'Diese Tastenkürzel zeigen',
    },
  },
}

export type Strings = typeof de
