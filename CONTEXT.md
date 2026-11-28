# malkochen

A shared board for collecting food people find online (TikTok, Instagram, food blogs) and organising what they want to cook and have already cooked. Sibling app to malmachen.

## Language

### Boards and people

**Board**:
A named space (with an emoji) of Columns holding Dishes. A user can belong to many Boards; a Board with more than one Member is simply a shared Board.
_Avoid_: List, workspace, personal board

**Board Version**:
A number that every change to what a Board's Members see on it moves on (Dishes, Cookings, Votes, Comments, Columns, Week Plan, Shopping List, Members, name, emoji, Invite Link); what one Member has read or opened never moves it. An open Board asks only for it, and loads the whole Board when it moved (ADR 0008). Never shown to users, and not malkochen's Version.
_Avoid_: Revision, etag, board timestamp

**Unsent Change**:
A change a Member made to a Board without a connection (or while malkochen didn’t answer), already on their own screen but not yet with the other Members ("Noch nicht gesendet"). It arrives once the device is back online, dated when it was made, and is applied to the Board as it is by then; one that no longer can be is dropped and the Member told which. Kept on the device until it arrives, and only ever sent as the user who made it (ADR 0012).
_Avoid_: Pending change, queued change, outbox, draft, sync

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
A short walk through a Board, told step by step by Topfbert ("Rundgang"). Every user gets it once, the first time they open any Board, and can start it again from Your Settings; a new version of the Tour is shown once again to everyone (ADR 0006).
_Avoid_: Onboarding, walkthrough, coach marks, tutorial, intro

**Column**:
A named, ordered stage on a Board (default: Ideen, Diese Woche, Gekocht, written in the language of whoever creates the Board). Members can rename, add, reorder and delete Columns.
_Avoid_: Lane, list, status

**Column Subtitle**:
A short line under a Column's name saying what it's for (default: "Worauf hast du Lust?" for Ideen, "Das steht an." for Diese Woche). The Gekocht Column's is fixed ("Schon geschafft!"), even when it's renamed, and shown in each viewer's language.
_Avoid_: Description, tagline

**Week Plan**:
A Board's week, Monday to Sunday, on which its Members put Dishes for the days they want to cook them ("Wochenplan"). One per Board, and a view of its own beside the Columns: planning a Dish never moves it between Columns, a day passing records no Cooking, and nothing about it shows on the Dish's card or detail (ADR 0014).
_Avoid_: Calendar, schedule, meal plan, planner

**Planned Dish**:
One Dish on one day of a Week Plan, optionally with the Member who'll cook it ("Wer kocht"). It shows as cooked when its Dish has a Cooking dated that day; it goes with its Dish when it's archived, is dropped when the Dish moves to another Board, and isn't part of a Copy or the Dish History. Planning it needs the Permission to move Dishes.
_Avoid_: Plan entry, slot, meal

**Shopping List**:
A Board's list of what to buy ("Einkaufsliste"), one per Board and a view of its own beside the Columns and the Week Plan. Members put a Dish's Ingredients on it ("Auf die Einkaufsliste") or every Dish planned from today to that week's Sunday, and type Shopping Items of their own. It never adds amounts up, and nothing about it shows on a Dish, in the Dish History, in Push Notifications or the Email Digest (ADR 0015).
_Avoid_: Grocery list, cart, basket

**Shopping Item**:
One line on a Shopping List ("Eintrag"): copied from an Ingredient, grouped under its Dish, or typed by a Member under "Sonstiges". Once copied it no longer follows the Recipe. Ticked off, it stays crossed out until unticked or "Erledigte entfernen" clears every ticked one.
_Avoid_: Ingredient (that's the Recipe's line), product, entry

**Member**:
A user who belongs to a Board. What each Member may do there is set by their Permissions.
_Avoid_: Collaborator, participant

**Permissions**:
What one Member may do on a Board, each switched on or off for them by the Owner ("Rechte"): add, edit, move (including into the Gekocht Column and on the Week Plan) and archive Dishes, edit Columns, share the Invite Link, comment and vote, change the Board's name and emoji. The Owner always has all of them, a Member can always edit and archive the Dishes they added, and an action a Member may not take isn't shown to them.
_Avoid_: Roles, rights, access level

