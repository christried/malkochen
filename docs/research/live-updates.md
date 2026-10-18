# Live updates: showing other Members' changes without waiting for a poll

Research date: 2026-10-18. Scope: how the client syncs a Board today, and four ways to make other Members' changes appear live. Scale: 2 to 20 users, a few Boards.

Verification legend used below:
- **[V]** read in a primary source (Vercel, Neon, vendor docs, MDN) or in this repo.
- **[I]** inference from primary facts. Not tested.
- **[U]** could not verify.

Repo facts were read from `C:\Users\gilge\Desktop\malkochen`. Docs were fetched on 2026-10-18.

---

## TL;DR

- **Today.** An open Board polls `POST /api/boards/:id/seen` every 5 seconds while the tab is visible. Each poll writes `membership.seen_at` and rebuilds the whole Board (about 6 queries). It also syncs at once when the app comes back to the front [V, repo].
- **Recommendation: option 4, smarter polling.** Add a per-Board change counter. Poll a tiny `GET` that answers "version X still current?" with `304` or a small number. Fetch the full Board only when it changed. Keep visibility handling as it is. No new vendor, no long connection, no CSP change.
- **Why not the others, at this scale.**
  - SSE on Vercel is possible, but a connection ends after at most 300 s on Hobby. Instances share no memory, so each stream would still have to poll the database or need Redis [V]. It buys little over a cheap poll.
  - A hosted service (Ably, Pusher) fits the free tiers easily. It adds a vendor, a secret, a token endpoint, publish calls in every write path, and a CSP change (`connect-src 'self'` today) [V for the limits, I for the effort].
  - `LISTEN/NOTIFY` does not work on Neon's pooled connection [V], and a Vercel function cannot hold a listener connection for long [I]. Not a fit.
- **Do later, only if 5 seconds feels too slow after option 4:** add Ably as a "something changed" ping on top of the same counter. The counter is the foundation for both.
- **Plan.** The project is on **Hobby** [I]. See 1.4.

---

## 1. How sync works today

### 1.1 The poll

All in `C:\Users\gilge\Desktop\malkochen\app\composables\useBoardSync.ts` [V]:

- **Interval.** `POLL_MS = 5_000`. A `setTimeout` chain, not `setInterval`: the next poll is scheduled after the last one ends.
- **Endpoint.** `POST /api/boards/:id/seen` (`server/api/boards/[id]/seen.post.ts`).
- **Payload.** The whole `BoardView`: Board fields, Members, every Column with every Dish (with Cooking History), and `newDishIds`. No delta, no ETag, no version.
- **Visibility.** The timer runs only while `document.visibilityState === 'visible'`. On `hidden` it stops and remembers the time. On `visible` or window `focus` it calls `sync()` at once (`comeBack`). Whichever of the two events comes first wins.
- **Overlap.** One poll at a time (`asking`). A sync asked for during a poll is queued and runs after it.
- **Failure.** Errors are swallowed. The next poll tries again.
- **Tests.** `e2e` runtime config lets a browser test set `window.e2ePollMs` (`tests/e2e/sync.spec.ts`).

### 1.2 The merge contract

In `app/board/board-module.ts`, `sync(ask, { paused })` [V]:

1. `mark()` records the write count. It gives `null` if a write is under way.
2. `ask()` fetches the Board.
3. The answer is **dropped** if a write was under way at `mark()` or started since (`writesSince`), if `paused()` is true (a Dish is being dragged), or if the page now shows another Board.
4. Otherwise `merge(board.value, fresh)` runs. It is in place: Columns and Dishes keep their object identity, `assignChanged` compares fields with `JSON.stringify`, and `replaceChanged` splices a list only if it differs. Server wins.
5. A dropped answer is not retried. The next poll brings it.

Any new live mechanism must call this same `sync`. It is the only place that knows about optimistic writes and drag.

### 1.3 The "Neu" logic

Domain text in `CONTEXT.md` line 88: a Dish another Member added since you last opened the Board, marked "Neu" until you open it again. Coming back after half an hour or more counts as opening it [V].

