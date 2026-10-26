import type { LegalText } from './text'

// The Datenschutzerklärung of malkochen (#391), as of 1.1.0 (review 4, #409). The German text
// is the binding one; English and Italian are translations for information.
// Each section is checked against the app (server/, shared/, app/), and each
// of the three keeps the same sections in the same order (tests/client/legal.test.ts).
// A translation for information; the German text above is the binding one.
const english: LegalText = {
  language: 'en',
  binding: false,
  title: 'Privacy policy',
  note: 'Translation for information only. The German text is the binding one.',
  sections: [
    {
      heading: '1. Controller',
      blocks: [
        'Dominik Christian Gilges\nAugust-Thyssen-Str. 16\n52249 Eschweiler, Germany\nE-mail: foodieflip.dev@gmail.com',
        'No data protection officer has been appointed, as there is no legal obligation to do so.',
      ],
    },
    {
      heading: '2. Overview',
      blocks: [
        'This privacy policy applies to the web application **malkochen** at **malkochen.christried.me**. It describes which personal data is processed when the application runs, for what purpose, on what legal basis, and which rights you have.',
        'malkochen is a private, non-commercial hobby project with which groups can collect dishes found online (e.g. from TikTok, Instagram, YouTube, Pinterest or food blogs) on shared boards, note what they want to cook and what they have cooked, and talk about them. There is no advertising, no tracking and no analytics tools. Only the data needed for sign-in, operation and the application\'s functions is processed.',
      ],
    },
    {
      heading: '3. Hosting (Vercel)',
      blocks: [
        'The application is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. When the application is called, Vercel processes technically necessary access data in server logs, including IP address, date and time of the request, the URL requested, the referrer, and browser and operating system information. These logs also contain technical error reports of the application, such as reports from your browser about violations of the content security policy; these include the page address called without search parameters, but no content.',
        'The application\'s daily clean-up and sending tasks run through Vercel Cron. The legal basis is Art. 6(1)(f) GDPR (legitimate interest in secure, stable and error-free operation). Vercel is bound by a data processing agreement (Art. 28 GDPR). For transfers to the USA see section 22.',
      ],
    },
    {
      heading: '4. Database (Neon)',
      blocks: [
        'Application data is stored in a PostgreSQL database of Neon Inc. (a US company, now part of Databricks Inc.). Database location: Frankfurt am Main (AWS region eu-central-1). Stored is everything described in sections 5 to 18. The legal basis is Art. 6(1)(b) and (f) GDPR. A data processing agreement is in place with Neon.',
      ],
    },
    {
      heading: '5. Sign-in with Google',
      blocks: [
        'You can sign in through the OAuth service of Google (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland; parent company: Google LLC, USA). You are then redirected to a Google page, to which Google\'s privacy terms apply. Only permissions for profile and e-mail information are requested. From your Google account we store: name, e-mail address and whether it is confirmed, the address (URL) of your Google profile picture, your Google user ID, and the OAuth tokens belonging to the sign-in. The application does not access your Google account beyond that.',
        'The legal basis is Art. 6(1)(b) GDPR (establishing and performing the user relationship).',
      ],
    },
    {
      heading: '6. Sign-in with a code by e-mail (Resend)',
      blocks: [
        'You can also sign in with your e-mail address. For this we send you a six-digit code, valid for ten minutes; you enter it where the sign-in began. The code is stored only in hashed form, works once, and after five wrong entries you need a new one. Asking for a new code invalidates the previous one. A link in the same e-mail signs you in as well.',
        'The application sends the e-mail through **Resend** (Resend Inc., USA) as a processor; the only recipient is your e-mail address. The language of the e-mail follows the language of your browser. To protect against misuse, code requests are limited per IP address and per e-mail address (section 10). The legal basis is Art. 6(1)(b) GDPR. A data processing agreement is in place with Resend.',
      ],
    },
    {
      heading: '7. Username, access and settings',
      blocks: [
        'After your first sign-in you choose a **Username**. It is the only name the application shows of you; the name from your Google account is stored but not shown to others. Only you see your e-mail address.',
        'People on the fixed access list can sign up, and, as long as the operator has **Open Sign-up** switched on, anyone with a confirmed Google account or an e-mail address. Anyone who already has an account still signs in when Open Sign-up is switched off again. The access list and the switch serve only to control access; the legal basis is Art. 6(1)(f) GDPR (legitimate interest in protection against unauthorised access).',
        'In your settings we store your **language** ("Automatic", or German, English, Italian). With "Automatic", malkochen follows your browser; the language your browser last reported is kept for e-mails and push notifications when you are not in the application. We also store up to which Tour version you have gone through the introduction, and the last version of "What\'s new" you have seen, so that your settings can show what is new. The legal basis is Art. 6(1)(b) GDPR.',
      ],
    },
    {
      heading: '8. Profile picture',
      blocks: [
        'Next to your Username the application shows a round profile picture – to you and to the members of the boards you belong to. It is either a picture you upload yourself in your settings, otherwise your Google profile picture, otherwise your initial.',
        {
          list: [
            '**Picture you upload:** it is cropped to a square on the server, re-encoded, and stripped of all metadata (e.g. EXIF information such as the place of recording or the camera model) before it is stored (section 14). You can remove it at any time.',
            '**Google profile picture:** it is loaded directly from Google\'s servers. Technically, Google then receives the IP address of the device on which the picture is shown, along with usual browser information – this also applies to other members of your boards who see your picture. If you do not want that, upload your own picture; your Google profile picture is then no longer shown.',
          ],
        },
        'The legal basis is Art. 6(1)(b) GDPR (members being recognisable in a shared application), or for loading from Google Art. 6(1)(f) GDPR.',
      ],
    },
    {
      heading: '9. Cookies and browser storage',
      blocks: [
        'The application sets only technically necessary cookies, or stores information in the browser, which are strictly necessary for the functions you explicitly ask for. No consent is needed for this (section 25(2) no. 2 TDDDG). In detail:',
        {
          list: [
            '**Session cookies** (Better Auth): keep you signed in and secure the sign-in process. They expire with the session or are deleted when you sign out.',
            '**Invite cookie** (`malkochen.invite`): after you open an invite link, remembers which board you want to join after signing in; at most 30 days, deleted once you have joined.',
            '**Dish link cookie** (`malkochen.dish-link`): after you tap "Copy to my board" on a dish link (section 11), remembers which dish you want to copy after signing in; at most one hour, and deleted as soon as the app opens after you sign in.',
            '**Design cookie** (`malkochen-theme`): remembers whether you chose light, dark or system design; 1 year.',
            '**Local storage**: whether the start screen has already been shown in this browser window (until the window is closed), and which dishes have already been celebrated as "classics" on this device, so the celebration appears only once.',
            '**Service worker**: keeps the basic parts of the application and an offline page on your device, so that malkochen behaves like an installed app; contents of your boards are not cached there. It also receives push notifications, if you turn them on (section 17).',
          ],
        },
        'You can delete cookies and stored website data at any time in your browser; you may then need to sign in again.',
      ],
    },
    {
      heading: '10. Session and security data',
      blocks: [
        'For each session we store your IP address and browser identifier (user agent) so that misuse can be detected. The application also counts, to protect against misuse and overload, how often certain actions are called – depending on the action, assigned to your account or to the calling IP address (e.g. sign-in attempts, requests for codes, or calls with invalid invite links). These counters apply only for a short time window and are overwritten afterwards. The legal basis is Art. 6(1)(f) GDPR (legitimate interest in the security of the application and protection against misuse).',
      ],
    },
    {
      heading: '11. Boards and content you create',
      blocks: [
        'Within the application you create and edit content: boards (name, emoji), their columns (name, subtitle, order) and dishes with title, source link, the name of the channel or blog that published the source, the source\'s caption (the text the platform shows publicly with the post, section 15), a picture with the chosen crop, and cooking history (when a dish was cooked). For dishes, cooking entries, comments and votes it is stored who created them and when.',
        'A **comment** is a message from a member about a dish, which can also be edited. A **vote** is a thumbs up or down for a cooked dish; each member has one per dish, and whoever takes it back deletes it.',
        'For your membership of a board we store when you joined, when you last opened the board and last saw it, which dishes you last opened (so that new dishes, comments and votes are marked for you), what rights you have on it, and whether you own it. This serves to mark what is new and to land you on the board you used last when you start the application again.',
        'All content of a board, and the Username and profile picture of its members, are visible to **all members of that board**; members can edit, comment and vote on it, depending on their rights. Anyone who receives an invite link to a board can join it; therefore share invite links only with people who should see your content. The owner of a board can reset the link at any time.',
        '**Dish links:** Every member can share a link to a dish. Anyone who has this link sees, even without signing in, the picture, title, the name of the channel or blog, and the source link of this one dish, but nothing of the board, its members, comments, votes or cooking history. The link contains a random, unguessable string and works as long as the dish is not archived or deleted. If it is shared in a messenger, the messenger may fetch a preview with title and picture. Therefore share dish links only with people who should see the dish.',
        '**Copies:** A member can copy a dish to another board they may add dishes to, also from a dish link. The copy takes over title, picture (as a picture file of its own), source link, channel or blog, and caption, but no comments, votes or cooking history. It counts as added by the person who copied it and is visible to the members of the target board.',
        'The legal basis is Art. 6(1)(b) GDPR.',
      ],
    },
    {
      heading: '12. Deleting your account',
      blocks: [
        'You can delete your user account yourself in your settings. In doing so:',
        {
          list: [
            'Boards you own that have other members pass to the member who has been on them longest.',
            'Boards on which only you are a member are deleted for good, including those in the archive.',
            'Your memberships, sessions, sign-in accounts, push subscriptions, the e-mail summary and your user data are deleted.',
            'What you contributed to other people\'s boards (dishes, cooking entries, comments and votes) stays for the other members, but is no longer assigned to any person and appears as "Deleted account".',
            'Pictures that only you used are removed. A confirmation goes to your e-mail address.',
            'In the event log (section 19) the entries remain without your identifier.',
          ],
        },
        'The legal basis is Art. 6(1)(b) GDPR (ending the user relationship).',
      ],
    },
    {
      heading: '13. Archive and retention of deleted content',
      blocks: [
        'When a member archives a dish, or the owner deletes a board, it remains restorable for 30 days. After that a daily clean-up task deletes it for good, together with the dishes, cooking entries and comments in it. Deleted comments and cooking entries also remain restorable for 30 days. Votes that someone takes back are deleted at once.',
      ],
    },
    {
      heading: '14. Pictures (Vercel Blob)',
      blocks: [
        'Pictures of dishes – preview pictures taken from the source as well as photos you upload yourself – and profile pictures you upload are stored by the application in the service **Vercel Blob** of Vercel Inc. (section 3). Uploaded photos are reduced in size, re-encoded and stripped of all metadata (e.g. EXIF information such as GPS position) before they are stored. The pictures are stored under randomly generated, unguessable addresses and loaded from there; anyone who knows such an address can view the picture without signing in. Pictures that are no longer assigned to any dish or profile are deleted by a daily clean-up. The legal basis is Art. 6(1)(b) GDPR.',
      ],
    },
    {
      heading: '15. Fetching links (TikTok, Instagram, YouTube, Pinterest, food blogs)',
      blocks: [
        'When you paste a link while adding a dish, the application\'s server fetches the linked page or the public interface of the platform (e.g. the oEmbed interfaces of TikTok, YouTube and Pinterest) to find a title suggestion, the name of the publishing channel or blog (or of the person who pinned it), a preview picture and the post\'s caption, and whether its video can be played in malkochen. For Instagram the server reads the public embed page of the post. This fetch happens on the server; your IP address is not passed on to the platform, only the link itself is sent.',
        'For dishes added before this function existed, the server fetches the source once more in the same way, to fill in the caption and whether the video can be played.',
        'Before you save the dish, the application shows the preview picture found, for checking. This picture is loaded directly from the servers of the respective platform or website; technically, its operator then receives your IP address and usual browser information. After saving, a copy of the picture is used (section 14), so no connection to the platform is made when the dish is shown. Only when you click the source link of a dish do you open the platform\'s page; from then on its privacy terms apply.',
        'The legal basis is Art. 6(1)(b) GDPR, since taking over dishes from links is a core function of the application.',
      ],
    },
    {
      heading: '16. Videos (played on click)',
      blocks: [
        'The application plays a video of a dish (TikTok, YouTube Shorts, Instagram reel) only when you tap "Play video". Only then does the platform\'s player load into an embedded frame: TikTok (tiktok.com), YouTube in privacy-enhanced mode (youtube-nocookie.com), or Instagram (instagram.com). Nothing is loaded from these platforms before that. From the moment it plays, the platform receives your IP address and usual browser information, and its privacy terms apply; the platform may set its own cookies. The application itself sets none for this. The legal basis is Art. 6(1)(a) GDPR (your click as consent to this loading).',
      ],
    },
    {
      heading: '17. Push notifications',
      blocks: [
        'Optionally, you can turn on push notifications for a device in your settings (off by default; up to ten devices per account). You then receive a notification when other members add dishes to one of your boards, or comment or vote there. For this we store the push subscription your browser creates: the receiving address of your device at your browser\'s push service, and the associated keys.',
        'The content of the notification includes the name of the board, the Usernames of those involved, the titles of the dishes, and for comments the start of the comment text; for votes only who voted which way is shown.',
        'The notifications are delivered through the push service of the browser or operating system maker – for Chrome and Android this is Firebase Cloud Messaging of Google LLC (USA), for Firefox the service of Mozilla Corporation (USA), for Edge the Windows Push Notification Service of Microsoft Corporation (USA). The content is transmitted end-to-end encrypted and cannot be read by the push service; the service receives only the technical information needed for delivery.',
        'The legal basis is your consent (Art. 6(1)(a) GDPR and section 25(1) TDDDG). You can withdraw it at any time by turning notifications off in the application\'s settings or your browser; the subscription is then deleted.',
      ],
    },
    {
      heading: '18. E-mail summary',
      blocks: [
        'If you turn on the **e-mail summary** in your settings, we send you one e-mail a day in the evening, covering all your boards together. It lists the dishes others have added to your boards since the last summary, and the comments and votes you gave there. If there is nothing new, no e-mail is sent. The application sends the e-mail through Resend (section 6). For this we store up to when the summaries have already covered things, so that no dish appears twice. You can turn the summary off at any time in your settings; the entry is then deleted. The legal basis is your consent (Art. 6(1)(a) GDPR).',
        '**Suggestions to turn them on:** On a board, the application may suggest turning on push notifications or the e-mail summary, at the earliest one day after you signed up and at most every 30 days per suggestion. For this we store with your account when each suggestion last appeared. Nothing is turned on until you tap "Turn on". The legal basis is Art. 6(1)(f) GDPR (legitimate interest in pointing out optional functions without disturbing you repeatedly).',
      ],
    },
    {
      heading: '19. Event log and the operator',
      blocks: [
        'The application keeps an **event log**: one entry per action on boards and around your account. This includes, for example, that a board was created, a dish added, moved, copied or archived, a comment written, a vote given or a dish link opened; also your sign-up and every sign-in with its method, changes of Username, profile picture and language, turning push notifications and the e-mail summary on and off, suggestions to turn them on that were shown and answered, every push notification sent (per device, with the delivery result) and every e-mail summary sent, and the deletion of an account. An entry contains only the time, the kind of action, identifiers (of the board, the dish, the person involved, the comment) and a few non-content details, such as the kind of source of a dish, the sign-in method, or whether a dish link was opened by someone signed in. It does not itself contain titles, comment texts, names, e-mail addresses, IP addresses or links. Entries are not deleted; we remove your identifier when you delete your account.',
        'The **operator**, who runs the application, can open every board and do everything its owner can there, without appearing as a member; what they add there shows their Username. On the administration page they see the event log with the names of the people, boards and dishes and the comment texts as they are **now**: what was deleted shows as deleted, a deleted account as "Deleted account", and earlier versions are not kept. Besides that they see counts such as sign-ups per day and sign-up method, the number of active people and of events per kind, and storage, e-mail and call volumes against the free allowances of the services. This serves to help people who ask and to detect misuse, all the more as anyone can sign up without an invitation while Open Sign-up is on (section 7). The legal basis is Art. 6(1)(f) GDPR (legitimate interest in secure operation, in helping with problems and in detecting misuse).',
      ],
    },
    {
      heading: '20. Fonts, symbols and tracking',
      blocks: [
        'The fonts (Petrona, Figtree) are delivered self-hosted; **no** connection to Google Fonts is made. Symbols, illustrations and animations are built into the application and are not loaded from external services. No analytics, tracking or advertising services are used, and no profiling takes place. A cookie banner is therefore not required.',
      ],
    },
    {
      heading: '21. Recipients',
      blocks: [
        'Your data is not sold and not passed on for advertising. Recipients are only the service providers named in this policy, to the extent described, the members of the boards you belong to (section 11), people a member sends a dish link to, to the extent of section 11, and the operator to the extent of section 19. Data is passed to authorities only where there is a legal obligation to do so.',
      ],
    },
    {
      heading: '22. Transfers to third countries',
      blocks: [
        'Vercel, Neon, Google, Resend and – when push notifications are on – Mozilla or Microsoft are, or belong to, companies based in the USA. Where personal data is transferred to the USA, this rests on the EU Commission\'s adequacy decision for the EU-US Data Privacy Framework (Art. 45 GDPR), where the provider in question is certified under it, and otherwise on the EU Commission\'s standard contractual clauses (Art. 46(2)(c) GDPR). When preview pictures are loaded directly from platforms and websites (section 15) and when videos are played (section 16), their servers may also be located outside the EU.',
      ],
    },
    {
      heading: '23. Storage periods',
      blocks: [
        {
          list: [
            'Account, boards and content: as long as your account exists or until you delete them; deleted dishes, cooking entries and comments 30 days beyond that (sections 12 and 13).',
            'Event log: indefinitely, without content; without your identifier once you delete your account (section 19).',
            'Session data: until the session expires or you sign out.',
            'Misuse counters: only for short time windows (section 10).',
            'Dish link cookie: at most one hour (section 9).',
            'Times of the suggestions to turn on: as long as your account exists (section 18).',
            'Push subscriptions: until you turn notifications off or the push service reports that they are no longer valid.',
            'Server logs of the host: only for as long as needed for error analysis and security, and then deleted automatically.',
          ],
        },
      ],
    },
    {
      heading: '24. Obligation to provide data and automated decisions',
      blocks: [
        'You are neither legally nor contractually obliged to provide data. Without the details needed for sign-in (sections 5 and 6), however, you cannot use the application. No automated decision-making, including profiling within the meaning of Art. 22 GDPR, takes place; the check against the access list is a pure access control.',
      ],
    },
    {
      heading: '25. Your rights',
      blocks: [
        'You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20 GDPR). You can delete your account yourself in your settings (section 12). You can withdraw a consent given at any time with effect for the future (Art. 7(3) GDPR); the lawfulness of processing carried out until then remains unaffected. To exercise the other rights, a message to the address in section 1 is sufficient.',
        '**Right to object (Art. 21 GDPR):** where processing is based on Art. 6(1)(f) GDPR, you may object to it at any time on grounds relating to your particular situation. We will then no longer process the data, unless we can demonstrate compelling legitimate grounds that override your interests, rights and freedoms, or the processing serves to assert, exercise or defend legal claims.',
      ],
    },
    {
      heading: '26. Right to lodge a complaint',
      blocks: [
        'You have the right to lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), in particular in the Member State of your habitual residence, your place of work or the place of the alleged infringement. The authority responsible for the controller is:',
        'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen\nKavalleriestraße 2–4\n40213 Düsseldorf, Germany',
      ],
    },
    {
      heading: '27. Data security',
      blocks: [
        'The connection to the application is encrypted throughout with TLS (HTTPS). We take appropriate technical and organisational measures to protect your data against loss, misuse and unauthorised access.',
      ],
    },
    {
      heading: '28. Changes and status',
      blocks: [
        'This privacy policy is adapted when the application or the legal situation changes; the version published here applies. Status: October 2026.',
      ],
    },
  ],
}

