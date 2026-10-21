# Free tiers: what malkochen may use, and the limits that keep it inside

Research date: 2026-10-21, for #347 (spec #321, user stories 22 to 25). Scope: the free plans malkochen runs on (Vercel Hobby, Neon Free, Vercel Blob on Hobby, Resend Free), and whether the limits malkochen sets per user and per visitor fit them.

Verification legend used below:
- **[V]** read in the vendor's pricing or docs page on the research date, or in this repo.
- **[I]** inference from primary facts. Not measured.

---

## TL;DR

- **The tightest figures** are Vercel Blob's 2,000 uploads a month and Resend's 100 emails a day. Both are shared by everything malkochen does, and going over Blob's stops Blob for everyone for 30 days [V].
- **Limits set in #347** (`server/rate-limits.ts`, `shared/board.ts`):
  - Sign-in codes: 5 an hour per address, 10 an hour per IP address. Over either, no email goes out, and the sign-in page says from what time another code can be asked for.
  - Boards: 20 of a user's own. The 21st is refused until they delete one.
  - Own Photos and Profile Pictures: tightened from 30 an hour to 20 a day per user (see 3).
- **What per-user limits can't do:** many accounts together can still use up a free tier. That is what the Admin Page (#348) watches.
- **Open risk, not in #347's scope:** adding a Dish from a link copies its image into Blob, limited to 200 an hour per user (`add-dish`). That is far above Blob's 2,000 uploads a month (see 4).

---

## 1. The figures

| Service | Figure | Free amount | Over it | Source |
|---|---|---|---|---|
| Vercel Hobby | Function invocations | 1,000,000 a month | Hobby has no paid overage | [Fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) [V] |
| Vercel Hobby | Active CPU | 4 hours a month | " | same [V] |
| Vercel Hobby | Provisioned memory | 360 GB-hours a month | " | same [V] |
| Vercel Hobby | Fast Data Transfer | 100 GB a month | " | same [V] |
| Vercel Hobby | Fast Origin Transfer | 10 GB a month | " | same [V] |
| Vercel Hobby | Use | Non-commercial only | | same [V] |
| Vercel Blob (Hobby) | Storage | 1 GB (monthly average) | Blob unusable until 30 days have passed | [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) [V] |
| Vercel Blob (Hobby) | Advanced operations (upload, copy, list) | 2,000 a month | " | same [V] |
| Vercel Blob (Hobby) | Simple operations (cache misses, metadata) | 10,000 a month | " | same [V] |
| Vercel Blob (Hobby) | Blob data transfer | 10 GB a month | " | same [V] |
| Vercel Blob (Hobby) | Deleting blobs | Free | | same [V] |
| Neon Free | Postgres storage | 1 GB per project | Writes blocked | [Neon pricing](https://neon.com/pricing) [V] |
| Neon Free | Compute | 100 CU-hours per project a month; suspends after 5 minutes idle | Compute suspended until the next month | same [V] |
| Neon Free | Public egress | 5 GB per project a month | Compute suspended until the next month | same [V] |
| Resend Free | Emails | 100 a day, 3,000 a month | No overage on Free; notified, can upgrade | [Resend pricing](https://resend.com/pricing) [V] |
| Resend Free | Domains | 3 | | same [V] |

Vercel notes that Hobby's included usage is shared across all Vercel services in the project, Blob included [V].

## 2. Sign-in codes (Resend)

Every code is an email, and Resend's 100 a day are shared with the Email Digest and the account deletion confirmations [V, repo].

- **Per address, 5 an hour.** Enough to ask again a few times. Nobody can fill one inbox with codes, from however many IP addresses.
- **Per IP address, 10 an hour.** A household signing in together fits. One visitor can't cycle through addresses on the Allowlist (or, after Open Sign-up, any address).
- Better Auth's own limit, 5 calls a minute per IP address on both email sign-in endpoints, stays (#345).
- Codes are counted only after the sign-in gate lets the address in, so a refused address costs nothing and uses up no limit [V, repo].

One IP address can still ask for 240 codes a day, more than Resend's 100 [I]. A daily cap for all sign-in codes together would close that, at the price of locking everyone out of email sign-in once one visitor reaches it. Left to the Admin Page (#348), which shows emails sent this month.

## 3. Own Photos and Profile Pictures (Blob)

An upload is stored as a JPEG of at most 1600 px on its longer side, quality 82 (`server/image-store/photo.ts`) [V, repo]: roughly 150 to 400 KB [I]. Each upload is one advanced operation [V].

| Limit | Uploads a month, one user | Share of 2,000 | Storage a month, one user, at 400 KB |
|---|---|---|---|
| Before: 30 an hour | up to 21,600 | over 10 times all of it | up to 8.6 GB |
| Now: 20 a day | up to 600 | 30 % | up to 240 MB |

The old limit let one user use up all of Blob in under three days, which would stop every image in malkochen for 30 days [V for the consequence, I for the arithmetic]. 20 a day still covers a cooking evening with an Own Photo per Dish and a few Profile Picture tries.

The 10 MB size limit (`shared/photo.ts`) stays: it bounds what one request uploads to the function, not what is stored, since the stored JPEG is scaled down.

## 4. Open risk: images copied from links (Blob)

Adding a Dish from a link, and "Bild neu laden", copy the found image into Blob: one advanced operation each [V, repo]. Their limit, `add-dish`, is 200 an hour per user. One busy user can use up the 2,000 a month in an afternoon [I]. It is not part of #347 (which names Own Photos and Profile Pictures), so it is raised with the user rather than changed here.

## 5. Boards (Neon)

A Board with its default Columns is a handful of rows; Dishes are where the space goes [I]. 20 Boards of one's own is far more than anyone cooking needs, and stops a script from creating Boards endlessly. Archived Boards don't count and are purged after 30 days; the daily limit of 20 new Boards keeps archiving and creating again slow [V, repo].
