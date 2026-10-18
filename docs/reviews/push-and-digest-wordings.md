# Push and Digest wordings: variations to choose from

For #325 (spec #317, user stories 24–25). Every text a Push Notification or the Email Digest shows today, with 2–3 German variations each and what each one is going for. All keep the casual "du", warm and short. Pick one per text (or a mix, or ask for more); the picks go into the issue's comments and then into `app/strings/de.ts`, before anything is translated. **The user's choice is at the end, under „Chosen".**

The examples use the Board „🍪 Kochclub", the Members Ada, Linus and Grace, and the Dishes Linsen-Dal, Cremige Pilzpasta and Ofengemüse mit Tahini.

## How they're seen

- **Push on Android:** the app icon, „malkochen" and the time above; then the title in bold and the body below. Collapsed, the title gets about 35–40 characters on a 360px phone and the body one line; expanded, the body gets a few lines. One notification per Board, replaced as more Dishes come in (it counts everything since you last had the Board open).
- **Email in an inbox list:** the sender („malkochen"), the subject, then a grey preview line. With no preheader, that preview is the start of the email itself: today „Neu auf deinen Boards 🍪 Kochclub Linsen-Dal von Ada Board öffnen …".
- The Digest goes out at 16:00 UTC, so 17:00 in winter and 18:00 in summer, German time.

## 1. Push Notification

Title and body work together, so they come as three styles. Each style covers every case. The differences: one or several Dishes, one or several Members, and whether it is about one Dish (tapping it opens the Dish) or about the Board (tapping it opens the Board).

**Today:**

| Case | Title | Body |
|---|---|---|
| 1 Dish, 1 Member | Ada hat 1 Gericht zu 🍪 Kochclub hinzugefügt | Linsen-Dal |
| 3 Dishes, 1 Member | Ada hat 3 Gerichte zu 🍪 Kochclub hinzugefügt | Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini |
| 3 Dishes, 2 Members | Linus und Ada haben 3 Gerichte zu 🍪 Kochclub hinzugefügt | Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini |
| 6 Dishes, 3 Members | Grace, Linus und Ada haben 6 Gerichte zu 🍪 Kochclub hinzugefügt | (titles, cut after 120 characters with „ …") |

Critique: the title is long. Collapsed, Android cuts it around „Ada hat 3 Gerichte zu 🍪 Ko…", so the Board, which is the part you need when you have several, is the part that gets lost. „1 Gericht" reads like a counter, not a sentence.

### Style A: who did it (today's, tightened)

| Case | Title | Body |
|---|---|---|
| 1 Dish, 1 Member | Ada hat Linsen-Dal hinzugefügt | 🍪 Kochclub |
| 3 Dishes, 1 Member | Ada hat 3 Gerichte hinzugefügt | 🍪 Kochclub: Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini |
| 3 Dishes, 2 Members | Linus und Ada haben 3 Gerichte hinzugefügt | 🍪 Kochclub: Linsen-Dal, Cremige Pilzpasta, … |
| 6 Dishes, 3 Members | Grace, Linus und Ada haben 6 Gerichte hinzugefügt | 🍪 Kochclub: … |

Going for: the person first, as with a message from a friend, and closest to today. The Board moves to the start of the body, so the title stays short. About one Dish, the title names it. A long Dish title makes that title long again.

### Style B: the Board as the headline

| Case | Title | Body |
|---|---|---|
| 1 Dish, 1 Member | 🍪 Kochclub | Ada hat Linsen-Dal hinzugefügt |
| 3 Dishes, 1 Member | 🍪 Kochclub | Ada hat 3 Gerichte hinzugefügt: Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini |
| 3 Dishes, 2 Members | 🍪 Kochclub | Linus und Ada haben 3 Gerichte hinzugefügt: Linsen-Dal, … |
| 6 Dishes, 3 Members | 🍪 Kochclub | Grace, Linus und Ada haben 6 Gerichte hinzugefügt: … |

Going for: a group chat. The title is only the Board, so it never gets cut and you know at once which Board it is. Who and what go in the body. Collapsed, the body's one line shows the sentence but rarely the Dishes.

### Style C: what's new first

| Case | Title | Body |
|---|---|---|
| 1 Dish, 1 Member | Neu in 🍪 Kochclub: Linsen-Dal | Von Ada |
| 3 Dishes, 1 Member | 3 neue Gerichte in 🍪 Kochclub | Von Ada: Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini |
| 3 Dishes, 2 Members | 3 neue Gerichte in 🍪 Kochclub | Von Linus und Ada: Linsen-Dal, Cremige Pilzpasta, … |
| 6 Dishes, 3 Members | 6 neue Gerichte in 🍪 Kochclub | Von Grace, Linus und Ada: … |

Going for: the food is the news. It uses the app's own word „Neu" (the mark on New Dishes), and the title is short and fits collapsed in nearly every case. Who added them comes second. A catch: „in 🍪 Kochclub" uses the Board's name like a place name, with no article. That works for most names („Neu in Pasta-Abende") but sounds odd for a few („Neu in Unser Board").

### Smaller choices that go with any style

**Many Members.** Today every name is listed. Choose:

- **a) All names:** „Grace, Linus, Kati und Ada …" (today). Exact, but long on a busy Board.
- **b) Two names, then a count:** „Grace, Linus und 2 andere …". Stays short however many Members added Dishes.