- `REOPEN_AFTER_MS = 30 * 60_000`. In `comeBack()`, if the app was hidden at least that long, `reopenDue = true`. The next `sync()` first calls `POST /api/boards/:id/open`, then polls [V].
- The order matters (comment in `useBoardSync.ts`): a poll before the reopen would record the Board as seen up to now, and the reopen would take every Dish added while away off "Neu".
- `markOpened` (`server/utils/boards.ts`) sets `newSince = coalesce(seenAt, joinedAt)`, then `seenAt = now`, `lastOpenedAt = now`.
- `markSeen` sets only `seenAt = now`. It does not count as opening.
- `getBoard` computes `newDishIds` from `newSince`: Dishes not deleted, `createdAt > newSince`, added by someone else.
- So polling has a **side effect**: every poll moves `seenAt` forward. This is how a Dish seen live does not come back as "Neu" after the next reopen.

### 1.4 Cost of today's polling and the plan

- **Per poll** [V, repo]: one write (`markSeen`), then `getBoard`: membership+board join, Columns, then Dishes, Members and new-Dish ids in parallel. About 6 round trips over `neon-http` (`server/db/index.ts`).
- **Rate** [I, arithmetic]: 12 polls a minute, 720 an hour, per user with a visible Board. One user for 4 hours a day for 30 days is about 86,000 polls. 20 users like that is about 1.7 million function invocations a month.
- **Invocation allowance.** Hobby includes 1 million invocations a month [V]: https://vercel.com/docs/functions/usage-and-pricing. So the poll alone can pass the Hobby allowance with enough users [I]. Hobby has no on-demand billing for invocations in that table [V]; what happens at the cap I did not verify [U].
- **Active CPU.** Billed only while code runs, not while it waits for the database [V, same page]. Hobby includes 4 hours of Active CPU and 360 GB-hours of memory [V].
- **Neon.** Free plan: 100 CU-hours per project a month, compute suspends after 5 minutes idle and that can't be turned off [V]: https://neon.com/docs/introduction/plans. Polling keeps the database awake whenever anyone has a Board open [I]. Polling every 5 seconds is why a DB compute stays up during use.
- **Which Vercel plan?** The MCP shows team "christried's projects" with 5 projects, no plan field [V]. `vercel.json` has two crons, each once a day [V, repo]. That is the shape Hobby allows [I]. `git.deploymentEnabled` turns off non-main deploys, which is also a Hobby habit [I]. **Treat it as Hobby [I].** Confirm in the dashboard (Settings, Billing) [U].
- **Functions region and runtime.** Nuxt on Vercel via Nitro, Node 24 [V, MCP project info]. `nuxt.config.ts` sets no Nitro `vercel` options and `vercel.json` has no `functions` block [V, repo].

---

## 2. Option 1: Server-Sent Events from a Vercel Function

### 2.1 What Vercel says

- **Streaming works.** Node.js functions stream by default. The docs show a `text/event-stream` response [V]: https://vercel.com/docs/functions/streaming-functions.
- **Duration.** With Fluid compute (on by default): Hobby default 300 s, maximum 300 s. Pro default 300 s, maximum 800 s, with 1,800 s in beta [V]: https://vercel.com/docs/functions/configuring-functions/duration. In Nuxt the setting is `nitro.vercel.functions.maxDuration` [V, same page].
- **Connections end.** Every connection closes at the limit. The client must reconnect, resubscribe and reload state. Vercel's own pattern backs off from 1 s, doubling to 30 s [V]: https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel. Browsers' `EventSource` reconnects by itself and sends `Last-Event-ID` [V, same page].
- **No shared memory.** For WebSockets the guide says instances don't share memory, so rooms and pub/sub need an external store. Redis is "needed only for delivery across instances" [V, same guide]. The guide's SSE section lists no SSE-specific limit and puts the same reasoning on cross-instance delivery [V for what it says, I for applying it to SSE]. A write handled by instance A cannot push to a stream held by instance B without a shared bus.
- **HTTP/2.** For long handlers over HTTP/2, Vercel sends connection-level `PING` frames while idle. HTTP/1.1 has no equivalent, so send heartbeat data [V]: duration page above.
- **WebSockets** are in public beta on all plans [V]: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections. Same duration limits, same pinning. Beta, so not for this app.

### 2.2 Cost per open connection