// Translation for information; the German text above is the binding one.
const italian: LegalText = {
  language: 'it',
  binding: false,
  title: 'Informativa sulla privacy',
  note: 'Traduzione a titolo informativo. Fa fede solo il testo tedesco.',
  sections: [
    {
      heading: '1. Titolare del trattamento',
      blocks: [
        'Dominik Christian Gilges\nAugust-Thyssen-Str. 16\n52249 Eschweiler, Germania\nE-mail: foodieflip.dev@gmail.com',
        'Non è stato nominato un responsabile della protezione dei dati, poiché non vi è alcun obbligo di legge in tal senso.',
      ],
    },
    {
      heading: '2. Panoramica',
      blocks: [
        'La presente informativa si applica all\'applicazione web **malkochen** all\'indirizzo **malkochen.christried.me**. Descrive quali dati personali vengono trattati durante il funzionamento, per quale scopo, su quale base giuridica e quali diritti avete.',
        'malkochen è un progetto privato e non commerciale, con cui gruppi possono raccogliere su board condivise i piatti trovati online (ad es. da TikTok, Instagram, YouTube, Pinterest o blog di cucina), annotare cosa vogliono cucinare e cosa hanno già cucinato, e parlarne. Non ci sono pubblicità, tracciamento né strumenti di analisi. Vengono trattati solo i dati necessari per l\'accesso, il funzionamento e le funzioni dell\'applicazione.',
      ],
    },
    {
      heading: '3. Hosting (Vercel)',
      blocks: [
        'L\'applicazione è ospitata da Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. Alla chiamata dell\'applicazione, Vercel tratta nei log del server i dati di accesso tecnicamente necessari, tra cui indirizzo IP, data e ora della richiesta, l\'URL richiesto, il referrer e le informazioni su browser e sistema operativo. In questi log finiscono anche le segnalazioni tecniche di errore dell\'applicazione, ad esempio le segnalazioni del vostro browser su violazioni della politica di sicurezza dei contenuti (Content Security Policy); esse contengono l\'indirizzo della pagina richiamata senza parametri di ricerca, ma nessun contenuto.',
        'Le attività quotidiane di pulizia e di invio dell\'applicazione passano per Vercel Cron. La base giuridica è l\'art. 6, par. 1, lett. f) GDPR (interesse legittimo a un funzionamento sicuro, stabile e privo di errori). Con Vercel è in essere un contratto di trattamento dei dati (art. 28 GDPR). Per il trasferimento negli USA vedi la sezione 22.',
      ],
    },
    {
      heading: '4. Database (Neon)',
      blocks: [
        'I dati dell\'applicazione sono conservati in un database PostgreSQL di Neon Inc. (società statunitense, oggi parte di Databricks Inc.). Ubicazione del database: Francoforte sul Meno (regione AWS eu-central-1). Vengono conservati tutti i dati descritti nelle sezioni da 5 a 18. La base giuridica è l\'art. 6, par. 1, lett. b) e f) GDPR. Con Neon è in essere un contratto di trattamento dei dati.',
      ],
    },
    {
      heading: '5. Accesso con Google',
      blocks: [
        'L\'accesso è possibile tramite il servizio OAuth di Google (Google Ireland Limited, Gordon House, Barrow Street, Dublino 4, Irlanda; società madre: Google LLC, USA). Venite quindi reindirizzati a una pagina di Google, alla quale si applicano le informative sulla privacy di Google. Vengono richiesti solo i permessi per le informazioni del profilo e dell\'e-mail. Dal vostro account Google memorizziamo: nome, indirizzo e-mail e il relativo stato di conferma, l\'indirizzo (URL) della vostra foto profilo Google, il vostro ID utente Google e i token OAuth legati all\'accesso. L\'applicazione non accede al vostro account Google oltre a ciò.',
        'La base giuridica è l\'art. 6, par. 1, lett. b) GDPR (instaurazione ed esecuzione del rapporto d\'uso).',
      ],
    },
    {
      heading: '6. Accesso con un codice via e-mail (Resend)',
      blocks: [
        'Potete accedere anche con il vostro indirizzo e-mail. A tal fine vi inviamo un codice di sei cifre, valido dieci minuti; lo inserite dove è iniziato l\'accesso. Il codice viene memorizzato solo in forma di hash, funziona una sola volta e dopo cinque inserimenti errati ne serve uno nuovo. Chiederne uno nuovo rende invalido quello precedente. Anche un link nella stessa e-mail vi permette di accedere.',
        'L\'applicazione invia l\'e-mail tramite **Resend** (Resend Inc., USA) come responsabile del trattamento; l\'unico destinatario è il vostro indirizzo e-mail. La lingua dell\'e-mail segue la lingua del vostro browser. Per proteggersi dagli abusi, le richieste di codice sono limitate per indirizzo IP e per indirizzo e-mail (sezione 10). La base giuridica è l\'art. 6, par. 1, lett. b) GDPR. Con Resend è in essere un contratto di trattamento dei dati.',
      ],
    },
    {
      heading: '7. Nome utente, accesso e impostazioni',
      blocks: [
        'Dopo il primo accesso scegliete un **nome utente**. È l\'unico nome che l\'applicazione mostra di voi; il nome del vostro account Google viene memorizzato ma non mostrato ad altri. Solo voi vedete il vostro indirizzo e-mail.',
        'Possono accedere le persone presenti nella lista di accesso fissa e, finché il gestore ha attivato la **registrazione aperta (Open Sign-up)**, ogni persona con un account Google confermato o un indirizzo e-mail. Chi ha già un account accede anche quando la registrazione aperta viene disattivata. La lista di accesso e l\'interruttore servono solo al controllo degli accessi; la base giuridica è l\'art. 6, par. 1, lett. f) GDPR (interesse legittimo alla protezione da accessi non autorizzati).',
        'Nelle vostre impostazioni memorizziamo la vostra **lingua** ("Automatica", oppure tedesco, inglese, italiano). Con "Automatica" malkochen segue il vostro browser; la lingua indicata dal browser per ultima viene conservata per le e-mail e le notifiche push quando non siete nell\'applicazione. Memorizziamo inoltre fino a quale versione del Tour avete seguito l\'introduzione e l\'ultima versione di "Novità" che avete visto, affinché le vostre impostazioni possano mostrare cosa è nuovo. La base giuridica è l\'art. 6, par. 1, lett. b) GDPR.',
      ],
    },
    {
      heading: '8. Immagine del profilo',
      blocks: [
        'Accanto al vostro nome utente l\'applicazione mostra un\'immagine del profilo rotonda – a voi e ai membri delle board di cui fate parte. È un\'immagine che caricate voi stessi nelle impostazioni, altrimenti la vostra foto profilo Google, altrimenti la vostra iniziale.',
        {
          list: [
            '**Immagine caricata da voi:** viene ritagliata quadrata sul server, ricodificata e privata di tutti i metadati (ad es. le informazioni EXIF come il luogo di ripresa o il modello della fotocamera) prima di essere memorizzata (sezione 14). Potete rimuoverla in qualsiasi momento.',
            '**Foto profilo Google:** viene caricata direttamente dai server di Google. Tecnicamente Google riceve quindi l\'indirizzo IP del dispositivo su cui viene mostrata l\'immagine, insieme alle usuali informazioni del browser – questo vale anche per gli altri membri delle vostre board che vedono la vostra immagine. Se non lo desiderate, caricate una vostra immagine; la foto profilo Google non viene più mostrata.',
          ],
        },
        'La base giuridica è l\'art. 6, par. 1, lett. b) GDPR (riconoscibilità dei membri in un\'applicazione condivisa), oppure per il caricamento da Google l\'art. 6, par. 1, lett. f) GDPR.',
      ],
    },
    {
      heading: '9. Cookie e memoria del browser',
      blocks: [
        'L\'applicazione imposta solo cookie tecnicamente necessari, o memorizza nel browser informazioni, strettamente indispensabili per le funzioni che chiedete esplicitamente. Per questo non è necessario il consenso (art. 25, par. 2, n. 2 TDDDG). Nel dettaglio:',
        {
          list: [
            '**Cookie di sessione** (Better Auth): vi mantengono connessi e proteggono il processo di accesso. Scadono con la sessione o vengono eliminati alla disconnessione.',
            '**Cookie di invito** (`malkochen.invite`): dopo l\'apertura di un link di invito, ricorda a quale board volete unirvi dopo l\'accesso; al massimo 30 giorni, eliminato dopo l\'adesione.',
            '**Cookie del link al piatto** (`malkochen.dish-link`): dopo che avete toccato "Copia nella mia bacheca" su un link a un piatto (sezione 11), ricorda quale piatto volete copiare dopo l\'accesso; al massimo un\'ora, ed eliminato non appena l\'app si apre dopo l\'accesso.',
            '**Cookie del tema** (`malkochen-theme`): ricorda se avete scelto il tema chiaro, scuro o quello di sistema; 1 anno.',
            '**Memoria locale**: se la schermata iniziale è già stata mostrata in questa finestra del browser (fino alla chiusura della finestra) e quali piatti su questo dispositivo sono già stati festeggiati come "classici", affinché la festa compaia una sola volta.',
            '**Service worker**: conserva sul vostro dispositivo le parti di base dell\'applicazione e una pagina offline, affinché malkochen si comporti come un\'app installata; i contenuti delle vostre board non vengono memorizzati lì nella cache. Riceve inoltre le notifiche push, se le attivate (sezione 17).',
          ],
        },
        'Potete eliminare in qualsiasi momento cookie e dati dei siti dal vostro browser; potrebbe poi essere necessario accedere di nuovo.',
      ],
    },
    {
      heading: '10. Dati di sessione e di sicurezza',
      blocks: [
        'Per ogni sessione memorizziamo il vostro indirizzo IP e l\'identificativo del browser (user agent), per poter riconoscere gli abusi. Per proteggersi da abusi e sovraccarichi, l\'applicazione conta inoltre quante volte vengono richieste determinate azioni – a seconda dell\'azione, associate al vostro account o all\'indirizzo IP che effettua la richiesta (ad es. tentativi di accesso, richieste di codici o chiamate con link di invito non validi). Questi contatori valgono solo per una breve finestra temporale e vengono poi sovrascritti. La base giuridica è l\'art. 6, par. 1, lett. f) GDPR (interesse legittimo alla sicurezza dell\'applicazione e alla protezione dagli abusi).',
      ],
    },
    {
      heading: '11. Board e contenuti creati da voi',
      blocks: [
        'All\'interno dell\'applicazione create e modificate contenuti: board (nome, emoji), le relative colonne (nome, sottotitolo, ordine) e i piatti con titolo, link alla fonte, il nome del canale o blog che ha pubblicato la fonte, la descrizione della fonte (il testo che la piattaforma mostra pubblicamente con il post, sezione 15), un\'immagine con il ritaglio scelto e la cronologia delle cotture (quando un piatto è stato cucinato). Per piatti, voci di cottura, commenti e voti si memorizza chi li ha creati e quando.',
        'Un **commento** è un messaggio di un membro su un piatto, che può anche essere modificato. Un **voto** è un pollice in su o in giù per un piatto cucinato; ogni membro ne ha uno per piatto, e chi lo ritira lo elimina.',
        'Per la vostra appartenenza a una board memorizziamo quando vi siete uniti, quando l\'avete aperta e vista per l\'ultima volta, quali piatti avete aperto per ultimi (affinché nuovi piatti, commenti e voti vi siano segnalati), quali diritti avete su di essa e se ne siete proprietari. Questo serve a segnalare le novità e a riportarvi, al nuovo avvio, sulla board usata per ultima.',
        'Tutti i contenuti di una board, nome utente e immagine del profilo dei suoi membri sono visibili a **tutti i membri di quella board**; i membri possono modificarli, commentarli e votarli, a seconda dei loro diritti. Chiunque riceva un link di invito a una board può aderirvi; condividete quindi i link di invito solo con persone che devono vedere i vostri contenuti. Il proprietario di una board può reimpostare il link in qualsiasi momento.',
        '**Link ai piatti:** ogni membro può condividere un link a un piatto. Chi ha questo link vede, anche senza accedere, l\'immagine, il titolo, il nome del canale o blog e il link alla fonte di quel solo piatto, ma nulla della board, dei suoi membri, dei commenti, dei voti o della cronologia delle cotture. Il link contiene una sequenza casuale e non indovinabile e funziona finché il piatto non è archiviato o eliminato. Se viene condiviso in un servizio di messaggistica, questo può recuperare un\'anteprima con titolo e immagine. Condividete quindi i link ai piatti solo con persone che devono vedere il piatto.',
        '**Copie:** un membro può copiare un piatto su un\'altra board a cui può aggiungere piatti, anche da un link al piatto. La copia riprende titolo, immagine (come file proprio), link alla fonte, canale o blog e descrizione, ma nessun commento, voto né cronologia delle cotture. Risulta aggiunta dalla persona che l\'ha copiata ed è visibile ai membri della board di destinazione.',
        'La base giuridica è l\'art. 6, par. 1, lett. b) GDPR.',
      ],
    },
    {
      heading: '12. Eliminazione del proprio account',
      blocks: [
        'Potete eliminare da soli il vostro account utente nelle impostazioni. In tal caso:',
        {
          list: [
            'Le board di cui siete proprietari e che hanno altri membri passano al membro presente da più tempo.',
            'Le board su cui ci siete solo voi vengono eliminate definitivamente, comprese quelle nell\'archivio.',
            'Le vostre appartenenze, sessioni, account di accesso, abbonamenti push, il riepilogo via e-mail e i vostri dati utente vengono eliminati.',
            'Ciò che avete contribuito a board di altri (piatti, voci di cottura, commenti e voti) resta per gli altri membri, ma non è più assegnato a nessuna persona e compare come "Account eliminato".',
            'Le immagini usate solo da voi vengono rimosse. Una conferma va al vostro indirizzo e-mail.',
            'Nel registro degli eventi (sezione 19) le voci restano senza il vostro identificativo.',
          ],
        },
        'La base giuridica è l\'art. 6, par. 1, lett. b) GDPR (conclusione del rapporto d\'uso).',
      ],
    },
    {
      heading: '13. Archivio e conservazione dei contenuti eliminati',
      blocks: [
        'Quando un membro archivia un piatto o il proprietario elimina una board, questi restano ripristinabili per 30 giorni. Dopodiché un\'attività quotidiana di pulizia li elimina definitivamente, insieme ai piatti, alle voci di cottura e ai commenti che contengono. Anche i commenti e le voci di cottura eliminati restano ripristinabili per 30 giorni. I voti che qualcuno ritira vengono eliminati subito.',
      ],
    },
    {
      heading: '14. Immagini (Vercel Blob)',
      blocks: [
        'Le immagini dei piatti – le anteprime prese dalla fonte così come le foto che caricate voi – e le immagini del profilo caricate da voi sono memorizzate dall\'applicazione nel servizio **Vercel Blob** di Vercel Inc. (sezione 3). Le foto caricate vengono ridotte, ricodificate e private di tutti i metadati (ad es. le informazioni EXIF come la posizione GPS) prima di essere memorizzate. Le immagini sono salvate sotto indirizzi generati casualmente e non indovinabili, e da lì vengono caricate; chiunque conosca un tale indirizzo può vedere l\'immagine anche senza accedere. Le immagini non più assegnate a nessun piatto o profilo vengono eliminate da una pulizia quotidiana. La base giuridica è l\'art. 6, par. 1, lett. b) GDPR.',
      ],
    },
    {
      heading: '15. Recupero dei link (TikTok, Instagram, YouTube, Pinterest, blog di cucina)',
      blocks: [
        'Quando incollate un link aggiungendo un piatto, il server dell\'applicazione recupera la pagina collegata o l\'interfaccia pubblica della piattaforma (ad es. le interfacce oEmbed di TikTok, YouTube e Pinterest) per ricavare un suggerimento di titolo, il nome del canale o blog che ha pubblicato (o della persona che ha pinnato), un\'anteprima dell\'immagine e la descrizione del post, e se il suo video si può riprodurre in malkochen. Per Instagram il server legge la pagina di incorporamento pubblica del post. Questo recupero avviene sul server; il vostro indirizzo IP non viene trasmesso alla piattaforma, viene inviato solo il link.',
        'Per i piatti aggiunti prima di questa funzione, il server recupera la fonte ancora una volta nello stesso modo, per completare la descrizione e la riproducibilità del video.',
        'Prima di salvare il piatto, l\'applicazione mostra l\'anteprima trovata, per il controllo. Questa immagine viene caricata direttamente dai server della rispettiva piattaforma o sito; tecnicamente il loro gestore riceve quindi il vostro indirizzo IP e le usuali informazioni del browser. Dopo il salvataggio viene usata una copia dell\'immagine (sezione 14), così che alla visualizzazione del piatto non si stabilisca più alcuna connessione con la piattaforma. Solo cliccando sul link alla fonte di un piatto aprite la pagina della piattaforma; da quel momento si applicano le sue informative sulla privacy.',
        'La base giuridica è l\'art. 6, par. 1, lett. b) GDPR, poiché riprendere piatti dai link è una funzione centrale dell\'applicazione.',
      ],
    },
    {
      heading: '16. Video (riproduzione al clic)',
      blocks: [
        'L\'applicazione riproduce il video di un piatto (TikTok, YouTube Shorts, reel Instagram) solo quando toccate "Riproduci video". Solo allora il player della piattaforma si carica in un riquadro incorporato: TikTok (tiktok.com), YouTube in modalità con privacy rafforzata (youtube-nocookie.com) oppure Instagram (instagram.com). Prima di allora non viene caricato nulla da queste piattaforme. Dal momento della riproduzione la piattaforma riceve il vostro indirizzo IP e le usuali informazioni del browser, e si applicano le sue informative sulla privacy; la piattaforma può impostare cookie propri. L\'applicazione stessa non ne imposta per questo. La base giuridica è l\'art. 6, par. 1, lett. a) GDPR (il vostro clic come consenso a questo caricamento).',
      ],
    },
    {
      heading: '17. Notifiche push',
      blocks: [
        'Facoltativamente potete attivare le notifiche push per un dispositivo nelle impostazioni (disattivate per impostazione predefinita; fino a dieci dispositivi per account). Riceverete poi una notifica quando altri membri aggiungono piatti a una delle vostre board, o vi commentano o votano. A tal fine memorizziamo l\'abbonamento push creato dal vostro browser: l\'indirizzo di ricezione del vostro dispositivo presso il servizio push del vostro browser, e le relative chiavi.',
        'Il contenuto della notifica comprende il nome della board, i nomi utente delle persone coinvolte, i titoli dei piatti e, per i commenti, l\'inizio del testo del commento; per i voti si indica solo chi ha votato e in che senso.',
        'Le notifiche vengono consegnate tramite il servizio push del produttore del browser o del sistema operativo – per Chrome e Android è Firebase Cloud Messaging di Google LLC (USA), per Firefox il servizio di Mozilla Corporation (USA), per Edge il Windows Push Notification Service di Microsoft Corporation (USA). Il contenuto viene trasmesso cifrato end-to-end e non può essere letto dal servizio push; il servizio riceve solo le informazioni tecniche necessarie alla consegna.',
        'La base giuridica è il vostro consenso (art. 6, par. 1, lett. a) GDPR e art. 25, par. 1 TDDDG). Potete revocarlo in qualsiasi momento disattivando le notifiche nelle impostazioni dell\'applicazione o del browser; l\'abbonamento viene poi eliminato.',
      ],
    },
    {
      heading: '18. Riepilogo via e-mail',
      blocks: [
        'Se attivate il **riepilogo via e-mail** nelle impostazioni, vi inviamo una e-mail al giorno la sera, per tutte le vostre board insieme. Elenca i piatti che altri hanno aggiunto alle vostre board dall\'ultimo riepilogo, e i commenti e i voti che avete dato lì. Se non c\'è nulla di nuovo, non viene inviata alcuna e-mail. L\'applicazione invia l\'e-mail tramite Resend (sezione 6). A tal fine memorizziamo fino a quando i riepiloghi hanno già coperto le novità, affinché nessun piatto compaia due volte. Potete disattivare il riepilogo in qualsiasi momento nelle impostazioni; la voce viene poi eliminata. La base giuridica è il vostro consenso (art. 6, par. 1, lett. a) GDPR).',
        '**Suggerimenti per attivarle:** su una board l\'applicazione può suggerirvi di attivare le notifiche push o il riepilogo via e-mail, non prima di un giorno dalla registrazione e al massimo ogni 30 giorni per ciascun suggerimento. A tal fine memorizziamo nel vostro account quando ciascun suggerimento è comparso per l\'ultima volta. Non viene attivato nulla finché non toccate "Attiva". La base giuridica è l\'art. 6, par. 1, lett. f) GDPR (interesse legittimo a segnalare funzioni facoltative senza disturbare ripetutamente).',
      ],
    },
    {
      heading: '19. Registro degli eventi e gestore',
      blocks: [
        'L\'applicazione tiene un **registro degli eventi**: una voce per ogni azione sulle board e intorno al vostro account. Ne fanno parte, ad esempio, che una board è stata creata, un piatto aggiunto, spostato, copiato o archiviato, un commento scritto, un voto espresso o un link a un piatto aperto; inoltre la vostra registrazione e ogni accesso con la sua modalità, le modifiche di nome utente, immagine del profilo e lingua, l\'attivazione e la disattivazione delle notifiche push e del riepilogo via e-mail, i suggerimenti per attivarle mostrati e le risposte date, ogni notifica push inviata (per dispositivo, con l\'esito della consegna) e ogni riepilogo via e-mail inviato, e l\'eliminazione di un account. Una voce contiene solo l\'orario, il tipo di azione, gli identificativi (della board, del piatto, della persona coinvolta, del commento) e alcuni dettagli non di contenuto, come il tipo di fonte di un piatto, la modalità di accesso o se un link a un piatto è stato aperto da una persona che aveva effettuato l\'accesso. Non contiene di per sé titoli, testi di commenti, nomi, indirizzi e-mail, indirizzi IP o link. Le voci non vengono eliminate; il vostro identificativo lo rimuoviamo quando eliminate il vostro account.',
        'Il **gestore**, che amministra l\'applicazione, può aprire ogni board e fare lì tutto ciò che può fare il suo proprietario, senza comparire come membro; ciò che vi aggiunge compare con il suo nome utente. Nella pagina di amministrazione vede il registro degli eventi con i nomi delle persone, delle board e dei piatti e i testi dei commenti così come sono **ora**: ciò che è stato eliminato compare come eliminato, un account eliminato come "Account eliminato", e le versioni precedenti non vengono conservate. Vede inoltre conteggi come le registrazioni per giorno e modalità, il numero di persone attive e di eventi per tipo, e i volumi di archiviazione, e-mail e chiamate rispetto ai piani gratuiti dei servizi. Questo serve ad aiutare le persone che lo chiedono e a riconoscere gli abusi, tanto più che con la registrazione aperta attiva (sezione 7) ci si può registrare anche senza invito. La base giuridica è l\'art. 6, par. 1, lett. f) GDPR (interesse legittimo a un funzionamento sicuro, all\'aiuto in caso di problemi e al riconoscimento degli abusi).',
      ],
    },
    {
      heading: '20. Caratteri, simboli e tracciamento',
      blocks: [
        'I caratteri (Petrona, Figtree) vengono forniti ospitati in autonomia; **non** viene stabilita alcuna connessione a Google Fonts. Simboli, illustrazioni e animazioni sono integrati nell\'applicazione e non vengono caricati da servizi esterni. Non si utilizzano servizi di analisi, tracciamento o pubblicità, e non avviene alcuna profilazione. Un banner dei cookie non è quindi necessario.',
      ],
    },
    {
      heading: '21. Destinatari',
      blocks: [
        'I vostri dati non vengono venduti né trasmessi a fini pubblicitari. Destinatari sono esclusivamente i fornitori di servizi indicati in questa informativa nella misura descritta, i membri delle board di cui fate parte (sezione 11), le persone a cui un membro invia un link a un piatto, nella misura della sezione 11, e il gestore nella misura della sezione 19. I dati vengono trasmessi alle autorità solo quando vi è un obbligo di legge.',
      ],
    },
    {
      heading: '22. Trasferimenti verso paesi terzi',
      blocks: [
        'Vercel, Neon, Google, Resend e – con le notifiche push attive – Mozilla o Microsoft sono, o appartengono a, società con sede negli USA. Ove dati personali vengano trasferiti negli USA, ciò si basa sulla decisione di adeguatezza della Commissione UE per il Data Privacy Framework UE-USA (art. 45 GDPR), se il rispettivo fornitore è certificato, e per il resto sulle clausole contrattuali tipo della Commissione UE (art. 46, par. 2, lett. c) GDPR). Quando le anteprime delle immagini vengono caricate direttamente da piattaforme e siti (sezione 15) e quando vengono riprodotti i video (sezione 16), anche i loro server possono trovarsi al di fuori dell\'UE.',
      ],
    },
    {
      heading: '23. Durata della conservazione',
      blocks: [
        {
          list: [
            'Account, board e contenuti: finché il vostro account esiste o fino alla loro eliminazione; piatti, voci di cottura e commenti eliminati per altri 30 giorni (sezioni 12 e 13).',
            'Registro degli eventi: a tempo indeterminato, senza contenuto; senza il vostro identificativo dopo l\'eliminazione del vostro account (sezione 19).',
            'Dati di sessione: fino alla scadenza della sessione o alla disconnessione.',
            'Contatori di abuso: solo per brevi finestre temporali (sezione 10).',
            'Cookie del link al piatto: al massimo un\'ora (sezione 9).',
            'Momenti dei suggerimenti per attivarle: finché il vostro account esiste (sezione 18).',
            'Abbonamenti push: finché disattivate le notifiche o il servizio push segnala che non sono più validi.',
            'Log del server dell\'host: solo per il tempo necessario all\'analisi degli errori e alla sicurezza, poi eliminati automaticamente.',
          ],
        },
      ],
    },
    {
      heading: '24. Obbligo di fornire dati e decisioni automatizzate',
      blocks: [
        'Non siete obbligati né per legge né per contratto a fornire dati. Senza i dati necessari per l\'accesso (sezioni 5 e 6), tuttavia, non potete usare l\'applicazione. Non avviene alcun processo decisionale automatizzato, compresa la profilazione ai sensi dell\'art. 22 GDPR; il controllo rispetto alla lista di accesso è un puro controllo degli accessi.',
      ],
    },
    {
      heading: '25. I vostri diritti',
      blocks: [
        'Avete il diritto di accesso (art. 15), rettifica (art. 16), cancellazione (art. 17), limitazione del trattamento (art. 18) e portabilità dei dati (art. 20 GDPR). Potete eliminare da soli il vostro account nelle impostazioni (sezione 12). Un consenso prestato può essere revocato in qualsiasi momento con effetto per il futuro (art. 7, par. 3 GDPR); la liceità del trattamento effettuato fino ad allora resta impregiudicata. Per esercitare gli altri diritti è sufficiente un messaggio all\'indirizzo indicato nella sezione 1.',
        '**Diritto di opposizione (art. 21 GDPR):** ove il trattamento si basi sull\'art. 6, par. 1, lett. f) GDPR, potete opporvi in qualsiasi momento per motivi legati alla vostra situazione particolare. Non trattiamo più i dati, salvo che possiamo dimostrare motivi legittimi cogenti che prevalgono sui vostri interessi, diritti e libertà, oppure il trattamento serva a far valere, esercitare o difendere diritti in sede giudiziaria.',
      ],
    },
    {
      heading: '26. Diritto di reclamo',
      blocks: [
        'Avete il diritto di proporre reclamo a un\'autorità di controllo per la protezione dei dati (art. 77 GDPR), in particolare nello Stato membro della vostra residenza abituale, del vostro luogo di lavoro o del luogo della presunta violazione. L\'autorità competente per il titolare è:',
        'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen\nKavalleriestraße 2–4\n40213 Düsseldorf, Germania',
      ],
    },
    {
      heading: '27. Sicurezza dei dati',
      blocks: [
        'La connessione all\'applicazione è cifrata per l\'intero percorso con TLS (HTTPS). Adottiamo misure tecniche e organizzative adeguate per proteggere i vostri dati da perdita, abuso e accesso non autorizzato.',
      ],
    },
    {
      heading: '28. Modifiche e stato',
      blocks: [
        'La presente informativa sulla privacy viene adeguata quando cambiano l\'applicazione o la situazione giuridica; vale la versione pubblicata qui. Stato: ottobre 2026.',
      ],
    },
  ],
}