**Many Dishes in the body.** Today the list of titles is cut after 120 characters with „ …". Choose:

- **a) Cut with „ …"** (today). Simple, but sometimes cuts in the middle of a title.
- **b) Whole titles, then a count:** „Linsen-Dal, Cremige Pilzpasta und 4 weitere". You see how much more there is, and no title is cut in half.

## 2. Email Digest

Each text can be picked on its own.

### Subject

Today: **„Neu auf deinen Boards: 3 Gerichte"** (1: „… 1 Gericht").

- **A) „3 neue Gerichte auf deinen Boards"** (1: „1 neues Gericht auf deinen Boards"). The number comes first, which is what you notice in a list of emails. A sentence, not a label.
- **B) „Neu in 🍪 Kochclub: Linsen-Dal, Cremige Pilzpasta und 1 weiteres"** with one Board; with several, „Neu auf deinen Boards: Linsen-Dal, Cremige Pilzpasta und 4 weitere". Names the food in the subject: the most tempting, but the longest, and the inbox cuts it.
- **C) „3 neue Gerichte in 🍪 Kochclub"** with one Board (the usual case); with several, „3 neue Gerichte auf deinen Boards". Concrete like the push, and reads the same as push Style C.

### Preheader (new: the grey preview line in the inbox)

Today there is none, so the inbox shows the start of the email (see above).

- **A) None** (as today). One text fewer, but the preview repeats the heading and „Board öffnen".
- **B) Who:** „Von Linus und Ada. Schau mal rein!" Personal: your people found something.
- **C) What:** „Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini und mehr". The Dishes themselves, so the preview makes you hungry before you open it.

### Greeting and heading

Today: only the heading **„Neu auf deinen Boards"**, with no greeting.

- **A) Heading only:** „Neu auf deinen Boards" (today). Plain, like a list.
- **B) „Hallo Ada!"** as the heading, then the line „Das ist seit gestern auf deinen Boards dazugekommen:". Personal, with your Username. „Seit gestern" is a little wrong for your first Digest, or after a day without anything new.
- **C) „Guten Abend, Ada!"** as the heading, then the line „Hier ist, was es Neues gibt:". Fits the email arriving in the evening, warm without promising a time span. If you change your Username to something like „ada_92", the greeting uses that too.

### The list for each Board

Today: the Board's emoji and name as a heading, then per Dish **„Linsen-Dal von Ada"**, then a button **„Board öffnen"**.

