# malkochen

A shared board for collecting food people find online (TikTok, Instagram, food blogs) and organising what they want to cook and have already cooked. Sibling app to malmachen.

## Language

### Boards and people

**Board**:
A named space (with an emoji) of Columns holding Dishes. A user can belong to many Boards; a Board with more than one Member is simply a shared Board.
_Avoid_: List, workspace, personal board

**Board Switcher**:
The Board's emoji and name at the top of a Board, which lists all of a user's Boards to switch between and starts a new one.
_Avoid_: Board picker, board menu, dropdown

**Board Settings**:
One Board's Columns, Members and Invite Link, which its Members change for everyone, some parts only its Owner ("Board-Einstellungen").
_Avoid_: Board config, board options

**Your Settings**:
One user's own Username, Profile Picture, notifications, Darstellung, Sprache and shortcuts, the same on every Board ("Deine Einstellungen").
_Avoid_: User settings, account, profile

**Tour**:
A short walk through a Board, told step by step by Topfbert, pointing at what a user needs first ("Rundgang"). Every user gets it once, the first time they open any Board, whether their own or one they joined, and can start it again from Your Settings. A new version of the Tour is shown once again to everyone.
_Avoid_: Onboarding, walkthrough, coach marks, tutorial, intro

**Column**:
A named, ordered stage on a Board (default: Ideen, Diese Woche, Gekocht, written in the language of whoever creates the Board, and the same for every Member after that). Members can rename, add, reorder and delete Columns.
_Avoid_: Lane, list, status

**Column Subtitle**:
A short line under a Column's name saying what it's for (default: "Worauf hast du Lust?" for Ideen, "Das steht an." for Diese Woche). Members can set or clear it; the Gekocht Column's is fixed ("Schon geschafft!"), even when it's renamed, and shown in each viewer's language.
_Avoid_: Description, tagline

**Member**:
A user who belongs to a Board. What each Member may do there is set by their Permissions.
_Avoid_: Collaborator, participant

**Permissions**:
What one Member may do on a Board, each switched on or off for them by the Owner ("Rechte"): add Dishes, edit them, move them (including into the Gekocht Column), archive them, edit Columns, share the Invite Link, comment and vote, and change the Board's name and emoji. The Owner always has all of them, and a Member can always edit and archive the Dishes they added themselves. An action a Member may not take isn't shown to them.
_Avoid_: Roles, rights, access level

**Default Permissions**:
The Permissions a Member gets on joining a Board, chosen by its Owner; everything is allowed until the Owner changes them.
_Avoid_: Standard role, guest role

**Deleted Account**:
A user who deleted their account themselves. What they added to Boards they shared with others (Dishes, Cookings, Comments, Votes) stays, shown as "Gelöschtes Konto"; their Boards with others pass to the longest-standing Member, and Boards only they belonged to are deleted.
_Avoid_: Former member, anonymous user

**Username**:
The name a user picks for themselves and the only name malkochen shows of them, written plainly ("Chris", not "@chris"). Unique across the whole app regardless of case, 2–24 letters, digits, `_`, `.` or `-`. A user can change it; the old one is free for others right away. The name from their Google account is kept but never shown.
_Avoid_: Display name, handle, nickname, Google name

**Profile Picture**:
The round picture that shows who a Member is, e.g. on the Dishes they added: a picture they uploaded themselves in their settings, else their Google photo, else their initial. Signing in again never replaces one they uploaded; removing it brings the Google photo back.
_Avoid_: Avatar (except in code), profile photo, user image

**Owner**:
The one Member of a Board who can delete it, remove Members, set their Permissions, reset the Invite Link, delete Archived Dishes for good and hand ownership to another Member. Initially whoever created the Board.
_Avoid_: Admin, creator

**Invite Link**:
A shareable link that lets any signed-in user become a Member of a Board, readable like its Address: `/invite/kochclub-7fk2qm9xh3tdz8wpc`, the Board's name as in its Address, then a secret. Only the secret counts, so renaming the Board doesn't break a link sent before; resetting it does.
_Avoid_: Share link, invitation

