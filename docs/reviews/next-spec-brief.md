# Next spec: brief for grilling

The user's wishes for the spec after the Tour (#296), as of 2026-10-18, with what exists today and the questions grilling has to settle. Input for `/grill-with-docs`, not decisions.

## 1. English and Italian UI

**Wish:** English and Italian beside German. The language follows the system setting first; the user can pick another one in Your Settings.

**Today:** all UI text is in `app/strings/de.ts` (type `Strings`), read through `useStrings()`. Your Settings has a Sprache slot showing "Weitere Sprachen kommen später."

**To settle:**
- Where the choice is stored: on the user (DB column, follows them across devices) or on the device. And what "system setting" means before sign-in: `Accept-Language` on the server, so the first render has no flash of German.
- Fallback for a system language that's none of the three.
- Default Column names ("Ideen / Diese Woche / Gekocht") are stored data. Are new Boards created in the creator's language, and do existing Boards stay as they are?
- Names that stay German in every language: malkochen, Topfbert, Klassiker? Others ("Gekocht", "Rundgang")?
- Text that leaves the app: the Email Digest, Push Notifications, the Invite Link landing page. Do they follow the recipient's language?
- Who checks the Italian.
- Date, number and plural formatting (`Intl`), and the "3× gekocht" style counts.
- The Tour text (#296 left translating it out).
- Which language the browser tests run in, and how much of the suite covers the other two.
- `CONTEXT.md` keeps German UI words in quotes ("Board-Einstellungen"): does it need English and Italian ones too?

## 2. Ratings: thumbs up or down after cooking

**Wish:** every Member of the Board can give a Dish a thumbs up or a thumbs down, styled to fit, and only once it has been Cooked.

**To settle:**
- One vote per Member per Dish, changeable? Or one vote per Cooking, so the history shows how it went each time?
- Whether only Members who cooked it may vote, or anyone on the Board.
- What happens to the votes when the Dish moves to another Board, or a Member leaves.
- Whether votes affect anything (sorting, Klassiker, Achievement Level) or are only shown.

## 3. Comments, and one history at the bottom of the Dish detail

**Wish:** Dishes get comments. Comments, votes and Cookings appear together as one history at the very bottom of the Dish detail, like a chat. The card shows that something has happened inside it. The Dish's note and the Cooking notes are removed.

**Today:** a Dish has an optional note. Each Cooking has an optional note too ("Notiz hinzufügen" in the Gekocht toast).

**To settle:**
- What becomes of existing notes: are they turned into comments by their author, or dropped?
- Whether the Gekocht toast's "Notiz hinzufügen" becomes "Kommentar hinzufügen".
- Editing and deleting comments: own comments only? Can the Owner remove anyone's?
- What the card shows: a count, an icon, or a dot for "new since you last looked" (like "Neu")? How does this fit a crowded card?
- Whether a new comment triggers a Push Notification or appears in the Email Digest (#201 left out notifications for anything but new Dishes).
- A name for the history in `CONTEXT.md`.

## 4. Live updates: explore

**Wish:** look into making changes appear live instead of by polling, and report the options.

**Today:** polling only. The app runs on Vercel (serverless) with Neon Postgres.

**To settle (after research):** Server-Sent Events, a hosted pub/sub service, Neon's `LISTEN/NOTIFY`, or faster and smarter polling (e.g. polling only while visible, a cheap "anything changed?" check). Each option has its own cost, limits on Vercel, and changes to the sync contract in the client Board module (#61). A good candidate for `/research` running in the background during grilling.

## 5. Account deletion

**Wish:** users can delete their own account.

**Today:** the operator removes users by hand.

**To settle:**
- What happens to their Dishes, Cookings, comments and votes on shared Boards: kept with a placeholder name ("Ehemaliges Mitglied"), or removed?
- Boards they own: hand ownership to another Member automatically, or ask them to choose first? Boards where they're the only Member are deleted.
- A grace period (like the 30-day window below), or immediate.
- Confirmation (type your Username?), and an email afterwards.
- The Allowlist entry: removed as well?

## 6. Deleting becomes archiving

**Wish:** every kind of Dish deletion becomes archiving. Archived Dishes are purged after a set number of days.

**Today:** this half exists already. Deleted Dishes and Cookings are soft-deleted (`deleted_at`) and purged with their images after 30 days (`server/utils/cleanup.ts`, #195). There's no place to see or restore them, apart from "Rückgängig" right after.

**To settle:**
- An Archive view per Board: where is it, who can restore, and can you delete for good from there?
- Whether 30 days stays.
- Whether Boards and Columns get archived the same way, or only Dishes.
- Wording: "Archivieren" instead of "Löschen" throughout? The term goes into `CONTEXT.md`.

## 7. Permissions per Member

**Wish:** the Owner sets what each other Member may do: add, edit, move and delete (archive) Dishes. Suggestions for more are welcome.

**Today:** all Members can do everything with Dishes and Columns. Only the Owner can delete the Board, remove Members, reset the Invite Link and hand over ownership.

**Possible additional permissions to discuss:** edit Columns; invite others (see the Invite Link); mark Gekocht and delete Cookings; comment and vote; restore from the Archive; change the Board's name and emoji.

**To settle:**
- Per Member, or roles (e.g. "Mitglied", "Gast/nur ansehen")? Roles are easier to understand; per-person switches are more flexible. Read-only viewers were out of scope in v1 and become possible here.
- Defaults for new Members joining through the Invite Link.
- A second admin ("Co-Owner")?
- What a Member without a permission sees: a hidden action, or a disabled one with a reason?
- These rules must be enforced on the server; the client only hides things.

## 8. Email sign-in, then open sign-up

**Wish:** a magic link and email sign-in beside Google. Then sign-up opens to everyone, and that's a release.

**Today:** Google only, through Better Auth; the Allowlist decides who may sign in. Resend already sends the Email Digest from christried.me.

**To settle:**
- A magic link only, or also email + password? (Magic link only is simpler and has no passwords to store.)
- How a Google account and an email account for the same address are linked.
- Open sign-up: is the Allowlist removed, or kept as a switch? What about abuse: rate limits, upload limits, storage costs per user, a cap on Boards per user?
- Legal side for public users: privacy policy, imprint, terms. Your task, at christried.me.
- Its order in the spec: open sign-up should come after account deletion, permissions and the CSP.

## 9. Enforcing the Content Security Policy

**Wish:** part of this spec.

**Today:** the policy is report-only (`server/plugins/headers.ts`). Violations reach Vercel's logs as `[csp-report]` (#247). `public/offline.html` still needs hashes, since a static file can't carry a nonce.

**To settle:** a check of the production logs first. Enforce before open sign-up.

## 10. Admin panel and analytics for the operator

**Wish:** a simple admin page that only the user's own account can open, linked from Your Settings. It shows what's being added, how often Dishes are moved, and the like. Pragmatic, not pretty.

**To settle:**
- How "only me" is decided: an email in an env variable, checked on the server for every admin endpoint.
- Which figures: Dishes added per day/week, by Source; moves; Cookings; active users and Boards; sign-ups (once open); errors? Counted from the existing tables, or from a new event log (needed for "how often moved", since moves aren't recorded today)?
- Privacy: does the operator see Dish titles from other people's Boards, or only counts? This matters once sign-up is open, and the privacy policy has to say so.
- Any actions (e.g. delete a user, manage the Allowlist), or read-only?

## 11. Google Play Store: explore (end of the spec)

**Wish:** look again at shipping to the Play Store, Android only. How easy is it from where we stand?

**Today:** an installable PWA with a share target (#201). `docs/research/android-nav-bar-and-share-sheet.md` already looked at a Bubblewrap TWA, which it rated "High (native project, Play release)", but only as a fix for the navigation bar and the share sheet.

**To settle (after research):** a TWA via Bubblewrap or PWABuilder, Digital Asset Links on the domain, signing keys, the Play developer account (one-time fee, identity check, the closed-test rule for new personal accounts), the store listing, the privacy policy, and how updates work (web deploys need no new release). Also whether a TWA lets us publish sharing shortcuts after all, so malkochen gets into the share sheet's top row (#278 dropped this).

## Stays out

Unchanged and not part of this spec: copying a Dish to another Board, editing while offline, iOS/Safari, content checking, real Pinterest titles via the API, illustrated avatars, notification settings per Board, Pinterest and blog video embeds, cooking stats per person, marking several Dishes Gekocht at once, Tours for other screens, Tour analytics.

## Order and size

This is larger than any spec so far. Grilling may well split it into several specs, for example:

- **Dish life:** ratings, comments and history, archiving (2, 3, 6)
- **Board access:** permissions (7)
- **Languages:** English and Italian (1)
- **Opening up:** account deletion, email sign-in, CSP, open sign-up (5, 8, 9)
- **Operator:** admin panel (10)
- **Explorations:** live updates, Play Store (4, 11), as `/research` reports

Comments, permissions and new languages all add UI text, so English and Italian are best done either first (so new text is written in three languages from the start) or last (so the translation is done once).
