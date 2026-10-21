# Comment and Vote wordings: variations to choose from

For #351 (spec #322, user story 18). Every new text a Push Notification or the Email Digest needs once Comments and Votes count too, with 2–3 German variations each and what each one is going for. They build on what was chosen in #325 (`docs/reviews/push-and-digest-wordings.md`): the push in style A (who did it first, the Board in the body), up to three names then „und 2 andere", and no dashes, hyphens or middle dots as separators. Pick one per text (or a mix, or ask for more); the picks go into the issue's comments and then into `app/strings/de.ts`, `en.ts` and `it.ts`. **The user's choice is at the end, under „Chosen".**

The examples use the Board „🍪 Kochclub", the Members Ada, Linus and Grace, the Dishes Linsen-Dal, Cremige Pilzpasta and Ofengemüse mit Tahini, and Ada's Comment „Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!".

## What stays as it is

- A push about new Dishes only reads exactly as chosen in #325: „Ada hat Linsen-Dal hinzugefügt" over „🍪 Kochclub".
- One notification per Board, replaced as more comes in, counting everything by others since you last had the Board open. Edited Comments and changed Votes send nothing.
- About one Dish (however many Comments and Votes on it), tapping it opens that Dish at its Verlauf. About several Dishes, it opens the Board.
- The Digest's preheader („Von Linus und Ada. Schau mal rein!"), greeting, intro line („Das ist seit gestern auf deinen Boards dazugekommen:"), „Board öffnen", footer and unsubscribe line. The preheader's names now include who commented and voted; the intro reads right for Comments too.

## 1. Push Notification

### 1a. One Comment on one Dish

| | Title | Body |
|---|---|---|
| **A) Who, and what they wrote** | Ada hat Linsen-Dal kommentiert | 🍪 Kochclub: Hab ich gestern nachgekocht, mit doppelt Ingwer. Super! |
| **B) Who, no content** | Ada hat Linsen-Dal kommentiert | 🍪 Kochclub |
| **C) What's new first** | Neuer Kommentar zu Linsen-Dal | Ada in 🍪 Kochclub: Hab ich gestern nachgekocht, mit doppelt Ingwer. Super! |

- A: like a chat message. You see the Comment without opening anything and can tell whether it needs you. A long Comment is cut to fit with „ …" (whole words, never inside an emoji).
- B: the same title, but you have to open it to read the Comment. Nothing private sits on the lock screen.
- C: leads with „Kommentar", so it's clear at a glance this isn't a new Dish. Who moves to the body.

### 1b. One Vote on one Dish

| | Title | Body |
|---|---|---|
| **A) The Verlauf's words** | Ada fand Linsen-Dal gut 👍 | 🍪 Kochclub |
| | Ada fand Linsen-Dal nicht so gut 👎 | 🍪 Kochclub |
| **B) Literal** | Ada hat Linsen-Dal einen Daumen hoch gegeben | 🍪 Kochclub |
| **C) The thumb first** | 👍 von Ada für Linsen-Dal | 🍪 Kochclub |

- A: says it as the Dish's Verlauf already does („Ada fand es gut"), so push and app speak the same. Soft on a thumbs down.
- B: names the button you pressed. Long: collapsed, Android cuts it before „gegeben".
- C: the shortest; the thumb is the news. Reads more like a counter than a sentence.

### 1c. Several things on one Dish

For example Ada commented and Linus gave a thumbs up, both on Linsen-Dal. Tapping it opens Linsen-Dal.

| | Title | Body |
|---|---|---|
| **A) Who, then the counts** | Ada und Linus zu Linsen-Dal | 🍪 Kochclub: 1 Kommentar, 1 Daumen |
| **B) The Dish as the headline** | Neues bei Linsen-Dal | 🍪 Kochclub: 1 Kommentar und 1 Daumen von Ada und Linus |
| **C) The latest one, plus a count** | Linus fand Linsen-Dal gut 👍 | 🍪 Kochclub: und 1 Kommentar von Ada |

- A: style A's who first, kept short.
- B: matches the card's „Neues im Verlauf"; who comes second.
- C: reads like 1a or 1b for the newest thing, the rest counted below. Most natural with two things, clumsy with five.

### 1d. Comments and Votes on several Dishes, and together with new Dishes

Tapping it opens the Board. The example: Ada added 2 Dishes, Ada and Linus wrote 3 Comments, Linus gave 1 thumbs up.

| | Case | Title | Body |
|---|---|---|---|
| **A) Who, then everything counted** | only Comments and Votes | Ada und Linus: 3 Kommentare, 1 Daumen | 🍪 Kochclub: zu Linsen-Dal und Cremige Pilzpasta |
| | with new Dishes | Ada und Linus: 2 neue Gerichte, 3 Kommentare, 1 Daumen | 🍪 Kochclub |
| **B) The Dishes stay the headline** | only Comments and Votes | Ada und Linus haben 3 Kommentare geschrieben | 🍪 Kochclub: zu Linsen-Dal und Cremige Pilzpasta. Dazu 1 Daumen. |
| | with new Dishes | Ada hat 2 Gerichte hinzugefügt | 🍪 Kochclub: Linsen-Dal, Cremige Pilzpasta. Dazu 3 Kommentare und 1 Daumen. |
| **C) The counts as the headline** | only Comments and Votes | 3 Kommentare und 1 Daumen | 🍪 Kochclub: von Ada und Linus |
| | with new Dishes | 2 neue Gerichte, 3 Kommentare, 1 Daumen | 🍪 Kochclub: von Ada und Linus |