- **A) As today:** „🍪 Kochclub", „Linsen-Dal von Ada", „Board öffnen". Clear and short.
- **B) With a count, grouped by who:** heading „🍪 Kochclub (3 neu)", then „Ada: Linsen-Dal, Cremige Pilzpasta" and „Linus: Ofengemüse mit Tahini", button „Zum Board". Reads like a short report; better when one person added a lot. Each Dish stays a link.
- **C) Lighter:** heading „🍪 Kochclub", per Dish „Linsen-Dal (Ada)", button „Ansehen". Less text and quick to scan; the button says what you do there.

### Footer

Today: **„Du bekommst diese E-Mail, weil du die tägliche E-Mail in deinen malkochen-Einstellungen eingeschaltet hast."**

- **A) Shorter:** „Du bekommst diese E-Mail, weil du sie in deinen malkochen-Einstellungen eingeschaltet hast." The same message without saying „E-Mail" twice.
- **B) Says how often:** „Die tägliche E-Mail kommt abends, und nur wenn es auf deinen Boards etwas Neues gibt. Du hast sie in deinen malkochen-Einstellungen eingeschaltet." Promises no empty emails: no spam.
- **C) Casual:** „Einmal am Abend, nur wenn's was Neues gibt: So hast du's in malkochen eingestellt." The warmest, but loosest.

### Unsubscribe line

Today: the link **„Ausschalten"** straight after the footer, to Your Settings.

- **A) „Ausschalten"** (today). Short, and the word the switch in Your Settings uses.
- **B) „Keine Lust mehr? Hier ausschalten."** Friendly, and „hier" makes it clear what the link is.
- **C) „Abbestellen"**. The word people look for at the bottom of an email.

(Out of scope here: the link opens Your Settings and needs you signed in; it doesn't unsubscribe in one click.)

## Recommendation (before the choice)

- **Push:** Style C, with two names then a count, and whole titles then a count. It is the shortest collapsed, leads with the food and uses the app's „Neu". If „in 🍪 Kochclub" bothers you, Style B is the safe choice.
- **Subject:** C, to match the push.
- **Preheader:** C, the Dishes.
- **Greeting:** C, „Guten Abend, Ada!".
- **List:** A, as today, with „Zum Board" from B as the button.
- **Footer:** B, so people know it won't come every day for nothing.
- **Unsubscribe:** B, „Keine Lust mehr? Hier ausschalten."

## Chosen (2026-10-18)

The user's picks, now in `app/strings/de.ts`. They also set a rule for every one of these texts: no dashes or hyphens as separators, and no middle dots (·) or similar dots between words.

- **Push:** Style A. Up to three names, then „Grace, Linus und 2 andere". Whole titles, then „und 4 weitere" („und 1 weiteres" for one).
  - One Dish: „Ada hat Linsen-Dal hinzugefügt" over „🍪 Kochclub".
  - Several: „Ada hat 3 Gerichte hinzugefügt" over „🍪 Kochclub: Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini".
- **Subject:** C. „3 neue Gerichte in 🍪 Kochclub" with one Board, „3 neue Gerichte auf deinen Boards" with several, „1 neues Gericht …" for one.
- **Preheader:** B. „Von Linus und Ada. Schau mal rein!" (with four or more names: „Von Grace, Linus und 2 andere. Schau mal rein!").
- **Greeting:** B. „Hallo Ada!" and below it „Das ist seit gestern auf deinen Boards dazugekommen:". Someone who hasn't picked a Username yet gets „Hallo!".
- **List:** A, as today, with the button „Board öffnen".
- **Footer:** C. „Einmal am Abend, nur wenn’s was Neues gibt: So hast du’s in malkochen eingestellt."
- **Unsubscribe:** B. „Keine Lust mehr? Hier ausschalten." „Hier ausschalten" is the footer's link to Your Settings, where the daily email is switched off.
- The plain-text part of the email lost its „--" line above the footer.