- **Memory is the driver.** Provisioned Memory is billed "continuously until the last in-flight request finishes", also while waiting on I/O. Active CPU pauses while waiting [V]: https://vercel.com/docs/functions/usage-and-pricing. An open stream holds an in-flight request, so the instance's memory bills for as long as any stream is open. Connections on one instance share that cost [V]: WebSocket guide above (it states this for WebSockets; the Fluid model is the same for any in-flight request, [I]).
- **Hobby arithmetic [I].** The included 360 GB-hours is 360 hours of a 1 GB instance. With a 1 GB instance and at least one stream always open, one instance costs about 720 GB-hours a month. That is above the allowance. With real use (a few hours a day) it is likely below. The default function memory is not set in this repo [U].
- **Pro.** Pro bills on demand. Regional rates for Active CPU and memory are on the pricing page, for example Washington D.C. $0.128 per CPU-hour and $0.0106 per GB-hour [V]. A 1 GB instance held open 24/7 would be about $7.60 a month in memory at that rate [I, arithmetic: 720 h x $0.0106]. This is on top of the Pro plan fee, which I did not look up [U].
- **Reconnect load.** On Hobby, a stream ends every 300 s at most. Each reconnect is a new invocation [V for the limit, I for the count]. 20 users, one reconnect per 5 minutes, is 12 an hour each. That is far fewer than 720 polls an hour.

### 2.3 What it would take in this app

- Nitro (h3) has an event-stream helper. I could not fetch its page (404), so the exact API is [U]. Writing a `ReadableStream` with `Content-Type: text/event-stream` works on any h3 version [I].
- The stream still needs a signal. Without Redis, the stream handler would poll the database itself for a Board version (option 4) and push a tiny "changed" event. This moves the polling from the client to the server. It saves round trips, not database load [I].
- With Redis (Marketplace Redis or Upstash) it could be pushed. That adds a service, a connection cap to watch, and `waitUntil` handling [V, guide above].
- Auth works as today: the same-origin `EventSource` sends the session cookie [I]. The CSP `connect-src 'self'` stays valid [V, `server/plugins/headers.ts` line 20].
- Neon: a stream that polls keeps the compute awake the same way client polls do [I].

### 2.4 Verdict

Works, but on Hobby it is capped at 5-minute streams and bills memory for open streams. It still needs either server-side polling or Redis. **Not worth it at 2 to 20 users** [I].

---

## 3. Option 2: hosted pub/sub or realtime service

The shape is the same for all of them [I]: the server publishes a small "Board X changed" message after each write. Clients subscribed to that Board's channel call the existing `sync()`. The Board data still comes from `GET`/`POST` as today. Auth: the server issues a short-lived token or signs the subscription for the signed-in Member, only for Boards they belong to.

### 3.1 Free tiers (checked 2026-10-18)

| Service | Free tier limits | Source |
|---|---|---|
| **Ably** | 6M messages/month, 200 concurrent connections, 200 concurrent channels, 500 messages/s. A message counts once for the publisher and once per subscriber [V]. | https://ably.com/pricing, https://ably.com/docs/platform/pricing |
| **Pusher Channels** (Sandbox) | 200k messages/day, 100 concurrent connections. Channel limit not found [U]. | https://pusher.com/channels/pricing/ |
| **Supabase Realtime** | Free: 200 concurrent clients, 100 messages/s, 100 channels per connection. | https://supabase.com/docs/guides/realtime/limits |
| **Liveblocks** | Free: 10 simultaneous connections per room, 3,000 anonymous connections per month, 10 projects. A room per Board would cap a Board at 10 live Members. Other limits not read [U]. | https://liveblocks.io/pricing |
| **Cloudflare Durable Objects** (what PartyKit builds on) | Free: 100,000 requests/day, 13,000 GB-s/day, SQLite-backed only. WebSocket incoming messages bill at 20:1. Hibernation API avoids duration billing. | https://developers.cloudflare.com/durable-objects/platform/pricing/ |

I did not fetch PartyKit's own current terms. PartyKit is a layer on Durable Objects [I, background knowledge, not verified today]. Treat it as [U] beyond the Cloudflare numbers above.

### 3.2 Fit at this scale

- **Message volume [I].** A Board with 5 Members and 100 writes a day: each write is 1 publish plus up to 5 deliveries, about 600 Ably messages a day, 18,000 a month. The 6M free allowance is about 330 times that. Connections: 20 users is 10% of 200.
- **Supabase Realtime** only makes sense if the app were on Supabase. It is on Neon, so it would be a second vendor with its own project [I]. Its "Broadcast" could work without its database, but I did not read how [U].
- **Liveblocks** is built for rooms of cursors and documents. The 10-per-room free cap and the sync model are a poor fit for a "ping" [I].
- **Cloudflare DO / PartyKit** is the most work: a second runtime and deploy target.
- **Ably or Pusher** fit best. Both are named by Vercel as running alongside Vercel Functions, with Marketplace integrations for Ably and Pusher [V]: realtime guide above.