**Default Permissions**:
The Permissions a Member gets on joining a Board, chosen by its Owner; everything is allowed until the Owner changes them.
_Avoid_: Standard role, guest role

**Deleted Account**:
A user who deleted their account themselves. What they added to Boards shared with others stays, shown as "Gelöschtes Konto"; their Boards with others pass to the longest-standing Member, and Boards only they belonged to are deleted.
_Avoid_: Former member, anonymous user

**Username**:
The name a user picks for themselves and the only name malkochen shows of them, written plainly ("Chris", not "@chris"). Unique across the app regardless of case, 2–24 letters, digits, `_`, `.` or `-`; the name from their Google account is kept but never shown.
_Avoid_: Display name, handle, nickname, Google name

**Profile Picture**:
The round picture that shows who a Member is: one they uploaded themselves, else their Google photo, else their initial. Signing in again never replaces an uploaded one.
_Avoid_: Avatar (except in code), profile photo, user image

**Owner**:
The one Member of a Board who can delete it, remove Members, set their Permissions, reset the Invite Link, delete Archived Dishes for good and hand ownership to another Member. Initially whoever created the Board.
_Avoid_: Admin, creator

**Invite Link**:
A shareable link that lets any signed-in user become a Member of a Board: `/invite/kochclub-7fk2qm9xh3tdz8wpc`, the Board's name as in its Address, then a secret. Only the secret counts, so renaming the Board doesn't break it; resetting it does.
_Avoid_: Share link, invitation

**Address**:
Where a Board or Dish opens in the app, readable instead of an id: a Board at `/b/kochclub` (from its name, unique across all Boards: `kochclub-2`), a Dish at `/b/kochclub/omas-linsensuppe-3f9k` (its title then its short code, which alone identifies it). Every old Address keeps forwarding to the current one, and a non-Member sees the same "not found" as for an Address no Board has.
_Avoid_: URL, slug (except in code), permalink

**Allowlist**:
The fixed set of email addresses allowed to sign up while Open Sign-up is off. Anyone who already has an account can always sign in, and being on it gives access to the app, not to any Board.
_Avoid_: Whitelist, beta list

**Open Sign-up**:
The Operator's switch on the Admin Page ("Anmeldung offen") that lets anyone sign up. Switched off again, only the Allowlist can sign up.
_Avoid_: Public registration, beta

### Dishes

