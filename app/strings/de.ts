// Every piece of UI text lives here, in German, the source the other
// languages are translated from (en.ts). Each of them is of the type
// `Strings`, so one missing a key fails the type check. Components read the
// current language's through useStrings(). Its types come by relative
// paths: the tests read it too, and their typecheck
// (.nuxt/tsconfig.node.json) has no `~` aliases.
import type { AchievementLevel } from '../utils/achievement'
import type { SourceColumn } from '../../shared/admin'
import type { LanguageChoice } from '../../shared/language'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceBadgeKind } from '../../shared/source-badge'
import type { VideoPlatform } from '../../shared/video-embed'
import { intlFor } from './intl'

// The video platforms' names in full, as a player's title says them.
const VIDEO_PLATFORMS: Record<VideoPlatform, string> = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram' }

const { number, plural, day: addedDate, month: monthAndYear, moment, time } = intlFor('de')

// "1 Gericht", "4 Gerichte".
function dishCount(count: number): string {
  return `${number(count)} ${plural(count, { one: 'Gericht', other: 'Gerichte' })}`
}

// "ließ" for one Dish, "ließen" for several.
function lassenPast(count: number): string {
  return plural(count, { one: 'ließ', other: 'ließen' })
}

// "Ada", "Ada und Linus", "Ada, Linus und Grace".
function nameList(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`
}

// Like nameList, but at most three names: "Ada, Linus und Grace", then
// "Ada, Linus und 2 andere" (outside the app, where space is short).
function someNames(names: string[]): string {
  return names.length <= 3 ? nameList(names) : `${names.slice(0, 2).join(', ')} und ${number(names.length - 2)} andere`
}

// "1 neues Gericht", "3 neue Gerichte".
function newDishCount(count: number): string {
  return `${number(count)} ${plural(count, { one: 'neues Gericht', other: 'neue Gerichte' })}`
}

// "1 Kommentar", "3 Kommentare" and "1 Daumen", "3 Daumen", leaving out a
// count of 0 (#351): ["3 Kommentare", "1 Daumen"].
function talkCounts(comments: number, votes: number): string[] {
  return [
    ...comments ? [`${number(comments)} ${plural(comments, { one: 'Kommentar', other: 'Kommentare' })}`] : [],
    ...votes ? [`${number(votes)} Daumen`] : [],
  ]
}

// A Vote on `dish`, as the Verlauf says it (history.voted).
const voted = (name: string, dish: string, up: boolean) => up ? `${name} fand ${dish} gut 👍` : `${name} fand ${dish} nicht so gut 👎`

export const de = {
  app: {
    name: 'malkochen',
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
    // Email sign-in with a code (#345): below Google, after "oder".
    or: 'oder',
    email: 'E-Mail-Adresse',
    sendCode: 'Code per E-Mail schicken',
    codeSent: (email: string) => `Wir haben dir einen Code an ${email} geschickt.`,
    code: 'Code aus der E-Mail',
    withCode: 'Anmelden',
    resend: 'Neuen Code schicken',
    resendIn: (seconds: number) => `Neuer Code in ${seconds} s`,
    otherEmail: 'Andere Adresse',
    wrongCode: 'Der Code stimmt nicht. Versuch es noch mal.',
    tooManyTries: 'Zu viele Versuche. Lass dir einen neuen Code schicken.',
    codeExpired: 'Der Code ist abgelaufen. Lass dir einen neuen schicken.',
    tooFast: 'Zu viele Anfragen. Warte kurz und versuch es dann noch mal.',
    // Over the hourly limit on sign-in codes (#347, server/rate-limits.ts).
    tooManyCodes: (at: Date) => `Zu viele Codes angefordert. Ab ${time(at)} Uhr kannst du wieder einen anfordern.`,
  },
  notUnlocked: {
    headline: 'Bald geht’s los!',
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
    // The Gekocht Column's Column Subtitle (CONTEXT.md): fixed, so not
    // stored with the Board (#328), and shown in each viewer's language.
    gekochtSubtitle: 'Schon geschafft!',
    columns: 'Spalten',
    loading: 'Board lädt …',
    // The edge indicators, where the window cuts Columns off.
    previousColumn: 'Vorherige Spalte',
    nextColumn: 'Nächste Spalte',
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
  // The user popover (#213): someone's Username, large Profile Picture and
  // these lines, from their Profile Picture on a card or in the Dish detail.
  person: {
    since: (date: Date) => `dabei seit ${monthAndYear(date)}`,
    // On the Board it was opened on.
    dishesAdded: (count: number) => `${dishCount(count)} hinzugefügt`,
    // The Boards the viewer and they both belong to; one's own popover
    // lists all one's Boards.
    sharedBoards: 'Gemeinsame Boards',
    ownBoards: 'Deine Boards',
    loading: 'Lädt …',
    // Nothing more to show: no Board shared with them any more (they left
    // it, and the Dishes they added stayed), or the request failed.
    unavailable: 'Mehr ist gerade nicht zu sehen.',
  },
  dish: {
    addedBy: (name: string) => `Hinzugefügt von ${name}`,
    // The Creator's field in edit mode, and read out before the Creator
    // (CONTEXT.md) where it shows as just its name.
    creator: 'Veröffentlicht von',
    // The marker on a New Dish (CONTEXT.md).
    new: 'Neu',
    // What the chip on a card's image shows of its Dish History (#335),
    // read out in its place: its Votes, how many Comments, and whether
    // there's something new in it since you last opened the Dish.
    votesUp: (count: number) => `${count}× Daumen hoch`,
    votesDown: (count: number) => `${count}× Daumen runter`,
    comments: (count: number) => count === 1 ? '1 Kommentar' : `${count} Kommentare`,
    newInHistory: 'Neues im Verlauf',
    menu: (title: string) => `Mehr zu „${title}“`,
    // The same button's Tooltip: the card under it already says which Dish.
    more: 'Mehr',
    closeMenu: 'Schließen',
    // Archiving a Dish (CONTEXT.md: Archived Dish).
    delete: 'Archivieren',
    deleted: (title: string) => `„${title}“ archiviert`,
    undo: 'Rückgängig',
    deleteFailed: (title: string) => `„${title}“ ließ sich nicht archivieren. Versuch es gleich noch mal.`,
    restoreFailed: (title: string) => `„${title}“ ließ sich nicht zurückholen.`,
    moveTo: 'Verschieben nach…',
    back: 'Zurück',
    moved: (title: string, column: string) => `„${title}“ nach „${column}“ verschoben`,
    movedToBoard: (title: string, board: string, column: string) => `„${title}“ ist jetzt in ${board} · ${column}`,
    thisBoard: 'Dieses Board',
    moveFailed: (title: string) => `„${title}“ ließ sich nicht verschieben. Versuch es gleich noch mal.`,
    // A move or archive refused as the Owner just took the Permission away.
    notAllowed: (title: string) => `Mit „${title}“ darfst du das auf diesem Board nicht mehr. Das legt die Besitzer:in fest.`,
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
    cookedCount: (count: number) => `${number(count)}× gekocht`,
    // In the Gekocht toast: opens the comment field in the Dish detail.
    comment: 'Kommentieren',
    cookFailed: (title: string) => `„${title}“ ließ sich nicht als gekocht eintragen. Versuch es gleich noch mal.`,
    uncookFailed: (title: string) => `„${title}“ ließ sich nicht zurückholen.`,
  },
  // Several Dishes selected at once (#218): a long-press on phones, Ctrl-
  // click on desktop, and the bar at the bottom.
  selection: {
    label: 'Auswahl',
    count: (count: number) => `${number(count)} ausgewählt`,
    move: 'Verschieben',
    delete: 'Archivieren',
    close: 'Auswahl beenden',
    moved: (count: number, column: string) => `${dishCount(count)} nach „${column}“ verschoben`,
    movedToBoard: (count: number, board: string, column: string) => `${dishCount(count)} ${plural(count, { one: 'ist', other: 'sind' })} jetzt in ${board} · ${column}`,
    deleted: (count: number) => `${dishCount(count)} archiviert`,
    moveFailed: (count: number) => `${dishCount(count)} ${lassenPast(count)} sich nicht verschieben. Versuch es gleich noch mal.`,
    deleteFailed: (count: number) => `${dishCount(count)} ${lassenPast(count)} sich nicht archivieren. Versuch es gleich noch mal.`,
    notAllowed: 'Das darfst du mit diesen Gerichten auf diesem Board nicht mehr. Das legt die Besitzer:in fest.',
    backFailed: (count: number) => `${dishCount(count)} ${lassenPast(count)} sich nicht zurückholen.`,
  },
  cooking: {
    summary: (count: number, last: Date) => `${number(count)}× gekocht · zuletzt ${addedDate(last)}`,
    date: (date: Date) => addedDate(date),
    by: (name: string) => `von ${name}`,
    deleteLabel: (date: Date) => `Kochen am ${addedDate(date)} löschen`,
    // Its Tooltip: the entry it sits in already shows the date.
    deleteTip: 'Kochen löschen',
    deleted: (date: Date) => `Kochen am ${addedDate(date)} gelöscht`,
    deleteFailed: 'Das Löschen hat nicht geklappt. Versuch es gleich noch mal.',
    restoreFailed: 'Das Zurückholen hat nicht geklappt.',
  },
  // The Dish History at the bottom of the Dish detail ("Verlauf", #332).
  history: {
    heading: 'Verlauf',
    // Whoever's account is gone (CONTEXT.md: Deleted Account).
    deletedAccount: 'Gelöschtes Konto',
    added: (name: string) => `${name} hat das Gericht hinzugefügt`,
    cooked: (name: string) => `${name} hat es gekocht`,
    // When an entry happened: "heute, 20:55", else "18. Sept.".
    when: (at: Date) => moment(at, time => `heute, ${time}`),
    // After its time: "18. Sept., bearbeitet".
    edited: 'bearbeitet',
    commentMenu: (own: boolean): string => own ? 'Kommentar bearbeiten oder löschen' : 'Kommentar löschen',
    editComment: 'Bearbeiten',
    deleteComment: 'Löschen',
    field: 'Kommentar',
    fieldPrompt: 'Kommentieren',
    editPrompt: 'Kommentar bearbeiten',
    send: 'Senden',
    saveEdit: 'Speichern',
    cancelEdit: 'Abbrechen',
    commentDeleted: 'Kommentar gelöscht',
    commentFailed: 'Der Kommentar ließ sich nicht senden. Versuch es gleich noch mal.',
    commentEditFailed: 'Die Änderung ließ sich nicht speichern. Versuch es gleich noch mal.',
    commentDeleteFailed: 'Das Löschen hat nicht geklappt. Versuch es gleich noch mal.',
    commentRestoreFailed: 'Das Zurückholen hat nicht geklappt.',
    loadFailed: 'Die Kommentare ließen sich nicht laden.',
    retry: 'Erneut versuchen',
    // Votes (CONTEXT.md: Vote): "Wie war’s?" with 👍 👎, in the Verlauf and
    // the Gekocht toast.
    howWasIt: 'Wie war’s?',
    voteUp: 'Daumen hoch',
    voteDown: 'Daumen runter',
    voted: (name: string, up: boolean) => up ? `${name} fand es gut` : `${name} fand es nicht so gut`,
    voteFailed: 'Deine Stimme ließ sich nicht speichern. Versuch es gleich noch mal.',
    // Refused as the Owner just took "comment and vote" away.
    commentNotAllowed: 'Auf diesem Board darfst du nicht mehr kommentieren. Das legt die Besitzer:in fest.',
    voteNotAllowed: 'Auf diesem Board darfst du nicht mehr abstimmen. Das legt die Besitzer:in fest.',
  },
  achievement: {
    level: {
      tried: 'Ausprobiert',
      favourite: 'Wird Liebling',
      regular: 'Stammgericht',
      classic: 'Klassiker',
    } satisfies Record<AchievementLevel, string>,
    count: (count: number) => `${number(count)}×`,
    // "Wird Liebling: 4× gekocht, noch 1× bis Stammgericht".
    label: (level: string, count: number, next: { level: string, left: number } | null) =>
      `${level}: ${number(count)}× gekocht${next ? `, noch ${number(next.left)}× bis ${next.level}` : ''}`,
  },
  milestone: {
    headline: 'Klassiker!',
    body: (title: string, count: number) => `${title} ist jetzt ein Klassiker: ${number(count)}× gekocht.`,
    close: 'Überspringen',
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
    // Click-to-play video (#221).
    playVideo: 'Video abspielen',
    videoPlayer: (platform: VideoPlatform) => `Video von ${VIDEO_PLATFORMS[platform]}`,
    videoUnavailable: 'Dieses Video lässt sich hier nicht abspielen.',
    openOnInstagram: 'Auf Instagram öffnen',
    // In place of "Video abspielen" for a Reel Instagram won't play here (#279).
    watchOnInstagram: 'Auf Instagram ansehen',
    noSource: 'Ohne Link',
    placement: (board: string, column: string) => `${board} · ${column}`,
    cookingHistoryEmpty: 'Noch nie gekocht.',
    edit: 'Bearbeiten',
    editing: 'Gericht bearbeiten',
    title: 'Titel',
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
    notAllowed: 'Dieses Gericht darfst du nicht mehr bearbeiten. Das legt die Besitzer:in fest.',
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
    tooMany: 'Für heute waren das genug Fotos. Morgen klappt es wieder.',
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
    image: 'Bild',
    chooseImage: 'Bild wählen',
    save: 'Speichern',
    saving: 'Speichert …',
    close: 'Schließen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    imageNotStored: (title: string) => `Das Bild vom Link ließ sich nicht speichern. „${title}“ hat jetzt ein Platzhalterbild.`,
    photoNotStored: (title: string) => `Dein Foto ließ sich nicht speichern. „${title}“ hat jetzt ein Platzhalterbild.`,
    // Refused for want of the Permission (403): the Owner switched it off.
    notAllowed: 'Auf diesem Board darfst du keine Gerichte hinzufügen. Das legt die Besitzer:in fest.',
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
    switcher: (board: string, count: number | null) => count === null ? `Board wechseln, jetzt: ${board}` : `Board wechseln, jetzt: ${board}, ${dishCount(count)}`,
    // How many Dishes a Board holds, after its name in the header and the
    // switcher: „Kochclub · 23“.
    count: (count: number) => `· ${number(count)}`,
    // The switcher's Tooltip: it shows the Board's name itself.
    switch: 'Board wechseln',
    label: 'Deine Boards',
    current: 'Aktuelles Board',
    // The cogwheel on each Board's row in the switcher (#282).
    settings: (board: string) => `Board-Einstellungen: ${board}`,
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
    // At BOARDS_PER_USER Boards of their own (#347, shared/board.ts), and
    // over the daily limit on creating Boards (server/rate-limits.ts).
    tooManyBoards: (count: number) => `Du hast schon ${number(count)} eigene Boards. Lösch eins, dann kannst du ein neues erstellen.`,
    tooManyToday: 'Das waren viele neue Boards für einen Tag. Morgen kannst du wieder eins erstellen.',
    creating: 'Erstellt …',
    close: 'Schließen',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    // The Owner's Archived Boards at the end of the switcher (CONTEXT.md:
    // Archived Board), each with "Wiederherstellen" and "Endgültig löschen"
    // (settings.restore, settings.deleteForGood) and its days left
    // (settings.daysLeft). `board`: its emoji and name.
    archive: 'Archiv',
    restoreBoard: (board: string) => `${board} wiederherstellen`,
    purgeBoard: (board: string) => `${board} endgültig löschen`,
    purgeConfirm: (board: string) => `${board} endgültig löschen?`,
    purgeBody: 'Das Board verschwindet dann mit allen Spalten, Gerichten, Bildern und allem, was ihr gekocht habt. Das lässt sich nicht rückgängig machen.',
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
    // The labels of its fields once open; the names readers get say which
    // Column (columnName, columnSubtitle).
    columnNameLabel: 'Name',
    subtitleLabel: 'Untertitel',
    subtitlePrompt: 'Untertitel (optional)',
    fixedSubtitle: (subtitle: string) => `Untertitel fest: „${subtitle}“`,
    notDeletable: 'Kann nicht gelöscht werden',
    dishCount,
    moveUp: (name: string) => `„${name}“ nach oben`,
    moveDown: (name: string) => `„${name}“ nach unten`,
    deleteColumn: (name: string) => `Spalte „${name}“ löschen`,
    // What their buttons say: the open row already shows the Column's name.
    moveUpText: 'Nach oben',
    moveDownText: 'Nach unten',
    deleteColumnText: 'Spalte löschen',
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
    // Permissions (CONTEXT.md: "Rechte"): the Owner switches a Member's
    // in their sheet; every other Member sees their own, read-only.
    permissions: 'Rechte',
    yourPermissions: 'Was du hier darfst',
    yourPermissionsHint: 'Das legt die Besitzer:in des Boards fest.',
    // The shortcut: everything off but commenting and voting.
    viewOnly: 'Nur ansehen',
    viewOnlyHint: 'Schaltet alles aus außer Kommentieren und abstimmen.',
    // The Default Permissions, which a new Member gets.
    forNewMembers: 'Für neue Mitglieder',
    forNewMembersHint: 'Wer über den Einladungslink dazukommt, bekommt diese Rechte. Wer schon dabei ist, behält die bisherigen.',
    permission: {
      addDishes: { label: 'Gerichte hinzufügen', hint: 'Neue Gerichte aufs Board legen, auch über Teilen.' },
      editDishes: { label: 'Gerichte bearbeiten', hint: 'Titel, Bild, Creator und Link ändern. Eigene Gerichte immer.' },
      moveDishes: { label: 'Gerichte verschieben', hint: 'Gerichte in andere Spalten bringen und als gekocht markieren.' },
      archiveDishes: { label: 'Gerichte archivieren', hint: 'Gerichte archivieren und aus dem Archiv zurückholen. Eigene Gerichte immer.' },
      editColumns: { label: 'Spalten bearbeiten', hint: 'Spalten hinzufügen, umbenennen, umsortieren und löschen.' },
      shareInvite: { label: 'Einladungslink teilen', hint: 'Den Link sehen, kopieren und weitergeben.' },
      commentAndVote: { label: 'Kommentieren und abstimmen', hint: 'Im Verlauf schreiben und Daumen geben. Lesen geht immer.' },
      editBoard: { label: 'Name und Emoji', hint: 'Das Board umbenennen und sein Emoji ändern.' },
    },
    handOver: 'Besitz übertragen',
    handOverConfirm: (name: string) => `Besitz an ${name} übertragen?`,
    handOverBody: (name: string) => `${name} kann dann Mitglieder entfernen, den Link zurücksetzen und das Board löschen. Du bleibst Mitglied und darfst weiter alles, bis ${name} das ändert.`,
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
    // Deleting archives it (CONTEXT.md: Archived Board).
    deleteBody: (board: string) => `${board} verschwindet dann für alle. 30 Tage lang findest du es noch unter „Archiv“ in der Liste deiner Boards und kannst es dort wiederherstellen.`,
    deleteTypeName: (name: string) => `Tipp zum Bestätigen „${name}“ ein`,
    deleteForGood: 'Endgültig löschen',
    // The Board's Archive (CONTEXT.md: Archived Dish): any Member restores
    // a Dish, the Owner deletes one for good.
    archive: 'Archiv',
    archiveHint: 'Archivierte Gerichte bleiben 30 Tage hier. Danach sind sie endgültig weg.',
    archiveEmpty: 'Gerade ist nichts archiviert.',
    archivedBy: (name: string, date: Date) => `Von ${name} am ${addedDate(date)} archiviert`,
    // Whoever archived it is unknown: their account is gone, or it was
    // archived before malkochen kept who did.
    archivedOn: (date: Date) => `Am ${addedDate(date)} archiviert`,
    daysLeft: (days: number) => `Noch ${number(days)} ${plural(days, { one: 'Tag', other: 'Tage' })}`,
    restore: 'Wiederherstellen',
    restoreDish: (title: string) => `„${title}“ wiederherstellen`,
    restored: (title: string) => `„${title}“ ist wieder auf dem Board.`,
    purgeDish: (title: string) => `„${title}“ endgültig löschen`,
    purgeConfirm: (title: string) => `„${title}“ endgültig löschen?`,
    purgeBody: 'Das Gericht verschwindet dann mit seinem Bild und allem, was ihr dazu eingetragen habt. Das lässt sich nicht rückgängig machen.',
    purged: (title: string) => `„${title}“ ist endgültig gelöscht.`,
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    // A change refused as the Owner just switched the Permission off.
    notAllowed: 'Das darfst du auf diesem Board nicht mehr. Das legt die Besitzer:in fest.',
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
  // Your Username (CONTEXT.md): picked before your first Board, confirmed
  // once if you were here before Usernames, changed in your settings. The
  // server answers with `problem`, `taken` and `tooMany` as they are
  // (server/api/me/username.put.ts).
  username: {
    label: 'Name',
    pickHeadline: 'Wie sollen wir dich nennen?',
    pickBody: 'Such dir einen Namen aus. So sehen dich die anderen auf euren Boards.',
    pick: 'Los geht’s',
    confirmHeadline: 'Passt dein Name?',
    confirmBody: 'So sehen dich die anderen auf euren Boards. Du kannst ihn behalten oder ändern.',
    keep: 'Passt so',
    hint: '2 bis 24 Zeichen: Buchstaben, Ziffern und _ . -',
    later: 'Du kannst ihn später in den Einstellungen ändern.',
    save: 'Speichern',
    saving: 'Speichert …',
    saved: 'Gespeichert.',
    problem: {
      short: 'Mindestens 2 Zeichen.',
      long: 'Höchstens 24 Zeichen.',
      characters: 'Nur Buchstaben, Ziffern und _ . - sind erlaubt.',
    },
    taken: 'Den Namen gibt es schon. Probier einen anderen.',
    tooMany: 'Das waren viele Namen für einen Tag. Morgen kannst du ihn wieder ändern.',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    // What stands for a Member who hasn't picked theirs yet (a new user who
    // followed an Invite Link is a Member before they have).
    none: 'Neu dabei',
  },
  // Your own settings (PRD stories 73–75), not a Board's.
  userSettings: {
    title: 'Einstellungen',
    // Your Profile Picture at the top right of the Board: opens the user menu.
    menu: 'Dein Konto',
    close: 'Einstellungen schließen',
    account: 'Konto',
    language: 'Sprache',
    // Each language named in itself, the same in every language.
    languages: {
      auto: 'Automatisch',
      de: 'Deutsch',
      en: 'English',
      it: 'Italiano',
    } satisfies Record<LanguageChoice, string>,
    languageFailed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
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
  // Push notifications (#219): turned on per device in your settings, sent
  // when someone else adds a Dish to one of your Boards.
  push: {
    heading: 'Benachrichtigungen',
    toggle: 'Push-Benachrichtigungen',
    hint: 'Auf diesem Gerät, wenn jemand ein Gericht zu einem deiner Boards hinzufügt.',
    blocked: 'Dein Browser blockiert Benachrichtigungen von malkochen. Erlaube sie in den Website-Einstellungen, dann kannst du sie hier einschalten.',
    unsupported: 'Dieser Browser kann keine Push-Benachrichtigungen empfangen.',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    // The notification, one per Board (#325). Its title: who added the
    // Dishes since you last opened it, the latest adder first, and the
    // Dish's title if it's just one, else how many.
    added: (names: string[], count: number, dish: string) => `${someNames(names)} ${plural(names.length, { one: 'hat', other: 'haben' })} ${count === 1 ? dish : dishCount(count)} hinzugefügt`,
    // Its body: the Board (its emoji and name), then the titles of several
    // Dishes, as many as fit, and how many more. About one Dish, it's only
    // the Board.
    body: (board: string, titles: string[], more: number) => `${board}: ${titles.join(', ')}${more === 0 ? '' : ` und ${number(more)} ${plural(more, { one: 'weiteres', other: 'weitere' })}`}`,
    // Comments and Votes by others count too (#351). About one Comment:
    // „Ada hat Linsen-Dal kommentiert" over the Board and the Comment's start.
    commented: (name: string, dish: string) => `${name} hat ${dish} kommentiert`,
    comment: (board: string, text: string) => `${board}: ${text}`,
    // About one Vote, over the Board alone.
    voted,
    // About several things on one Dish: „Ada und Linus zu Linsen-Dal" over
    // „🍪 Kochclub: 1 Kommentar, 1 Daumen".
    onDish: (names: string[], dish: string) => `${someNames(names)} zu ${dish}`,
    counts: (board: string, comments: number, votes: number) => `${board}: ${talkCounts(comments, votes).join(', ')}`,
    // About several Dishes with no new ones: the Comments' title, else the
    // Votes', over the Dishes they're on; the rest follows with `also`.
    wrote: (names: string[], comments: number) => `${someNames(names)} ${plural(names.length, { one: 'hat', other: 'haben' })} ${talkCounts(comments, 0)[0]} geschrieben`,
    gave: (names: string[], votes: number) => `${someNames(names)} ${plural(names.length, { one: 'hat', other: 'haben' })} ${talkCounts(0, votes)[0]} gegeben`,
    about: (board: string, titles: string[], more: number) => `${board}: zu ${more === 0 ? nameList(titles) : `${titles.join(', ')} und ${number(more)} weiteren`}`,
    // What else is new, after a body: with new Dishes, `body` and then all
    // Comments and Votes; else `about`, then the Votes.
    also: (before: string, comments: number, votes: number) => `${before}. Dazu ${talkCounts(comments, votes).join(' und ')}.`,
  },
  // The Email Digest (#220): switched on in your settings, for all your
  // Boards; one email in the evening listing the Dishes others added since
  // the last one (server/email/index.ts).
  emailDigest: {
    toggle: 'Tägliche E-Mail',
    hint: 'Abends an deine E-Mail-Adresse, wenn andere neue Gerichte zu deinen Boards hinzugefügt haben. Für alle deine Geräte.',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
    // The email (#325). `board`: the emoji and name of the one Board it's
    // about; null when it's about several.
    subject: (count: number, board: string | null) => `${newDishCount(count)} ${board ? `in ${board}` : 'auf deinen Boards'}`,
    // With no new Dishes, the Comments and Votes instead (#351).
    talkSubject: (comments: number, votes: number, board: string | null) => `${talkCounts(comments, votes).join(' und ')} ${board ? `in ${board}` : 'auf deinen Boards'}`,
    // The inbox's preview line: who added them, in the order the email
    // lists them.
    preheader: (names: string[]) => `Von ${someNames(names)}. Schau mal rein!`,
    // `name`: the recipient's Username, null before they picked one.
    greeting: (name: string | null) => name ? `Hallo ${name}!` : 'Hallo!',
    intro: 'Das ist seit gestern auf deinen Boards dazugekommen:',
    addedBy: (name: string) => `von ${name}`,
    openBoard: 'Board öffnen',
    // A Board's Comments and Votes since the last one, after its new Dishes
    // (#351). `dish` may be a link, the Comment's start already cut.
    history: 'Im Verlauf',
    comment: (name: string, dish: string, text: string) => `${name} zu ${dish}: „${text}“`,
    voted,
    why: 'Einmal am Abend, nur wenn’s was Neues gibt: So hast du’s in malkochen eingestellt.',
    // Then the link to your settings, where you switch it off.
    noMore: 'Keine Lust mehr?',
    turnOff: 'Hier ausschalten',
  },
  // The email with the sign-in code (#345, server/email/index.ts): the code
  // to type where sign-in started, and a link that signs in where it opens.
  signInEmail: {
    subject: (code: string) => `${code} ist dein Code für malkochen`,
    headline: 'Dein Code zum Anmelden',
    intro: 'Gib diesen Code in malkochen ein, da wo du die Anmeldung gestartet hast:',
    expires: (minutes: number) => `Er gilt ${minutes} Minuten und nur einmal.`,
    linkIntro: 'Oder melde dich direkt auf diesem Gerät an:',
    link: 'Anmelden',
    notYou: 'Du wolltest dich nicht anmelden? Dann ignorier diese E-Mail einfach.',
  },
  // "Konto löschen" at the end of your settings (#346, CONTEXT.md: Deleted
  // Account): what happens, said before, then the Username typed to confirm.
  deleteAccount: {
    heading: 'Konto löschen',
    hint: 'Du kannst dein Konto jederzeit löschen. Das lässt sich nicht rückgängig machen.',
    open: 'Konto löschen',
    title: 'Konto löschen?',
    what: [
      'Was du auf Boards mit anderen hinzugefügt hast, bleibt: Gerichte, wann sie gekocht wurden, Kommentare und Daumen. Dort steht dann „Gelöschtes Konto“ statt deines Namens.',
      'Boards, die dir gehören und auf denen noch andere sind, übernimmt, wer am längsten dabei ist.',
      'Boards, auf denen nur du bist, werden gelöscht, mit allen Gerichten und Bildern.',
      'Dein Profilbild, deine Benachrichtigungen und alle deine Anmeldungen sind sofort weg.',
      'Du bekommst eine Bestätigung per E-Mail. Später kannst du dich wieder anmelden, mit einem neuen Konto.',
    ],
    typeToConfirm: (name: string) => `Tipp zum Bestätigen „${name}“ ein`,
    confirm: 'Endgültig löschen',
    deleting: 'Wird gelöscht …',
    cancel: 'Abbrechen',
    wrongUsername: 'Das ist nicht dein Name.',
    failed: 'Das hat nicht geklappt. Versuch es gleich noch mal.',
  },
  // The Admin Page (#348): the Operator's figures, linked at the end of
  // their settings. Plain tables; only the Operator ever sees them.
  admin: {
    link: 'Admin',
    linkHint: 'Zahlen dazu, wie malkochen genutzt wird, und wie nah es an den kostenlosen Grenzen ist.',
    title: 'Admin',
    back: 'Zurück zum Board',
    perDay: 'Pro Tag',
    perWeek: 'Pro Woche',
    day: 'Tag',
    weekOf: 'Woche ab',
    // A period's first day, from YYYY-MM-DD.
    date: (start: string) => addedDate(new Date(`${start}T12:00:00Z`)),
    count: (n: number) => number(n),
    dishes: 'Neue Gerichte nach Quelle',
    sources: {
      'tiktok': 'TikTok',
      'instagram-reel': 'Insta Reel',
      'instagram-post': 'Insta Post',
      'youtube-short': 'YouTube',
      'pinterest-pin': 'Pinterest',
      'blog': 'Blog',
      'other': 'Andere',
      'none': 'Ohne Link',
    } satisfies Record<SourceColumn, string>,
    total: 'Gesamt',
    activity: 'Was auf den Boards passiert',
    moves: 'Verschoben',
    cookings: 'Gekocht',
    comments: 'Kommentare',
    votes: 'Daumen',
    archived: 'Archiviert',
    active: 'Aktiv',
    activeHint: 'Wer auf einem Board etwas getan hat, und auf welchen Boards.',
    people: 'Leute',
    boards: 'Boards',
    today: 'Heute',
    week: 'Letzte 7 Tage',
    month: 'Letzte 30 Tage',
    signUps: 'Neu angemeldet',
    signUpsHint: 'Gelöschte Konten zählen nicht mehr mit.',
    google: 'Google',
    email: 'E-Mail',
    limits: 'Kostenlose Grenzen',
    limitsHint: 'Was malkochen selbst zählen kann. Den Rest zeigen die Dashboards der Anbieter.',
    figure: 'Was',
    used: 'Genutzt',
    free: 'Kostenlos',
    share: 'Anteil',
    database: 'Datenbank (Neon)',
    blob: 'Bilder (Vercel Blob)',
    emailsMonth: 'E-Mails diesen Monat (Resend)',
    emailsToday: 'E-Mails heute (Resend)',
    functionCalls: 'Funktionsaufrufe diesen Monat, aus den Abfragen offener Boards geschätzt (Vercel)',
    megabytes: (bytes: number) => `${number(Math.round(bytes / 1_000_000))} MB`,
    percent: (share: number) => `${number(Math.round(share * 100))} %`,
    dashboards: 'Dashboards',
  },
  // The email confirming it (#346), in the language of whoever deleted it.
  accountDeletedEmail: {
    subject: 'Dein malkochen-Konto ist gelöscht',
    headline: 'Dein Konto ist gelöscht',
    greeting: (name: string) => `Hallo ${name}, wie gewünscht haben wir dein Konto bei malkochen gelöscht.`,
    kept: 'Was du auf Boards mit anderen hinzugefügt hast, steht dort jetzt als „Gelöschtes Konto“. Boards, auf denen nur du warst, sind gelöscht.',
    again: 'Wenn du wiederkommen willst: Melde dich einfach neu an.',
    notYou: 'Das warst nicht du? Dann antworte auf diese E-Mail.',
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
      close: 'Schließt, was offen ist: Dialog, Gericht, Auswahl oder Suche',
      boardSettings: 'Board-Einstellungen',
      switchBoard: 'Zum 1. bis 9. Board wechseln',
      help: 'Diese Tastenkürzel zeigen',
    },
    // Display only: selecting with a click is the Board's, not a shortcut.
    ctrl: 'Strg',
    click: 'Klick',
    selectSeveral: 'Mehrere auswählen',
  },
  // The Tour (CONTEXT.md, #296): Topfbert's walk through the Board, step by
  // step (app/tour/tour.ts). "Rundgang" in the UI.
  tour: {
    label: 'Rundgang',
    hello: {
      title: 'Hallo, ich bin Topfbert!',
      text: 'Ich zeig dir kurz, wie malkochen funktioniert. Dauert nicht lange.',
    },
    addButton: {
      title: 'Dein erstes Gericht',
      text: 'Tipp aufs Plus.',
    },
    addDishLink: {
      title: 'Hast du einen Link?',
      text: 'Füg hier einen Link von TikTok, Instagram und Co. ein. Keinen zur Hand? Dann „Ohne Link hinzufügen“.',
    },
    newCard: {
      title: 'Da ist es!',
      text: 'Alle auf diesem Board sehen dein Gericht sofort.',
    },
    columns: {
      title: 'Deine Spalten',
      // The Board's own Column names: the first two that aren't the Gekocht
      // Column (`next` is null when there is only one), then that one.
      text: (first: string, next: string | null, gekocht: string | null, phone: boolean) => [
        next ? `Gerichte wandern von „${first}“ über „${next}“` : `Neue Gerichte landen in „${first}“`,
        gekocht ? `${next ? ' nach' : ', und was ihr gekocht habt, kommt nach'} „${gekocht}“.` : '.',
        phone ? ' Wisch zur Seite oder tipp oben auf eine Spalte, um sie zu sehen.' : '',
      ].join(''),
    },
    // Step 5: the Tour's Dish to the next Column, by its name; by dragging
    // (onto its tab on phones) or through the card's ⋯.
    moveDish: {
      title: (column: string) => `Zieh es auf „${column}“`,
      text: (phone: boolean): string => phone
        ? 'Halt die Karte gedrückt und zieh sie oben auf die Spalte. Oder über ⋯ → „Verschieben nach…“.'
        : 'Zieh die Karte rüber in die Spalte. Oder über ⋯ → „Verschieben nach…“.',
      menu: 'Tipp auf „Verschieben nach…“.',
      pick: (column: string) => `Und jetzt auf „${column}“.`,
    },
    // Step 6: archiving it again, or "Behalten".
    deleteDish: {
      title: 'Und wieder weg',
      text: 'Über ⋯ archivierst du ein Gericht. Keine Sorge: Mit „Rückgängig“ holst du es gleich wieder zurück.',
      menu: 'Tipp auf „Archivieren“. Mit „Rückgängig“ ist es gleich wieder da.',
    },
    keep: 'Behalten',
    boardSwitcher: {
      title: 'Kocht zusammen',
      text: 'Hier lädst du andere zu deinem Board ein, wechselst zwischen deinen Boards oder fängst ein neues an.',
    },
    // The last step, on phones only: installed, the share tip; else how to
    // install malkochen.
    shareTip: {
      title: 'Noch ein Trick',
      text: 'Teil einen Link direkt aus TikTok oder Instagram: Teilen → malkochen. Schon landet das Gericht hier.',
    },
    // Installing, what it unlocks.
    sharing: 'Installiert kannst du Links direkt aus TikTok und Instagram mit malkochen teilen.',
    install: {
      title: 'Hol dir malkochen aufs Handy',
    },
    installHow: {
      title: 'Hol dir malkochen aufs Handy',
      // Where the browser's menu has it, by browser family.
      menu: {
        chrome: 'Tipp oben rechts auf ⋮ und dann auf „Zum Startbildschirm hinzufügen“.',
        samsung: 'Tipp unten rechts auf ≡, dann auf „Seite hinzufügen zu“ und „Startbildschirm“.',
        edge: 'Tipp oben rechts auf … und dann auf „Zum Telefon hinzufügen“.',
        firefox: 'Tipp oben rechts auf ⋮ und dann auf „Zum Startbildschirm hinzufügen“.',
        other: 'Such im Menü deines Browsers nach „Zum Startbildschirm hinzufügen“.',
      },
      // Firefox and any other browser: only Chrome's install shares.
      chromeOnly: 'Teilen aus TikTok klappt aber nur, wenn du malkochen aus Chrome installierst.',
    },
    installButton: 'Installieren',
    next: 'Weiter',
    back: 'Zurück',
    skip: 'Überspringen',
    finish: 'Fertig',
    withoutDish: 'Ohne Gericht weiter',
    // The Toast once it has ended, finished or skipped.
    ended: 'Den Rundgang kannst du jederzeit in deinen Einstellungen wieder starten.',
    // Your Settings.
    start: 'Rundgang starten',
    startHint: 'Topfbert zeigt dir das Board noch einmal.',
  },
  // What the server writes into a new Board (#328), in its creator's
  // language: the Board a first sign-in gets, and every new Board's Columns
  // with their Column Subtitles. Data once written, so a Board looks the same
  // to every Member, and Members can rename it all. The Gekocht Column's
  // fixed Column Subtitle isn't among them: board.gekochtSubtitle.
  boardStart: {
    starter: 'Meine Küche',
    ideas: { name: 'Ideen', subtitle: 'Worauf hast du Lust?' },
    thisWeek: { name: 'Diese Woche', subtitle: 'Das steht an.' },
    gekocht: 'Gekocht',
  },
}

export type Strings = typeof de
