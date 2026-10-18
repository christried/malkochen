# Live updates by version polling, not a realtime service

malkochen runs on Vercel's Hobby plan and has to stay within it (grilling session, 2026-10-18; `docs/research/live-updates.md`). An open Board keeps polling, but each tick asks a cheap "has this Board's version changed?" and loads the whole Board only when it has. Each Board has a version that every change to it moves on; `updated_at` can't serve, because Columns, Cookings and Memberships are hard-deleted.

## Considered Options

- **Server-Sent Events from a Vercel Function:** a stream lasts at most 300 s on Hobby, memory is billed while it's open, and instances share nothing, so it still needs a database poll or Redis behind it.
- **Postgres LISTEN/NOTIFY on Neon:** not supported through Neon's pooler, and a function can't hold a listener open.
- **A hosted realtime service (Ably, Pusher):** works within free tiers, but adds a vendor, a secret and a CSP exception for updates nobody needs within a second. It can still be added on top of the same version later.
