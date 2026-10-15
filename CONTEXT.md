# malkochen

A shared board for collecting food people find online (TikTok, Instagram, food blogs) and organising what they want to cook and have already cooked. Sibling app to malmachen.

## Language

### Boards and people

**Board**:
A named space (with an emoji) of Columns holding Dishes. A user can belong to many Boards; a Board with more than one Member is simply a shared Board.
_Avoid_: List, workspace, personal board

**Column**:
A named, ordered stage on a Board (default: Ideen, Diese Woche, Gekocht). Members can rename, add, reorder and delete Columns.
_Avoid_: Lane, list, status

**Column Subtitle**:
A short line under a Column's name saying what it's for (default: "Worauf hast du Lust?" for Ideen, "Das steht an." for Diese Woche). Members can set or clear it; the Gekocht Column's is fixed ("Schon geschafft!"), even when it's renamed.
_Avoid_: Description, tagline

**Member**:
A user who belongs to a Board. All Members can add, edit, move and delete Dishes and edit Columns.
_Avoid_: Collaborator, participant

**Username**:
The name a user picks for themselves and the only name malkochen shows of them, written plainly ("Chris", not "@chris"). Unique across the whole app regardless of case, 2–24 letters, digits, `_`, `.` or `-`. A user can change it; the old one is free for others right away. The name from their Google account is kept but never shown.
_Avoid_: Display name, handle, nickname, Google name

**Profile Picture**:
The round picture that shows who a Member is, e.g. on the Dishes they added: a picture they uploaded themselves in their settings, else their Google photo, else their initial. Signing in again never replaces one they uploaded; removing it brings the Google photo back.
_Avoid_: Avatar (except in code), profile photo, user image

**Owner**:
The one Member of a Board who can delete it, remove Members, reset the Invite Link and hand ownership to another Member. Initially whoever created the Board.
_Avoid_: Admin, creator

**Invite Link**:
A shareable link that lets a signed-in user on the Allowlist become a Member of a Board, readable like its Address: `/invite/kochclub-7fk2qm9xh3tdz8wpc`, the Board's name as in its Address, then a secret. Only the secret counts, so renaming the Board doesn't break a link sent before; resetting it does.
_Avoid_: Share link, invitation

**Address**:
Where a Board or Dish opens in the app, readable instead of an id: a Board at `/b/kochclub`, made from its name (umlauts as ae/oe/ue, ß as ss, emoji dropped) and unique across all Boards (`kochclub-2`); a Dish at `/b/kochclub/omas-linsensuppe-3f9k`, its title then its short code, which alone identifies it. Renaming gives a new Address; every old one (and the old id addresses) keeps forwarding to the current one. A non-Member sees the same "not found" as for an Address no Board has.
_Avoid_: URL, slug (except in code), permalink

**Allowlist**:
The fixed set of email addresses allowed to sign in to malkochen at all. Being on the Allowlist gives access to the app, not to any Board.
_Avoid_: Whitelist, beta list

### Dishes

**Dish**:
One piece of food someone wants to cook, saved to a Board, usually from a Source. It has a title, an image, an optional note, and records who added it and when.
_Avoid_: Recipe, post, entry, card

**Source**:
The link a Dish came from. Optional: a Dish can also be added from memory or a cookbook without one.
_Avoid_: URL, post, origin

**Creator**:
The account, channel or blog that published a Source (e.g. a TikTok handle or a food blog's name), shown with the Dish when the Source names one. Not to be confused with the Member who added the Dish.
_Avoid_: Uploader, author, owner

**Supported Source**:
A kind of Source malkochen fully supports, with an image reliably found: TikTok video, Instagram Reel, Instagram post, YouTube Short, Pinterest Pin, food blog page. Each also yields a Suggested Title and a Creator whenever the Source shows one; when it doesn't, the Dish is titled by hand. Any other link is still accepted, on a best-effort basis.
_Avoid_: Platform, integration

**Suggested Title**:
The title proposed from the Source when a Dish is being added, which the user can edit before saving. One that the Source writes mostly in capitals is proposed in normal case ("CREMIGE PILZPASTA" becomes "Cremige Pilzpasta"); titles typed by hand stay as written.
_Avoid_: Inferred title, auto title

**New Dish**:
A Dish another Member added to a Board since you last opened that Board (or joined it, if you never opened it), including ones added while you have it open. Marked "Neu" until you open the Board again; coming back to the app after half an hour or more away counts as opening it.
_Avoid_: Unread, notification

**Push Notification**:
A notification on a Member's device that other Members added Dishes to one of their Boards, sent only to devices the Member turned push notifications on for in their settings (off by default). One per Board, replaced as more Dishes come in: it counts the Dishes others added since the Member last had the Board open and names who added them; about one Dish, tapping it opens that Dish, else the Board. Nothing but adding a Dish sends one.
_Avoid_: Alert, reminder

**Email Digest**:
One email in the evening ("Tägliche E-Mail") listing the Dishes other Members added to a user's Boards since the last one, each with its Board and who added it, sent only to users who switched it on in their settings (off by default; one switch for all their Boards and devices). Nothing new, no email; a Dish is never listed twice, nor one added to a Board before they joined it.
_Avoid_: Newsletter, summary, report

**Placeholder Image**:
One of a fixed set of illustrations of vegan dishes, used as a Dish's image when the Source provides no thumbnail or the user prefers one. Every Dish keeps one, shown whenever its other image can't be.
_Avoid_: Default image, fallback image, stock photo

**Own Photo**:
A photo a Member uploads as a Dish's image ("Eigenes Foto"), instead of the Source's image or a Placeholder Image. Any Member can replace it again.
_Avoid_: Upload, custom image, user image

**Focus Point**:
The part of a Dish's Source image or Own Photo that shows wherever a frame crops it (the card, the detail, search results). A Member shifts the image to set it ("Ausschnitt"), for all Members; a new image starts in the centre. A Placeholder Image has none.
_Avoid_: Crop, zoom, image position

**Gekocht Column**:
The one Column per Board that marks Dishes as Cooked. It can be renamed and moved but not deleted. A Board always keeps at least one other Column: new Dishes go to the first Column that isn't the Gekocht Column.
_Avoid_: Done column, archive

**Cooked**:
A Dish is Cooked once it has been moved into the Gekocht Column at least once.
_Avoid_: Done, finished, completed

**Cooking**:
One occasion a Dish was cooked, with a date, an optional note and who recorded it. Recorded each time the Dish is moved into the Gekocht Column, and by "Gekocht ✓" on a Dish that is already there; not when its Column is deleted and its Dishes are moved there instead. A Dish's Cookings form its Cooking History, which is kept when it moves out again.
_Avoid_: Done entry, log entry

**Achievement Level**:
How established a Dish is, by its number of Cookings: Ausprobiert (1), Wird Liebling (3), Stammgericht (5), Klassiker (10). It goes down again when Cookings are deleted.
_Avoid_: Badge, rank, streak

**Klassiker**:
A Dish with 10 or more Cookings, the top Achievement Level. Its 10th Cooking is celebrated once.
_Avoid_: Milestone (except for the celebration's clip), favourite
