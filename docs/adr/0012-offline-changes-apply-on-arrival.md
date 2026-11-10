# Offline changes apply on arrival, last arrival wins

A Member with a weak signal (the supermarket, the kitchen) keeps using a Board: moves, "Gekocht ✓", Comments, Votes, title edits and adding a Dish by link (grilling session, 2026-11-09). Each such change is an Unsent Change (`CONTEXT.md`): kept on the device and sent once malkochen answers again, as the same request it would have been online, dated when it was made. malkochen applies it to the Board as it is by then. A move or an edit simply wins over what others did meanwhile, as two Members acting at once already do online. Cookings, Comments and Votes are added. A change that can't apply any more (its Dish archived, its Column deleted, a Permission switched off, the Member gone from the Board) is dropped and the Member told which. A move into a deleted Column goes to the first Column instead.

## Considered Options

- **Merging field by field, or a CRDT:** would keep both sides of a clash, but the things one edits offline are a Dish's Column and title, where one answer has to win anyway. Clashes are rare when people are offline for minutes, and the cost would be a second data model on the device and on the server.
- **Dating a change when it arrives:** simpler, but a Cooking tapped at 19:00 would say 21:00. "Neues im Verlauf", Push Notifications and the Email Digest still go by arrival, so a late Comment isn't missed.
- **Asking the Member to resolve each clash:** a dialog after every reconnect, for clashes that barely matter.
- **Snackbert Reports offline too:** their photo and recording are uploads; the Report sheet already keeps what was put in and sends once online, after its Cooking has arrived.

## Consequences

- Every change that can be made offline must be safe to replay late: the server checks it against the Board as it is then, never against what the device saw.
- A late Comment can land above ones others already read, as the Dish History stays oldest first.
- Two Members cooking a Dish the 9th time offline may both see the Klassiker celebration.