**Address**:
Where a Board or Dish opens in the app, readable instead of an id: a Board at `/b/kochclub`, made from its name (umlauts as ae/oe/ue, ß as ss, emoji dropped) and unique across all Boards (`kochclub-2`); a Dish at `/b/kochclub/omas-linsensuppe-3f9k`, its title then its short code, which alone identifies it. Renaming gives a new Address; every old one (and the old id addresses) keeps forwarding to the current one. A non-Member sees the same "not found" as for an Address no Board has.
_Avoid_: URL, slug (except in code), permalink

**Allowlist**:
The fixed set of email addresses allowed to sign up for malkochen while Open Sign-up is off. Anyone who already has an account can always sign in. Being on it gives access to the app, not to any Board.
_Avoid_: Whitelist, beta list

**Open Sign-up**:
The Operator's switch on the Admin Page ("Anmeldung offen") that lets anyone sign up. Switched off again, only the Allowlist can sign up, while everyone who has an account by then still signs in.
_Avoid_: Public registration, beta

### Dishes

**Dish**:
One piece of food someone wants to cook, saved to a Board, usually from a Source. It has a title and an image, and records who added it and when.
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
One occasion a Dish was cooked, with a date and who recorded it. Recorded each time the Dish is moved into the Gekocht Column, and by "Gekocht ✓" on a Dish that is already there; not when its Column is deleted and its Dishes are moved there instead. A Dish's Cookings appear in its Dish History and are kept when it moves out again.
_Avoid_: Done entry, log entry

**Achievement Level**:
How established a Dish is, by its number of Cookings: Ausprobiert (1), Wird Liebling (3), Stammgericht (5), Klassiker (10). It goes down again when Cookings are deleted.
_Avoid_: Badge, rank, streak

**Klassiker**:
A Dish with 10 or more Cookings, the top Achievement Level. Its 10th Cooking is celebrated once.
_Avoid_: Milestone (except for the celebration's clip), favourite

**Comment**:
A Member's message on a Dish, shown in the Dish's history with who wrote it and when. Its author can edit it (then marked "bearbeitet") or delete it; the Owner can delete any.
_Avoid_: Note, message, reply

**Vote**:
A Member's thumbs up or thumbs down on a Cooked Dish. Any Member can give one, one per Dish, and change or take it back.
_Avoid_: Rating, like, review, score

**Dish History**:
Everything that happened to a Dish, at the bottom of its detail like a chat ("Verlauf"), oldest first: when it was added, its Cookings, Votes and Comments. Moves aren't part of it.
_Avoid_: Cooking History, timeline, activity feed, log

**Archived Dish**:
A Dish taken off its Board ("Archivieren"), kept in the Board's Archive ("Archiv" in Board Settings) for 30 days. Members can restore it until then; the Owner can delete it for good sooner. After 30 days it's gone, with its images.
_Avoid_: Deleted Dish, trash, bin

**Archived Board**:
A Board its Owner deleted, kept under "Archiv" in the Owner's Board Switcher for 30 days. The Owner can restore it, with its Members, until then or delete it for good sooner.
_Avoid_: Deleted Board

### Running malkochen

**Operator**:
The one person who runs malkochen, and the only one who can open the Admin Page.
_Avoid_: Admin, superuser, Owner (an Owner owns one Board)

**Admin Page**:
The Operator's page of figures on how malkochen is used (Dishes added, moves, Cookings, Comments, active users and Boards, sign-ups), reached from their Your Settings. It shows counts only, never other people's Dish titles or Comments.
_Avoid_: Dashboard, admin panel, admin console

**Event Log**:
What happens on Boards, recorded for the Admin Page to count: an event each time a Dish is added, moved, archived, restored or deleted for good, a Cooking is recorded, deleted or restored, a Comment is written, edited, deleted or restored, a Board is created, archived, restored or deleted for good, and a Member joins, leaves or is removed. Each says when, what kind, which Board, Dish and user, never any content (no titles, Comments or names), and is kept indefinitely. Shown nowhere but as counts on the Admin Page.
_Avoid_: Activity feed, audit log, Dish History

**Changelog**:
The page listing what changed for users in each Version ("Was ist neu"), newest first, with what's done but not yet in a Version on top ("Gerade neu"). Only what users notice goes in.
_Avoid_: Release notes, updates, news

**Version**:
malkochen's number, starting at 1.0.0. Each finished spec, and each batch of smaller changes, is a patch (1.0.1, 1.0.2, …); a minor Version (1.1.0) only when the user calls a feature big enough for one.
_Avoid_: Release, build
