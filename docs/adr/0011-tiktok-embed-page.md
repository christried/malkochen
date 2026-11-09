---
status: accepted
---

# TikTok from oEmbed and its embed page

Since early November 2026 (noticed 2026-11-09), TikTok's public oEmbed (`tiktok.com/oembed`) answers with the player alone: `html`, `embed_product_id` and the like, but no `title`, `author_name`, `author_unique_id` or `thumbnail_url`, for every video and every user agent. Source Lookup got nothing but the Source kind from it, so a TikTok link came with no Suggested Title, Creator, image or Caption.

The video's embed page (`tiktok.com/embed/<id>`) still shows them to a server, in a JSON state script (`__FRONTITY_CONNECT_STATE__`), under the page's own route: the caption (`itemInfos.text`), the cover (`itemInfos.covers`), the author's name and handle (`authorInfos.nickName`, `authorInfos.uniqueId`). Source Lookup now asks oEmbed and the embed page at once. Whatever oEmbed gives wins, the embed page fills the rest, so the lookup recovers on its own should TikTok bring oEmbed's fields back.

## Consequences

- The embed page isn't an official interface, so TikTok can change it without notice. When it does, the lookup quietly gives what oEmbed gives. It never errors, and the title stays required whenever no Suggested Title comes back (as with ADR 0005).
- TikTok turns some requests to the embed page away with 429 at random (about one in four in a burst, checked 2026-11-09). Source Lookup asks up to three times; the lookup's one deadline still bounds it.
- The post page (`/@<user>/video/<id>`) is still never asked for: it stalls for servers.
- Still no TikTok app and no key.