export const datenschutz: LegalText[] = [
  {
    language: 'de',
    binding: true,
    title: 'Datenschutzerklärung',
    note: 'Verbindliche Fassung. Nur dieser deutsche Text ist rechtlich maßgeblich.',
    sections: [
      {
        heading: '1. Verantwortlicher',
        blocks: [
          'Dominik Christian Gilges\nAugust-Thyssen-Str. 16\n52249 Eschweiler\nE-Mail: foodieflip.dev@gmail.com',
          'Ein Datenschutzbeauftragter ist nicht bestellt, da hierzu keine gesetzliche Pflicht besteht.',
        ],
      },
      {
        heading: '2. Überblick',
        blocks: [
          'Diese Datenschutzerklärung gilt für die Web-Anwendung **malkochen** unter **malkochen.christried.me**. Sie beschreibt, welche personenbezogenen Daten beim Betrieb verarbeitet werden, zu welchem Zweck, auf welcher Rechtsgrundlage und welche Rechte Sie haben.',
          'malkochen ist ein privates, nicht-kommerzielles Hobby-Projekt, mit dem Gruppen online gefundene Gerichte (z. B. von TikTok, Instagram, YouTube, Pinterest oder Food-Blogs) auf gemeinsamen Boards sammeln und festhalten können, was sie kochen wollen und schon gekocht haben, und darüber sprechen. Es gibt keine Werbung, kein Tracking und keine Analyse-Werkzeuge. Verarbeitet werden nur die Daten, die für Anmeldung, Betrieb und die Funktionen der Anwendung erforderlich sind.',
        ],
      },
      {
        heading: '3. Hosting (Vercel)',
        blocks: [
          'Die Anwendung wird bei der Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, gehostet. Beim Aufruf verarbeitet Vercel technisch notwendige Zugriffsdaten in Server-Logs, darunter IP-Adresse, Datum und Uhrzeit der Anfrage, die angefragte URL, den Referrer sowie Browser- und Betriebssystem-Angaben. Ebenfalls in diesen Logs landen technische Fehlermeldungen der Anwendung, etwa Berichte Ihres Browsers über Verstöße gegen die Sicherheitsrichtlinie (Content Security Policy); diese enthalten die aufgerufene Seitenadresse ohne Suchparameter, aber keine Inhalte.',
          'Die täglichen Aufräum- und Versandaufgaben der Anwendung laufen über Vercel Cron. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren, stabilen und fehlerfreien Betrieb). Mit Vercel besteht ein Auftragsverarbeitungsvertrag (Art. 28 DSGVO). Zur Übermittlung in die USA siehe Abschnitt 22.',
        ],
      },
      {
        heading: '4. Datenbank (Neon)',
        blocks: [
          'Anwendungsdaten werden in einer PostgreSQL-Datenbank der Neon Inc. (US-Unternehmen, heute Teil der Databricks Inc.) gespeichert. Datenbankstandort: Frankfurt am Main (AWS-Region eu-central-1). Gespeichert wird alles, was in den Abschnitten 5 bis 18 beschrieben ist. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. f DSGVO. Mit Neon besteht ein Auftragsverarbeitungsvertrag.',
        ],
      },
      {
        heading: '5. Anmeldung mit Google',
        blocks: [
          'Eine Anmeldung ist über den OAuth-Dienst von Google möglich (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland; Muttergesellschaft: Google LLC, USA). Dabei werden Sie auf eine Seite von Google weitergeleitet, für die die Datenschutzbestimmungen von Google gelten. Angefragt werden nur die Berechtigungen für Profil- und E-Mail-Angaben. Aus Ihrem Google-Konto speichern wir: Namen, E-Mail-Adresse und deren Bestätigungsstatus, die Adresse (URL) Ihres Google-Profilbilds, Ihre Google-Benutzerkennung sowie die zur Anmeldung gehörenden OAuth-Token. Auf Ihr Google-Konto greift die Anwendung darüber hinaus nicht zu.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Begründung und Durchführung des Nutzungsverhältnisses).',
        ],
      },
      {
        heading: '6. Anmeldung mit einem Code per E-Mail (Resend)',
        blocks: [
          'Sie können sich auch mit Ihrer E-Mail-Adresse anmelden. Dazu schicken wir Ihnen einen sechsstelligen Code, der zehn Minuten gilt; Sie geben ihn dort ein, wo die Anmeldung begonnen hat. Der Code wird nur gehasht gespeichert, gilt nur einmal, und nach fünf falschen Eingaben brauchen Sie einen neuen. Wer einen neuen Code anfordert, bekommt damit den alten ungültig. Ein Link in derselben E-Mail meldet Sie ebenfalls an.',
          'Die E-Mail verschickt die Anwendung über **Resend** (Resend Inc., USA) als Auftragsverarbeiter; Empfänger ist nur Ihre E-Mail-Adresse. Die Sprache der E-Mail richtet sich nach der Sprache Ihres Browsers. Zum Schutz vor Missbrauch sind Code-Anforderungen je IP-Adresse und je E-Mail-Adresse begrenzt (Abschnitt 10). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Mit Resend besteht ein Auftragsverarbeitungsvertrag.',
        ],
      },
      {
        heading: '7. Benutzername, Zugang und Einstellungen',
        blocks: [
          'Nach der ersten Anmeldung wählen Sie einen **Benutzernamen**. Er ist der einzige Name, den die Anwendung von Ihnen anzeigt; Ihr Name aus dem Google-Konto wird gespeichert, aber anderen nicht angezeigt. Ihre E-Mail-Adresse sehen nur Sie selbst.',
          'Anmelden können sich Personen, die auf der festen Zugangsliste stehen, und, solange der Betreiber die **offene Anmeldung (Open Sign-up)** eingeschaltet hat, jede Person mit einem bestätigten Google-Konto oder einer E-Mail-Adresse. Wer schon ein Konto hat, meldet sich auch dann an, wenn die offene Anmeldung wieder ausgeschaltet ist. Die Zugangsliste und der Schalter dienen allein der Zugangskontrolle; Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Schutz vor unberechtigtem Zugriff).',
          'In Ihren Einstellungen speichern wir Ihre **Sprache** („Automatisch“ oder Deutsch, Englisch, Italienisch). Bei „Automatisch“ folgt malkochen Ihrem Browser; die Sprache, die Ihr Browser zuletzt angab, merken wir uns für E-Mails und Push-Benachrichtigungen, wenn Sie gerade nicht in der Anwendung sind. Außerdem speichern wir, bis zu welcher Tour-Version Sie die Einführung durchgeklickt haben, und die zuletzt angesehene Version von „Was ist neu“, damit Ihre Einstellungen anzeigen, was neu ist. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.',
        ],
      },
      {
        heading: '8. Profilbild',
        blocks: [
          'Neben Ihrem Benutzernamen zeigt die Anwendung ein rundes Profilbild – für Sie selbst und für die Mitglieder der Boards, denen Sie angehören. Es ist entweder ein Bild, das Sie selbst in Ihren Einstellungen hochladen, sonst Ihr Google-Profilbild, sonst Ihr Anfangsbuchstabe.',
          {
            list: [
              '**Selbst hochgeladenes Bild:** Es wird serverseitig quadratisch zugeschnitten, neu kodiert und dabei von allen Metadaten (z. B. EXIF-Angaben wie Aufnahmeort oder Kameramodell) befreit, bevor es gespeichert wird (Abschnitt 14). Sie können es jederzeit wieder entfernen.',
              '**Google-Profilbild:** Es wird direkt von den Servern von Google geladen. Dabei erhält Google technisch bedingt die IP-Adresse des Geräts, auf dem das Bild angezeigt wird, sowie übliche Browserangaben – das gilt auch für andere Mitglieder Ihrer Boards, die Ihr Bild sehen. Wenn Sie das nicht möchten, laden Sie ein eigenes Bild hoch; dann wird Ihr Google-Profilbild nicht mehr angezeigt.',
            ],
          },
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erkennbarkeit der Mitglieder in einer gemeinsam genutzten Anwendung) bzw. für das Laden von Google Art. 6 Abs. 1 lit. f DSGVO.',
        ],
      },
      {
        heading: '9. Cookies und Speicher im Browser',
        blocks: [
          'Die Anwendung setzt ausschließlich technisch notwendige Cookies bzw. speichert Angaben im Browser, die für die von Ihnen ausdrücklich gewünschten Funktionen unbedingt erforderlich sind. Hierfür ist keine Einwilligung nötig (§ 25 Abs. 2 Nr. 2 TDDDG). Im Einzelnen:',
          {
            list: [
              '**Sitzungs-Cookies** (Better Auth): halten Sie angemeldet und sichern den Anmeldevorgang ab. Sie laufen mit der Sitzung ab bzw. werden beim Abmelden gelöscht.',
              '**Einladungs-Cookie** (`malkochen.invite`): merkt sich nach dem Öffnen eines Einladungslinks, welchem Board Sie nach der Anmeldung beitreten wollen; höchstens 30 Tage, nach dem Beitritt wird es gelöscht.',
              '**Gericht-Link-Cookie** (`malkochen.dish-link`): merkt sich, nachdem Sie auf einem Gericht-Link (Abschnitt 11) „Auf mein Board kopieren“ angetippt haben, welches Gericht Sie nach der Anmeldung kopieren wollen; höchstens eine Stunde, und gelöscht, sobald die App nach der Anmeldung öffnet.',
              '**Design-Cookie** (`malkochen-theme`): merkt sich, ob Sie das helle, dunkle oder das Systemdesign gewählt haben; 1 Jahr.',
              '**Lokaler Speicher**: ob der Startbildschirm in diesem Browserfenster schon gezeigt wurde (bis zum Schließen des Fensters) und welche Gerichte auf diesem Gerät schon als „Klassiker“ gefeiert wurden, damit die Feier nur einmal erscheint.',
              '**Service Worker**: hält die Grundbestandteile der App sowie eine Offline-Seite auf Ihrem Gerät vor, damit sich malkochen wie eine installierte App verhält; Inhalte Ihrer Boards werden dort nicht zwischengespeichert. Er empfängt außerdem Push-Benachrichtigungen, sofern Sie diese aktivieren (Abschnitt 17).',
            ],
          },
          'Sie können Cookies und gespeicherte Website-Daten jederzeit in Ihrem Browser löschen; danach müssen Sie sich ggf. neu anmelden.',
        ],
      },
      {
        heading: '10. Sitzungs- und Sicherheitsdaten',
        blocks: [
          'Zu jeder Sitzung speichern wir Ihre IP-Adresse und die Browserkennung (User-Agent), um Missbrauch erkennen zu können. Außerdem zählt die Anwendung zum Schutz vor Missbrauch und Überlastung, wie oft bestimmte Aktionen aufgerufen werden – je nach Aktion Ihrem Konto oder der aufrufenden IP-Adresse zugeordnet (z. B. Anmeldeversuche, Anforderungen von Codes oder Aufrufe ungültiger Einladungslinks). Diese Zähler gelten nur für ein kurzes Zeitfenster und werden danach überschrieben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Sicherheit der Anwendung und dem Schutz vor Missbrauch).',
        ],
      },
      {
        heading: '11. Boards und von Ihnen erstellte Inhalte',
        blocks: [
          'Innerhalb der Anwendung erstellen und bearbeiten Sie Inhalte: Boards (Name, Emoji), deren Spalten (Name, Untertitel, Reihenfolge) und Gerichte mit Titel, Quell-Link, dem Namen des Kanals bzw. Blogs, der die Quelle veröffentlicht hat, der Beschreibung der Quelle (der Text, den die Plattform zum Beitrag öffentlich zeigt, Abschnitt 15), einem Bild samt gewähltem Bildausschnitt sowie Kochverlauf (wann ein Gericht gekocht wurde). Zu Gerichten, Kochverlauf-Einträgen, Kommentaren und Stimmen wird gespeichert, wer sie angelegt hat und wann.',
          'Ein **Kommentar** ist eine Nachricht eines Mitglieds zu einem Gericht, die auch bearbeitet werden kann. Eine **Stimme** ist ein Daumen hoch oder runter zu einem gekochten Gericht; jedes Mitglied hat je Gericht eine, und wer sie zurücknimmt, löscht sie.',
          'Zu Ihrer Mitgliedschaft in einem Board speichern wir, wann Sie beigetreten sind, wann Sie das Board zuletzt geöffnet und zuletzt gesehen hatten, welche Gerichte Sie zuletzt geöffnet haben (damit neue Gerichte, Kommentare und Stimmen für Sie markiert werden), und welche Rechte Sie darauf haben, sowie ob Sie das Board besitzen. Das dient dazu, Neues zu markieren und Sie beim nächsten Start auf dem zuletzt genutzten Board landen zu lassen.',
          'Alle Inhalte eines Boards sowie Benutzername und Profilbild seiner Mitglieder sind für **alle Mitglieder dieses Boards** sichtbar; die Mitglieder können sie – je nach ihren Rechten – bearbeiten, kommentieren und abstimmen. Wer einen Einladungslink eines Boards erhält, kann dem Board beitreten; teilen Sie Einladungslinks daher nur mit Personen, die Ihre Inhalte sehen sollen. Die Besitzerin bzw. der Besitzer eines Boards kann den Link jederzeit zurücksetzen.',
          '**Gericht-Links:** Jedes Mitglied kann zu einem Gericht einen Link teilen. Wer diesen Link hat, sieht auch ohne Anmeldung Bild, Titel, den Namen des Kanals bzw. Blogs und den Quell-Link dieses einen Gerichts, aber nichts vom Board, seinen Mitgliedern, Kommentaren, Stimmen oder vom Kochverlauf. Der Link enthält eine zufällige, nicht erratbare Zeichenfolge und funktioniert, solange das Gericht nicht archiviert oder gelöscht ist. Wird er in einem Messenger geteilt, kann dieser eine Vorschau mit Titel und Bild abrufen. Teilen Sie Gericht-Links daher nur mit Personen, die das Gericht sehen sollen.',
          '**Kopien:** Ein Mitglied kann ein Gericht auf ein anderes Board kopieren, auf dem es Gerichte hinzufügen darf, auch über einen Gericht-Link. Die Kopie übernimmt Titel, Bild (als eigene Bilddatei), Quell-Link, Kanal bzw. Blog und Beschreibung, aber keine Kommentare, Stimmen und keinen Kochverlauf. Sie gilt als von der kopierenden Person hinzugefügt und ist für die Mitglieder des Ziel-Boards sichtbar.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.',
        ],
      },
      {
        heading: '12. Konto löschen',
        blocks: [
          'Ihr Nutzerkonto können Sie in Ihren Einstellungen selbst löschen. Dabei gilt:',
          {
            list: [
              'Boards, in denen Sie Besitzer sind und andere Mitglieder sind, gehen an das Mitglied über, das am längsten dabei ist.',
              'Boards, auf denen nur Sie sind, werden endgültig gelöscht, auch wenn sie im Archiv liegen.',
              'Ihre Mitgliedschaften, Sitzungen, Anmeldungen, Push-Abonnements, die E-Mail-Zusammenfassung und Ihre Benutzerdaten werden gelöscht.',
              'Was Sie zu Boards anderer beigetragen haben (Gerichte, Kochverlauf-Einträge, Kommentare und Stimmen), bleibt für die übrigen Mitglieder erhalten, ist aber keiner Person mehr zugeordnet und erscheint als „Gelöschtes Konto“.',
              'Bilder, die nur Sie verwendet haben, werden entfernt. Eine Bestätigung geht an Ihre E-Mail-Adresse.',
              'Im Ereignisprotokoll (Abschnitt 19) bleiben die Einträge ohne Ihre Kennung.',
            ],
          },
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Beendigung des Nutzungsverhältnisses).',
        ],
      },
      {
        heading: '13. Archiv und Aufbewahrung gelöschter Inhalte',
        blocks: [
          'Wenn ein Mitglied ein Gericht archiviert oder der Besitzer ein Board löscht, bleibt es 30 Tage wiederherstellbar. Danach löscht eine tägliche Aufräumaufgabe es endgültig, mit allen Gerichten, Kochverlauf-Einträgen und Kommentaren darin. Gelöschte Kommentare und Kochverlauf-Einträge bleiben ebenso 30 Tage wiederherstellbar. Stimmen, die jemand zurücknimmt, sind sofort gelöscht.',
        ],
      },
      {
        heading: '14. Bilder (Vercel Blob)',
        blocks: [
          'Bilder von Gerichten – aus der Quelle übernommene Vorschaubilder ebenso wie selbst hochgeladene Fotos – und selbst hochgeladene Profilbilder speichert die Anwendung im Dienst **Vercel Blob** der Vercel Inc. (Abschnitt 3). Hochgeladene Fotos werden vor dem Speichern verkleinert, neu kodiert und von allen Metadaten (z. B. EXIF-Angaben wie GPS-Position) befreit. Die Bilder werden unter zufällig erzeugten, nicht erratbaren Adressen abgelegt und von dort geladen; wer eine solche Adresse kennt, kann das Bild auch ohne Anmeldung abrufen. Bilder, die keinem Gericht und keinem Profil mehr zugeordnet sind, werden durch einen täglichen Aufräumvorgang gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.',
        ],
      },
      {
        heading: '15. Abruf von Links (TikTok, Instagram, YouTube, Pinterest, Food-Blogs)',
        blocks: [
          'Wenn Sie beim Hinzufügen eines Gerichts einen Link einfügen, ruft der Server der Anwendung die verlinkte Seite bzw. die öffentliche Schnittstelle der jeweiligen Plattform (z. B. die oEmbed-Schnittstellen von TikTok, YouTube und Pinterest) ab, um einen Titelvorschlag, den Namen des veröffentlichenden Kanals bzw. Blogs (oder der Person, die gepinnt hat), ein Vorschaubild und die Beschreibung des Beitrags zu ermitteln, sowie ob sich sein Video in malkochen abspielen lässt. Bei Instagram liest der Server dafür die öffentliche Einbettungsseite des Beitrags. Dieser Abruf erfolgt serverseitig; Ihre IP-Adresse wird dabei nicht an die Plattform weitergegeben, übermittelt wird nur der Link selbst.',
          'Für Gerichte, die schon vor dieser Funktion hinzugefügt wurden, ruft der Server die Quelle einmalig auf dieselbe Weise erneut ab, um Beschreibung und Abspielbarkeit nachzutragen.',
          'Bevor Sie das Gericht speichern, zeigt die Anwendung das gefundene Vorschaubild zur Kontrolle an. Dieses Bild wird direkt von den Servern der jeweiligen Plattform bzw. Website geladen; dabei erhält deren Betreiber technisch bedingt Ihre IP-Adresse und übliche Browserangaben. Nach dem Speichern wird eine Kopie des Bildes verwendet (Abschnitt 14), sodass beim Anzeigen des Gerichts keine Verbindung zur Plattform mehr entsteht. Erst wenn Sie den Quell-Link eines Gerichts anklicken, öffnen Sie die Seite der Plattform; ab dann gelten deren Datenschutzbestimmungen.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, da das Übernehmen von Gerichten aus Links eine Kernfunktion der Anwendung ist.',
        ],
      },
      {
        heading: '16. Videos (Abspielen auf Klick)',
        blocks: [
          'Ein Video eines Gerichts (TikTok, YouTube Shorts, Instagram-Reel) spielt die Anwendung nur ab, wenn Sie „Video abspielen“ antippen. Erst dann lädt der Player der Plattform in einen eingebetteten Rahmen: TikTok (tiktok.com), YouTube im datenschutzfreundlichen Modus (youtube-nocookie.com) bzw. Instagram (instagram.com). Davor wird nichts von diesen Plattformen geladen. Ab dem Abspielen erhält die Plattform Ihre IP-Adresse und übliche Browserangaben, und es gelten ihre Datenschutzbestimmungen; die Plattform kann eigene Cookies setzen. Die Anwendung selbst setzt dafür keine. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Ihr Klick als Einwilligung in dieses Laden).',
        ],
      },
      {
        heading: '17. Push-Benachrichtigungen',
        blocks: [
          'Optional können Sie in Ihren Einstellungen für ein Gerät Push-Benachrichtigungen einschalten (standardmäßig aus; bis zu zehn Geräte je Konto). Sie erhalten dann eine Benachrichtigung, wenn andere Mitglieder Gerichte zu einem Ihrer Boards hinzufügen oder dort kommentieren oder abstimmen. Dazu speichern wir das von Ihrem Browser erzeugte Push-Abonnement: die Empfangsadresse Ihres Geräts beim Push-Dienst Ihres Browsers sowie die zugehörigen Schlüssel.',
          'Der Inhalt der Benachrichtigung umfasst den Namen des Boards, die Benutzernamen der Beteiligten, die Titel der Gerichte und bei Kommentaren den Anfang des Kommentartextes; bei Stimmen steht nur, wer wie abgestimmt hat.',
          'Die Benachrichtigungen werden über den Push-Dienst des Browser- bzw. Betriebssystemherstellers zugestellt – bei Chrome und Android ist das Firebase Cloud Messaging der Google LLC (USA), bei Firefox der Dienst der Mozilla Corporation (USA), bei Edge der Windows Push Notification Service der Microsoft Corporation (USA). Der Inhalt wird Ende-zu-Ende verschlüsselt übertragen und kann vom Push-Dienst nicht gelesen werden; der Dienst erhält nur die für die Zustellung nötigen technischen Angaben.',
          'Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO sowie § 25 Abs. 1 TDDDG). Sie können sie jederzeit widerrufen, indem Sie die Benachrichtigungen in den Einstellungen der Anwendung oder Ihres Browsers abschalten; das Abonnement wird dann gelöscht.',
        ],
      },
      {
        heading: '18. E-Mail-Zusammenfassung',
        blocks: [
          'Wenn Sie die **E-Mail-Zusammenfassung** in Ihren Einstellungen einschalten, schicken wir Ihnen einmal am Tag am Abend eine E-Mail, für alle Ihre Boards zusammen. Sie listet die Gerichte, die andere seit der letzten Zusammenfassung zu Ihren Boards hinzugefügt haben, sowie die Kommentare und Stimmen, die Sie dort abgegeben haben. Gibt es nichts Neues, bleibt die E-Mail aus. Die E-Mail verschickt die Anwendung über Resend (Abschnitt 6). Dazu speichern wir, bis wann die Zusammenfassungen schon erfasst wurden, damit kein Gericht zweimal erscheint. Ausschalten können Sie die Zusammenfassung jederzeit in Ihren Einstellungen; dann wird die Angabe gelöscht. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).',
          '**Hinweise zum Einschalten:** Die Anwendung kann Ihnen auf einem Board vorschlagen, Push-Benachrichtigungen oder die E-Mail-Zusammenfassung einzuschalten, frühestens einen Tag nach der Registrierung und je Hinweis höchstens alle 30 Tage. Dazu speichern wir zu Ihrem Konto, wann der jeweilige Hinweis zuletzt erschienen ist. Eingeschaltet wird erst, wenn Sie „Einschalten“ antippen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse daran, auf freiwillige Funktionen hinzuweisen, ohne wiederholt zu stören).',
        ],
      },
      {
        heading: '19. Ereignisprotokoll und Betreiber',
        blocks: [
          'Die Anwendung führt ein **Ereignisprotokoll**: einen Eintrag je Vorgang auf Boards und rund um Ihr Konto. Dazu gehören etwa, dass ein Board angelegt, ein Gericht hinzugefügt, verschoben, kopiert oder archiviert, ein Kommentar geschrieben, eine Stimme abgegeben oder ein Gericht-Link geöffnet wurde; außerdem Ihre Registrierung und jede Anmeldung mit dem Anmeldeweg, Änderungen von Benutzername, Profilbild und Sprache, das Ein- und Ausschalten von Push-Benachrichtigungen und E-Mail-Zusammenfassung, angezeigte und beantwortete Hinweise zum Einschalten, jede versandte Push-Benachrichtigung (je Gerät, mit dem Ergebnis der Zustellung) und E-Mail-Zusammenfassung sowie die Löschung eines Kontos. Ein Eintrag enthält nur Zeitpunkt, Art des Vorgangs, Kennungen (des Boards, des Gerichts, der beteiligten Person, des Kommentars) und einige nicht inhaltliche Angaben, etwa die Art der Quelle eines Gerichts, den Anmeldeweg oder ob ein Gericht-Link von einer angemeldeten Person geöffnet wurde. Er enthält selbst keine Titel, Kommentartexte, Namen, E-Mail-Adressen, IP-Adressen oder Links. Die Einträge werden nicht gelöscht; Ihre Kennung entfernen wir, wenn Sie Ihr Konto löschen.',
          'Der **Betreiber**, der die Anwendung verwaltet, kann jedes Board öffnen und dort alles tun, was dessen Besitzerin oder Besitzer kann, ohne als Mitglied aufzutreten; was er dort hinzufügt, erscheint unter seinem Benutzernamen. Auf der Verwaltungsseite sieht er das Ereignisprotokoll mit den Namen der Personen, Boards und Gerichte sowie den Kommentartexten so, wie sie **jetzt** sind: Gelöschtes erscheint als gelöscht, ein gelöschtes Konto als „Gelöschtes Konto“, frühere Fassungen werden nicht aufbewahrt. Daneben sieht er Zählwerte wie Anmeldungen je Tag und Anmeldeweg, die Zahl aktiver Personen und der Ereignisse je Art sowie Speicher-, E-Mail- und Aufrufmengen gegenüber den kostenlosen Kontingenten der Dienste. Das dient dazu, Personen auf Nachfrage zu helfen und Missbrauch zu erkennen, zumal man sich bei eingeschalteter offener Registrierung (Abschnitt 7) auch ohne Einladung registrieren kann. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb, an Hilfe bei Problemen und an der Erkennung von Missbrauch).',
        ],
      },
      {
        heading: '20. Schriftarten, Symbole und Tracking',
        blocks: [
          'Die Schriftarten (Petrona, Figtree) werden selbst gehostet ausgeliefert; es wird **keine** Verbindung zu Google Fonts hergestellt. Symbole, Illustrationen und Animationen sind fest in die Anwendung eingebunden und werden nicht von externen Diensten nachgeladen. Es kommen keine Analyse-, Tracking- oder Werbedienste zum Einsatz und es findet kein Profiling statt. Ein Cookie-Banner ist daher nicht erforderlich.',
        ],
      },
      {
        heading: '21. Empfänger',
        blocks: [
          'Ihre Daten werden nicht verkauft und nicht zu Werbezwecken weitergegeben. Empfänger sind ausschließlich die in dieser Erklärung genannten Dienstleister im jeweils beschriebenen Umfang, die Mitglieder der Boards, denen Sie angehören (Abschnitt 11), Personen, denen ein Mitglied einen Gericht-Link schickt, im Umfang von Abschnitt 11, und der Betreiber im Umfang von Abschnitt 19. Eine Weitergabe an Behörden erfolgt nur, wenn eine gesetzliche Pflicht dazu besteht.',
        ],
      },
      {
        heading: '22. Übermittlung in Drittländer',
        blocks: [
          'Vercel, Neon, Google, Resend sowie – bei aktivierten Push-Benachrichtigungen – Mozilla bzw. Microsoft sind bzw. gehören zu Unternehmen mit Sitz in den USA. Soweit dabei personenbezogene Daten in die USA übermittelt werden, stützt sich dies auf den Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework (Art. 45 DSGVO), soweit der jeweilige Anbieter danach zertifiziert ist, und im Übrigen auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO). Beim Laden von Vorschaubildern direkt von Plattformen und Websites (Abschnitt 15) sowie beim Abspielen von Videos (Abschnitt 16) können deren Server ebenfalls außerhalb der EU stehen.',
        ],
      },
      {
        heading: '23. Speicherdauer',
        blocks: [
          {
            list: [
              'Konto, Boards und Inhalte: solange Ihr Konto besteht bzw. bis Sie sie löschen; gelöschte Gerichte, Kochverlauf-Einträge und Kommentare 30 Tage darüber hinaus (Abschnitte 12 und 13).',
              'Ereignisprotokoll: dauerhaft, ohne Inhalt; ohne Ihre Kennung, wenn Sie Ihr Konto löschen (Abschnitt 19).',
              'Sitzungsdaten: bis zum Ablauf der Sitzung bzw. bis zum Abmelden.',
              'Missbrauchszähler: nur für kurze Zeitfenster (Abschnitt 10).',
              'Gericht-Link-Cookie: höchstens eine Stunde (Abschnitt 9).',
              'Zeitpunkte der Hinweise zum Einschalten: solange Ihr Konto besteht (Abschnitt 18).',
              'Push-Abonnements: bis Sie die Benachrichtigungen abschalten oder der Push-Dienst meldet, dass sie nicht mehr gültig sind.',
              'Server-Logs des Hosters: nur so lange, wie es zur Fehleranalyse und Sicherheit erforderlich ist, und danach automatisch gelöscht.',
            ],
          },
        ],
      },
      {
        heading: '24. Pflicht zur Bereitstellung und automatisierte Entscheidungen',
        blocks: [
          'Sie sind weder gesetzlich noch vertraglich verpflichtet, Daten bereitzustellen. Ohne die für die Anmeldung nötigen Angaben (Abschnitte 5 und 6) können Sie die Anwendung jedoch nicht nutzen. Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt; der Abgleich mit der Zugangsliste ist eine reine Zugangskontrolle.',
        ],
      },
      {
        heading: '25. Ihre Rechte',
        blocks: [
          'Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20 DSGVO). Ihr Konto können Sie in Ihren Einstellungen selbst löschen (Abschnitt 12). Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO); die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt. Zur Ausübung der übrigen Rechte genügt eine Nachricht an die in Abschnitt 1 genannte Adresse.',
          '**Widerspruchsrecht (Art. 21 DSGVO):** Soweit eine Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO beruht, können Sie ihr aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.',
        ],
      },
      {
        heading: '26. Beschwerderecht',
        blocks: [
          'Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Für den Verantwortlichen zuständig ist:',
          'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen\nKavalleriestraße 2–4\n40213 Düsseldorf',
        ],
      },
      {
        heading: '27. Datensicherheit',
        blocks: [
          'Die Verbindung zur Anwendung ist durchgehend per TLS (HTTPS) verschlüsselt. Wir treffen angemessene technische und organisatorische Maßnahmen, um Ihre Daten vor Verlust, Missbrauch und unbefugtem Zugriff zu schützen.',
        ],
      },
      {
        heading: '28. Änderungen und Stand',
        blocks: [
          'Diese Datenschutzerklärung wird angepasst, wenn sich die Anwendung oder die Rechtslage ändert; es gilt die jeweils hier veröffentlichte Fassung. Stand: Oktober 2026.',
        ],
      },
    ],
  },
  english,
  italian,
]