- A: one shape for every case, who first as chosen in #325. With everything new the title gets long (collapsed, Android shows about „Ada und Linus: 2 neue Gerichte, 3 Ko…").
- B: the push about new Dishes stays exactly as chosen in #325, and Comments and Votes are added in the body. Only Votes: „Ada und Linus haben 2 Daumen gegeben". The headline names one kind of thing, so it never gets long, but it's three title shapes instead of one.
- C: the spec's own example („2 neue Gerichte, 3 Kommentare, 1 …"). Short and the same in every case, but it breaks with #325's who first.

### Smaller choices that go with any style

**The word for Votes in a count.** The app says „Daumen" (the buttons „Daumen hoch" and „Daumen runter", the card's „2× Daumen hoch").

- **a) „Daumen":** „1 Daumen", „3 Daumen". The app's word; the plural sounds a little odd.
- **b) Up and down apart:** „2 Daumen hoch, 1 Daumen runter". Says what people thought, but long.
- **c) The thumbs themselves:** „2 👍 1 👎". The shortest and says what people thought. Emoji in a count reads more casual.

**Which Comments a count includes.** A Comment deleted before the push goes out is left out anyway (the spec). Nothing to choose; listed so it isn't missed.

## 2. Email Digest

A new part in each Board's card, after its new Dishes (a Board with only Comments and Votes has only that part).

### Its heading

- **A) „Kommentare und Daumen"**. Says what's in it.
- **B) „Im Verlauf"**. The app's word for where Comments and Votes live, so it connects.
- **C) No heading:** the lines follow the Dishes after a thin line. The lightest, but on a busy Board it runs together.

### The lines

Each Dish is a link to its Verlauf. The Comment's first ~100 characters, whole words, then „ …".

| | Comment | Vote |
|---|---|---|
| **A) One sentence each** | Ada zu Linsen-Dal: „Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!“ | Linus fand Cremige Pilzpasta gut 👍 |
| **B) Grouped by Dish** | **Linsen-Dal**, then „Ada: „Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!““ | **Cremige Pilzpasta**, then „Linus: 👍“ |
| **C) The emoji first** | 💬 Linsen-Dal (Ada): „Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!“ | 👍 Cremige Pilzpasta (Linus) |

- A: reads like the Verlauf and the push in 1b A; each line stands alone.
- B: tidiest when several people talked about one Dish; the Dish isn't repeated.
- C: quick to scan, close to how the new Dishes look („Linsen-Dal von Ada"), Comment and Vote told apart by the emoji.

### Subject

Today, with new Dishes: „3 neue Gerichte in 🍪 Kochclub" (several Boards: „… auf deinen Boards").

| | only Comments and Votes | with new Dishes too |
|---|---|---|
| **A) Dishes first** | 3 Kommentare und 1 Daumen in 🍪 Kochclub | 3 neue Gerichte in 🍪 Kochclub (as today) |
| **B) Everything counted** | 3 Kommentare und 1 Daumen in 🍪 Kochclub | 3 neue Gerichte, 2 Kommentare und 1 Daumen in 🍪 Kochclub |
| **C) „Neues"** | Neues in 🍪 Kochclub | 3 neue Gerichte in 🍪 Kochclub (as today) |

- A: the subject only changes when there are no Dishes; Dishes are what makes people open it.
- B: the whole evening in the subject. The inbox cuts it on a phone.
- C: a short, unspecific subject when it's only talk; the email says the rest.

## 3. The settings hints

They say what each switch sends, and both say „Gerichte" only today.

**Push Notifications** (today: „Auf diesem Gerät, wenn jemand ein Gericht zu einem deiner Boards hinzufügt.")

- **A)** „Auf diesem Gerät, wenn jemand auf deinen Boards ein Gericht hinzufügt, kommentiert oder einen Daumen gibt."
- **B)** „Auf diesem Gerät, wenn sich auf deinen Boards was tut: neue Gerichte, Kommentare und Daumen."

**Email Digest** (today: „Abends an deine E-Mail-Adresse, wenn andere neue Gerichte zu deinen Boards hinzugefügt haben. Für alle deine Geräte.")

- **A)** „Abends an deine E-Mail-Adresse, wenn andere auf deinen Boards Gerichte hinzugefügt, kommentiert oder Daumen gegeben haben. Für alle deine Geräte."
- **B)** „Abends an deine E-Mail-Adresse, mit den neuen Gerichten, Kommentaren und Daumen auf deinen Boards. Nur wenn’s was gibt. Für alle deine Geräte."

## Recommendation (before the choice)

- **1a:** A, the Comment in the body. It's what the spec asks of the Digest too: you see whether it needs you.
- **1b:** A, the Verlauf's „fand es gut".
- **1c:** A.
- **1d:** B. It keeps #325's push untouched and every title short.
- **Votes in a count:** a) „Daumen", the app's word.
- **Digest heading:** B, „Im Verlauf".
- **Digest lines:** A, the same sentences as the push.
- **Subject:** A, Dishes first.
- **Hints:** A for both: plain, and they name all three things.

## Chosen

(Filled in after the user's choice.)