**Dish**:
One piece of food someone wants to cook, saved to a Board, usually from a Source. It has a title and an image, and records who added it and when.
_Avoid_: Recipe (that's what a Dish holds), post, entry, card

**Source**:
The link a Dish came from. Optional: a Dish can also be added without one.
_Avoid_: URL, post, origin

**Creator**:
The account, channel or blog that published a Source, shown with the Dish when the Source names one. Not the Member who added the Dish.
_Avoid_: Uploader, author, owner

**Supported Source**:
A kind of Source malkochen fully supports, with an image reliably found: TikTok video, Instagram Reel, Instagram post, YouTube Short, Pinterest Pin, food blog page. Each also yields a Suggested Title, a Creator and a Caption whenever the Source shows one, else the Dish is titled by hand; any other link is accepted on a best-effort basis.
_Avoid_: Platform, integration

**Suggested Title**:
The title proposed from the Source when a Dish is being added, which the user can edit before saving. One written mostly in capitals is proposed in normal case; when the Source shows none, the Dish is titled after the Source ("TikTok von @mara.kocht", "TikTok-Video").
_Avoid_: Inferred title, auto title

**Caption**:
The text a Source shows with its post, found when the Dish is added and shown, folded, in the Dish's detail. It's the Source's text, so no Member edits it; search finds Dishes by it.
_Avoid_: Description (that's a Column Subtitle), note, post text

**Recipe**:
What a Dish says about how it's made ("Rezept"): its Ingredients and its Steps. Members who may edit the Dish change it, a Copy takes it along, and the Dish Link's own page doesn't show it. Changing it isn't part of the Dish History.
_Avoid_: Recipe for the Dish itself, instructions, method

**Ingredient**:
One line of a Recipe, as plain text the way it was written ("200 g Mehl"). malkochen doesn't know its amount or unit.
_Avoid_: Item, product, component

**Step**:
One thing to do in a Recipe, as plain text, in a numbered order ("Schritt").
_Avoid_: Instruction, direction, stage

**Recipe Finder**:
malkochen finding a Dish's Recipe by itself ("Rezeptfinder"), from a food blog's recipe, the Caption or a page the Caption links to. Only for the few users the Operator switched it on for (ADR 0013); it takes what's written, adds nothing of its own, never replaces a Recipe that has anything in it, and says "Kein Rezept gefunden" when it finds nothing.
_Avoid_: Allowlist (that's for signing up), AI recipe, auto recipe, import

**Dish Link**:
A link to one Dish that anyone can open, signed in or not, to see its image, title, Creator and Source and copy it to a Board of their own. It ends in a secret, and stops working once the Dish is archived.
_Avoid_: Share link (that's an Invite Link), public link, permalink

**Copy**:
A new Dish made from another one ("Kopieren"), through its Dish Link or into another of one's own Boards. It takes the title, image (an Own Photo too, with its Focus Point), Source, Creator, Caption and Recipe, but no Cookings, Comments or Votes, and counts as added by whoever copied it.
_Avoid_: Duplicate, clone

**New Dish**:
A Dish another Member added to a Board since you last opened that Board, marked "Neu" until you open it again. Coming back to the app after half an hour or more counts as opening it; opening it without a connection doesn’t.
_Avoid_: Unread, notification

**Push Notification**:
A notification on a Member's device that others added Dishes, Comments or Votes on one of their Boards, sent only to devices they turned it on for (off by default). One per Board, replaced as more comes in. Editing a Comment or changing a Vote sends none, and nothing is sent about one's own, Archived Dishes or deleted Comments.
_Avoid_: Alert, reminder

**Notification Prompt**:
Topfbert asking a user, on a Board, to switch on Push Notifications (installed app only) or the Email Digest, with "Einschalten" and "Später". Each is asked at most once every 30 days, never two within 48 hours, never in the same visit as the Tour or the Changelog Popup, and not before a new user's second day.
_Avoid_: Reminder, nag, banner

**Email Digest**:
One email in the evening ("Tägliche E-Mail") listing the Dishes, Comments and Votes others added on a user's Boards since the last one ("Im Verlauf"), sent only to users who switched it on (off by default). Nothing new, no email; nothing is listed twice, nor one's own, nor anything on an Archived Dish or a deleted Comment.
_Avoid_: Newsletter, summary, report

**Placeholder Image**:
One of a fixed set of illustrations of vegan dishes (ADR 0004), used as a Dish's image when the Source provides none or the user prefers one. Every Dish keeps one, shown whenever its other image can't be.
_Avoid_: Default image, fallback image, stock photo

**Own Photo**:
A photo a Member uploads as a Dish's image ("Eigenes Foto"). Any Member can replace it again.
_Avoid_: Upload, custom image, user image

**Focus Point**:
The part of a Dish's Source image or Own Photo that shows wherever a frame crops it ("Ausschnitt"), set by a Member for all Members; a new image starts in the centre. A Placeholder Image has none.
_Avoid_: Crop, zoom, image position

**Gekocht Column**:
The one Column per Board that marks Dishes as Cooked. It can be renamed and moved but not deleted, and a Board always keeps at least one other Column: new Dishes go to the first Column that isn't the Gekocht Column.
_Avoid_: Done column, archive

**Cooked**:
A Dish is Cooked once it has been moved into the Gekocht Column at least once.
_Avoid_: Done, finished, completed

**Cooking**:
One occasion a Dish was cooked, with a date and who recorded it. Recorded each time the Dish is moved into the Gekocht Column and by "Gekocht ✓" on a Dish already there, not when its Column is deleted into the Gekocht Column (ADR 0003). Kept when the Dish moves out again.
_Avoid_: Done entry, log entry

**Achievement Level**:
How established a Dish is, by its number of Cookings: Ausprobiert (1), Wird Liebling (3), Stammgericht (5), Klassiker (10). It goes down again when Cookings are deleted.
_Avoid_: Badge, rank, streak

**Klassiker**:
A Dish with 10 or more Cookings, the top Achievement Level. Its 10th Cooking is celebrated once.
_Avoid_: Milestone (except for the celebration's clip), favourite

**Comment**:
A Member's message on a Dish, shown in its Dish History. Its author can edit it (then marked "bearbeitet") or delete it; the Owner can delete any.
_Avoid_: Note, message, reply

**Vote**:
A Member's thumbs up or thumbs down on a Cooked Dish, one per Member and Dish, which they can change or take back.
_Avoid_: Rating, like, review, score

**Dish History**:
Everything that happened to a Dish, oldest first, at the bottom of its detail ("Verlauf"): when it was added, its Cookings, Votes and Comments; moves aren't part of it. The card turns orange when another Member added a Comment, Vote or Cooking since you last opened the Dish ("Neues im Verlauf"), apart from a New Dish's "Neu".
_Avoid_: Cooking History, timeline, activity feed, log

**Archived Dish**:
A Dish taken off its Board ("Archivieren"), kept in the Board's Archive ("Archiv" in Board Settings) for 30 days, during which Members can restore it and the Owner can delete it for good. After 30 days it's gone, with its images.
_Avoid_: Deleted Dish, trash, bin

**Archived Board**:
A Board its Owner deleted, kept under "Archiv" in the Owner's Board Switcher for 30 days, during which the Owner can restore it with its Members or delete it for good.
_Avoid_: Deleted Board

### Snackbert

**Snackbert**:
A separate Android app for keeping track of what one eats, with a mascot of the same name, run by the same Operator. Only the few people with a Snackbert account can use it from malkochen, and nobody else ever sees it there (ADR 0010).
_Avoid_: Snackbert integration, nutrition app, the tracker

**Snackbert Question**:
Snackbert's head popping up after a Cooking to ask the Member who recorded it whether they'd like to tell him about it, only for Members who switched Snackbert on in Your Settings. It comes once the Cooking can no longer be undone, after a Klassiker celebration, and never during the Tour or after several Dishes were cooked at once.
_Avoid_: Prompt (that's a Notification Prompt), popup, nag

**Snackbert Report**:
One Cooking a Member told Snackbert they ate ("Snackbert melden"), sent with the Dish's details and optionally a photo, a recording or a few words, from the Snackbert Question or later from the Cooking in the Dish History. What Snackbert makes of it stays in Snackbert.
_Avoid_: Meal log, entry, submission, sync

### Running malkochen

**Operator**:
The one person who runs malkochen, and the only one who can open the Admin Page. They can open every Board with all of an Owner's rights without being a Member (ADR 0009), and anything they add still shows their Username.
_Avoid_: Admin, superuser, Owner (an Owner owns one Board)

**Admin Page**:
The Operator's page on how malkochen is used, reached from their Your Settings: figures, the Event Log to filter by user, Board, kind and time, and every Board, to open any of them.
_Avoid_: Dashboard, admin panel, admin console

**Event Log**:
Everything that happens in malkochen, one event each time, on Boards and around them (sign-ups, sign-ins, settings changes, deleted accounts, notifications sent, Open Sign-up switched). Each says when, what kind and which Board, Dish and user, and is kept indefinitely. The Admin Page shows names, titles and Comments as they are now, so what's been deleted shows as deleted there.
_Avoid_: Activity feed, audit log, Dish History

**Changelog**:
The page listing what changed for users in each Version ("Was ist neu"), newest first, with what's Staged but not yet Released on top ("Gerade neu", so only Staging ever shows it). Only what users notice goes in.
_Avoid_: Release notes, updates, news

**Changelog Popup**:
The Changelog entries of every Version a user hasn't seen yet ("Was ist neu"), shown once, the first time they open malkochen after a new Version. Never in the same visit as the Tour; a new user's first Version counts as seen.
_Avoid_: News popup, update dialog, release notes

**Version**:
malkochen's number, starting at 1.0.0. Each Release is one Version: a patch, or a minor Version only when the Operator calls a feature in it big enough for one.
_Avoid_: Release (that's how a Version reaches everyone), build

**Staging**:
The Operator's own copy of malkochen at staging.malkochen.christried.me, with its own accounts, Boards and Allowlist, where changes are tried out before they're Released. A change that's there but not yet Released is Staged.
_Avoid_: Preview, test server, beta

**Release**:
Everything Staged reaching everyone at once, as one Version ("Release 1.1.0").
_Avoid_: Rollout, deploy, launch, Version (that's the number a Release brings)
