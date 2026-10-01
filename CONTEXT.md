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

**Member**:
A user who belongs to a Board. All Members can add, edit, move and delete Dishes and edit Columns.
_Avoid_: Collaborator, participant

**Owner**:
The one Member of a Board who can delete it, remove Members, reset the Invite Link and hand ownership to another Member. Initially whoever created the Board.
_Avoid_: Admin, creator

**Invite Link**:
A shareable link that lets a signed-in user on the Allowlist become a Member of a Board.
_Avoid_: Share link, invitation

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

**Supported Source**:
A kind of Source malkochen fully supports, with an image reliably found: TikTok video, Instagram Reel, Instagram post, YouTube Short, Pinterest Pin, food blog page. TikTok videos, YouTube Shorts and food blog pages also yield a Suggested Title; Instagram and Pinterest don't show captions to other apps, so their Dishes are titled by hand. Any other link is still accepted, on a best-effort basis.
_Avoid_: Platform, integration

**Suggested Title**:
The title proposed from the Source when a Dish is being added, which the user can edit before saving.
_Avoid_: Inferred title, auto title

**New Dish**:
A Dish another Member added to a Board since you last opened that Board (or joined it, if you never opened it), including ones added while you have it open. Marked "Neu" until you open the Board again; coming back to the app after half an hour or more away counts as opening it.
_Avoid_: Unread, notification

**Placeholder Image**:
One of a fixed set of illustrations of vegan dishes, used as a Dish's image when the Source provides no thumbnail or the user prefers one.
_Avoid_: Default image, fallback image, stock photo

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