### 3.3 Integration effort in this repo [I]

Server:
- A token endpoint (`GET /api/boards/:id/realtime-token`) that checks Membership (`getBoard`/`membershipOf`) and returns a token limited to that Board's channel.
- A `publishChanged(boardId)` call after every write that changes a Board: Dish add, edit, delete, restore, move, bulk, Cooking edit, Column add and rename, Member join and leave, Board edit. That is about 15 handlers under `server/api/`. Missing one means a silent gap. A Postgres trigger on the change counter (section 5) would let one place do the publish, but a trigger cannot call a vendor from Neon, so it still needs the handlers [I].
- Publishing must finish before the function returns, or use `waitUntil` [V, Vercel guide mentions `waitUntil` for the Redis write after the response].
- A secret in Vercel env. Env changes need a redeploy (see your memory notes) [V].

Client:
- `useBoardSync.ts` subscribes on mount, calls `sync()` on a message, and unsubscribes on unmount and Board switch. Keep a slow poll (for example 60 s) as a fallback. A missed message must not mean a stale Board [I].
- Android PWA background: the WebSocket will be cut when the app is hidden. The existing `visibilitychange` sync on return still covers it [I].

CSP:
- `connect-src 'self'` (`server/plugins/headers.ts`) must add the vendor's WebSocket and HTTPS hosts. For Ably those are listed in its docs [U, not fetched]. Tests (`tests/e2e/*`) would need a stub or a switch to turn the service off [I].

Auth:
- Better Auth session on the token endpoint. The vendor never sees the session [I].

### 3.4 Verdict

Fits every free tier by a wide margin and gives truly live updates. The cost is a vendor, a secret, 15 publish sites, CSP, and test stubs [I]. Reasonable as a second step.

---

## 4. Option 3: Postgres LISTEN/NOTIFY on Neon

- **Pooled connection: no.** Neon's pooled endpoint runs PgBouncer in transaction mode and lists `LISTEN` and `NOTIFY` as unsupported. The page recommends a direct connection for them [V]: https://neon.com/docs/connect/connection-pooling.
- **The serverless driver.** `neon()` sends each query as an HTTP request, so there is no session to listen on [V, Neon serverless driver page: "Each query is sent as an HTTP fetch request"]: https://neon.com/docs/serverless/serverless-driver. The `Pool`/`Client` classes over WebSockets give sessions, but in edge runtimes "WebSocket connections can't outlive a single request" [V, same page]. The page does not mention `LISTEN/NOTIFY` at all [V as absence].
- **Direct connection from a Vercel function.** A listener needs one connection that stays open and is held by something that stays alive. A Vercel function lives at most 300 s on Hobby [V]. With several instances, each would need its own listener [I]. This is a worse version of option 1 with Postgres as the bus.
- **Autosuspend.** Neon docs I read do not say whether an idle open connection keeps the compute awake [U]. A listener would at least defeat scale to zero if it does [I]. Free plan compute suspends after 5 minutes idle and 100 CU-hours a month is the cap [V].
- **This app's driver.** `server/db/index.ts` uses `neon-http` in deployed environments and `pg` on localhost. Listening would need a third connection path [V, repo].

**Verdict: not viable here** [I]. It would only pay off with an always-on server, which this app does not have.

---

## 5. Option 4: smarter polling

### 5.1 What stays

The visibility logic is already right: timer stops when hidden, sync on `visibilitychange` and `focus`, one poll at a time, drop-and-retry around writes and drag [V, repo]. Do not change these.

### 5.2 What to add

**A per-Board change counter.** A new column `board.version` (bigint, default 0). Every change to what `getBoard` returns bumps it.

