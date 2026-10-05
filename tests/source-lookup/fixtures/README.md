# Source Lookup fixtures

Upstream responses for Seam 2. Recorded on 2026-09-30 unless noted.

| File | Origin |
|---|---|
| `tiktok-oembed.json` | Recorded: `tiktok.com/oembed` for `@scout2015/video/6718335390845095173`. |
| `youtube-oembed.json` | Recorded: `youtube.com/oembed` for Short `tPEE9ZwTmy0`. |
| `pinterest-oembed.json` | Recorded: `pinterest.com/oembed.json` for Pin `99360735500167749`, with `title` set to `"oEmbed"`, which Pinterest returns for most Pins. |
| `blog-recipe-array.html` | Recorded: loveandlemons.com brownies page, reduced to the `<head>` tags Source Lookup reads (verbatim, including unquoted attributes and a Yoast `@graph`). |
| `instagram-reel-page.html` | Recorded: `instagram.com/reel/C0WUh-tqkxU/` as served to Source Lookup's user agent, reduced to its `<head>` meta tags (verbatim). |
| `instagram-embed-captioned.html` | Recorded 2026-10-05: `instagram.com/reel/C0WUh-tqkxU/embed/captioned/` as served to Source Lookup's user agent, reduced to its `<body>` markup (verbatim; the scripts are left out). `/p/C0WUh-tqkxU/embed/captioned/` serves the same. |
| `instagram-embed-no-caption.html` | Hand-made from `instagram-embed-captioned.html`: the caption's text removed, the account's name and the comments link kept. |
| `instagram-embed-broken.html` | Recorded 2026-10-05: `instagram.com/p/AAAAAAAAAAA/embed/captioned/` (no such post), reduced to its `<body>` markup. Instagram answers 200 with an `EmbedBrokenMedia` block. |
| `instagram-login-page.html` | Hand-made: what a login wall offers (no image). |
| other `blog-*.html`, `broken-page.html` | Hand-made to cover one metadata shape each. |
