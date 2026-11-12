# The Recipe Finder is for a handful of users, and stays that way

A Dish holds a Recipe (`CONTEXT.md`): Ingredients and Steps, typed by any Member who may edit the Dish. The Recipe Finder fills it in by itself, from a food blog's recipe data, the Caption or a page the Caption links to, read by a language model (Claude Haiku) on the server (grilling session, 2026-11-11). It's switched on per user by the Operator, after the user asked for it in Your Settings, with a daily cap per user. It is never opened to everyone.

Two reasons, either one enough. What it finds is the Source's own text: a blog's Steps are copyrighted, and copying them into a Board is a private note among a few people only as long as it stays among a few people. And each search costs money, so an open switch would hand the bill to whoever signs up.

## Considered Options

- **Blog recipe data for everyone, only the language model gated:** reading a blog's recipe data costs nothing, so the bill wouldn't need the gate. But blog Steps are the most clearly copyrighted text of all, so one gate covers everything automatic.
- **Hand-written rules instead of a language model:** free, and no text leaves malkochen. Captions have no fixed shape, in three languages, so it would miss most Recipes on TikTok and Instagram, the Sources people use most.
- **A gate per Board:** one allowed Member would spend for the whole group anyway, and the request is made from a user's own settings.
- **Structured Ingredients (amount, unit, name):** would let a shopping list add up amounts. Parsing them is often wrong, and plain lines can be given structure later without losing anything.

## Consequences

- A Recipe found for one Member's Dish is seen by every Member of that Board, and a Copy takes it along, through a Dish Link too. The Dish Link's own page, open to anyone, never shows a Recipe. That's as far as a found Recipe travels.
- Caption and page text go to Anthropic, which the Datenschutz says.
- Opening the Recipe Finder to everyone later is a new decision about copyright, not a switch to flip.
- Reading a video's spoken words is a later slice. It needs the video file, which TikTok, Instagram and YouTube only give over unofficial routes, and a second provider for speech to text.