- **Why a counter and not `max(updated_at)`.** Some changes are hard deletes: Column delete (`server/utils/columns.ts` line 169), Cooking delete in the undo path (`server/utils/dishes.ts` line 302), Member leave (`server/utils/members.ts`) [V, repo]. A deleted row leaves no `updated_at` to find, so a max would not move [I]. Dish and Cooking soft deletes do set `deleted_at` [V, schema].
- **How to bump.** Either in each write handler (about 15 sites, easy to miss one) or with statement-level `AFTER INSERT OR UPDATE OR DELETE` triggers on `dish`, `cooking`, `board_column`, `membership` (member list) and `board`, each running `update board set version = version + 1 where id = ...`. The trigger route is one migration and cannot be forgotten by a new endpoint [I]. Drizzle migrations run on every Vercel build (`pnpm db:migrate`) [V, repo]. A trigger on `membership` must not fire for `seen_at` and `last_opened_at` updates, or each poll would bump the version. The trigger needs a `WHEN` clause or a column list (`UPDATE OF is_owner`) [I].
- **Caveat.** `newDishIds` depends on the viewer and on `seenAt`, not only on Board content. It changes when `newSince` moves (on `open`) and not with `version`. That is fine: `open` returns the full Board in the same sync [I, to check in tests].

**A cheap check endpoint.** `GET /api/boards/:id/version` with two options:
- **ETag.** Answer `ETag: "<version>"`. The client sends `If-None-Match`. Same version gives `304 Not Modified` [V]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests. MDN's page does not say a 304 has no body; that is HTTP itself (RFC 9110) [I]. Browser `fetch` handles the conditional request by itself on a cached `GET` [I, to test with `$fetch`].
- **Plain number.** Answer `{ version }` (or `204` if equal to `?since=`). Easier to test, no cache subtleties. **Prefer this** [I].
- Cost on the server: one indexed read on `board` plus the Membership check. Can be one query: `select version from board join membership ...` [I].

**No write on an unchanged poll.** Today every poll writes `seen_at`. With a version check, an unchanged poll writes nothing. This is safe for "Neu": if the version has not moved since the last full poll, no Dish was added since, so `seenAt` has nothing new to record [I]. A changed version goes through the existing `/seen` and records `seenAt` as now. One more write can be skipped when only the viewer's own write moved the version [I, optional].

**Client flow** (`useBoardSync.ts` plus a small change in `board-module.ts`):
1. Keep the last seen `version` (from the `BoardView`, which would carry it).
2. Each tick: `GET /version`. Same: do nothing, schedule next. Different: run today's `boardModule.sync(...)` with `/seen`.
3. `reopenDue` still goes first, exactly as now.
4. `sync()` in the module stays as is. Only the `ask` callback and the loop change. The module's drop rules also keep working, since the full fetch still goes through `sync` [V, repo].
5. After a dropped answer (write under way, or drag), the stored version must not advance, so the next tick fetches again [I]. Today a dropped answer is retried by the next poll anyway.

### 5.3 Adaptive interval and the rest

- **Interval.** A cheap check can be run more often. Example: 3 s while the user was active in the last minute, 10 to 15 s after a quiet minute, hidden: none [I]. The cost per check is one indexed read, not six queries plus a write.
- **Refetch on focus:** already done [V, repo].
- **Invocation count** [I, arithmetic]. A check every 3 s is 1,200 an hour per visible user, more invocations than now (720). To stay under Hobby's 1M, keep 5 s with quiet backoff, or accept Pro. The saving is database work and bandwidth, not invocation count. **Option 4 does not cut invocations unless the interval stays long.** With a 5 s base and a back-off to 15 s after 2 quiet minutes, 20 users at 4 hours a day is about 0.8 million a month [I, rough].
- **Neon.** Polls still wake the compute. A single indexed read is cheap in CU-seconds, but it does keep the database from suspending while any Board is open [I].
- **Vercel edge cache.** Not usable: responses are per user, and a stale count would defeat the purpose [I].

### 5.4 Verdict

Smallest change, no new vendor, no CSP change, no new failure mode beyond what exists. It does not make updates instant (3 to 5 seconds), and it does not reduce the invocation count by itself.

---

## 6. Comparison

| | Latency | New moving parts | Hobby fit | Effort | Failure mode |
|---|---|---|---|---|---|
| 1. SSE on Vercel | about 1 s if pushed, else same as polling | Redis, or server-side polling | Memory billed per open stream; streams end at 300 s [V] | Medium to high | Stream drops; falls back to nothing unless polling stays |
| 2. Ably / Pusher | under 1 s | vendor, secret, token endpoint, 15 publish sites, CSP | Free tier far above need [V] | Medium to high | Missed ping; needs a fallback poll |
| 3. LISTEN/NOTIFY | n/a | direct DB connection, always-on listener | No [V, I] | n/a | n/a |
| 4. Version check | 3 to 5 s | one column, trigger or 15 bumps, one endpoint | Fits; invocation count unchanged [I] | Low to medium | Same as today |

