# The Operator sees every Board and what the Event Log records

Until 1.0.0 the Operator saw counts only: the Event Log held no content, and the Admin Page never showed a Dish title or a Comment. From review 4 on (grilling session, 2026-10-24), the Operator can open every Board with all of an Owner's rights, without showing up as a Member, and the Admin Page lists every event with who did it, the Board, the Dish, its title and the Comment's text, filtered by user, Board, kind and time. With Open Sign-up on, the one person running malkochen needs to see what's happening in it to help people and catch misuse.

The Event Log still stores ids, never copies of content. The Admin Page shows names, titles and Comments as they are now, so what someone deleted (their account, a Comment, a Dish) shows as deleted there, and deleting stays as complete as the privacy policy promises.

## Considered Options

- **Keep counts only:** the most private option, but the Operator can't answer "my Dish is gone" or see misuse once anyone can sign up.
- **Read-only access to other people's Boards:** less power, but the Operator couldn't tidy up or fix a Board for someone who asks.
- **Copy content into the Event Log:** a true history, but deleted Comments and accounts would live on there, against the right to erasure.

## Consequences

- The privacy policy says the Operator can see every Board and the Event Log, and the Changelog entry for the Version that brings it tells everyone once through the Changelog Popup.
- Anything the Operator adds on someone else's Board shows their Username like anyone's; authorship is never hidden.
- Going back to counts only means taking the access away, not unseeing what was seen.
