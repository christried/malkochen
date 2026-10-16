# The Tour is built in-house, not on Driver.js

The Tour (`CONTEXT.md`) was going to use Driver.js, a small framework-agnostic spotlight-and-tooltip library. It's built in the app instead, for three reasons that came up while it was being designed (grilling session, 2026-10-16):

- **Topfbert tells every step**, in a different mood each time. He's a Vue component that runs on the page's shared clock and goes still under another modal (`TopfbertIdle`). Driver.js renders its popover outside the Vue app, so he'd have to be mounted as a separate island without the Nuxt app context.
- **The user does the steps themselves**: they add a Dish, move it and delete it. So the Tour has to keep going inside the Add Dish sheet and the Dish menu. Those are `<dialog>`s in the top layer, above anything Driver.js draws with z-index.
- The app already places all its popovers itself, with no positioning library (`AppTooltip`, `PersonPopover`).

## Consequences

- Spotlight, positioning (on screen at 360px), keyboard navigation, focus and reduced motion are the app's own code and tests, not a library's.
- During the Tour, the Dish the user adds sends no Push Notification to the Board's other Members. They still see it live as a New Dish, and if it's kept, the Email Digest lists it. The Digest never lists a deleted Dish.