---

## 7. Recommendation

**Do option 4 now. Keep option 2 (Ably) as an optional later layer.**

Why:
- 5 seconds is already close to live for a shared recipe board. The need is cheaper polling, and a change counter gives that [I].
- The counter is also what a later Ably ping would carry. It is not wasted work [I].
- It adds no vendor, no secret, no CSP change, no test stub [V, repo].

### 7.1 Changes in the client Board module and composable

- `app/composables/useBoardSync.ts`: the tick calls `GET /api/boards/:id/version` first. Only a different version runs `boardModule.sync` against `/seen`. Add the quiet back-off. Keep `comeBack`, `reopenDue`, `queued`, `stopped` unchanged.
- `app/board/board-module.ts`: `merge` copies `version` along with the other Board fields (it already does via `assignChanged` once `BoardView` has the field). `sync` needs one new thing: a way to tell the composable whether the answer was merged or dropped, so a dropped answer does not advance the stored version. A boolean return is enough.
- `server/utils/boards.ts`: `BoardView` gets `version`. `getBoard` selects it.
- Tests: `tests/client` for the module (dropped answer keeps the old version). `tests/e2e/sync.spec.ts` keeps working through `e2ePollMs`.

### 7.2 Changes on the server

- New migration: `board.version`, plus triggers (or bumps in each write path). Triggers on `membership` must skip `seen_at`/`last_opened_at`.
- New handler `server/api/boards/[id]/version.get.ts`: Membership check, one read, returns `{ version }`.
- `seen.post.ts`: unchanged. It is called less often.
- Docs: add a line to `CONTEXT.md` or an ADR that a poll no longer records `seenAt` when nothing changed, and why that is safe for "Neu".

### 7.3 When to add Ably later

If Members want changes to show in under a second. Add `publishChanged(boardId)` after the version bump, a token endpoint, a CSP entry, and make the client call `sync()` on a message while the poll slows to about 60 s as a safety net. Do not remove the poll.

---

## 8. Open and unverified points

1. **Vercel plan.** Hobby is inferred from `vercel.json` and the team name. Confirm in the dashboard. Pro would lift max duration to 800 s and bill on demand [U].
2. **Hobby cap behaviour.** What happens when Hobby passes 1M invocations or the CPU/memory allowance was not read [U].
3. **Function memory size.** Not set in the repo. The default for Nuxt/Nitro on Vercel was not checked [U].
4. **h3 event-stream API.** The docs URL I tried returned 404. Not needed for the recommendation [U].
5. **Neon autosuspend with an idle open connection.** Neon's autosuspend guide does not say [U].
6. **Pusher channel limit, Liveblocks monthly limits, PartyKit terms.** Not read [U].
7. **Ably CSP hosts and token auth flow.** Not fetched. Only needed for the later step [U].
8. **`$fetch` and conditional requests.** Whether Nitro's `$fetch` in the browser sends `If-None-Match` for a `GET` by itself was not tested. The plain-number endpoint avoids the question [U].
9. **Trigger behaviour on Neon.** Row and statement triggers are standard Postgres. I did not test them with `neon-http` batches (`runAtomic`) [U]. A batch is one transaction, so the trigger should fire once per statement [I].
10. **Counts of publish sites (about 15).** Counted from the `server/api` file list, not from a full audit [I].
11. **Nothing was tested.** No endpoint, trigger or vendor SDK was run for this note.

## Sources

- Vercel duration limits: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel Fluid compute pricing: https://vercel.com/docs/functions/usage-and-pricing
- Vercel streaming: https://vercel.com/docs/functions/streaming-functions
- Vercel realtime guide: https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel
- Vercel WebSocket guide: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling
- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- Neon plans: https://neon.com/docs/introduction/plans
- Neon autosuspend: https://neon.com/docs/guides/auto-suspend-guide
- Ably pricing: https://ably.com/pricing and https://ably.com/docs/platform/pricing
- Pusher pricing: https://pusher.com/channels/pricing/
- Supabase Realtime limits: https://supabase.com/docs/guides/realtime/limits
- Liveblocks pricing: https://liveblocks.io/pricing
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- MDN conditional requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests
