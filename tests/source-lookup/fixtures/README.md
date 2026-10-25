# Source Lookup fixtures

Upstream responses for Seam 2. Recorded on 2026-09-30 unless noted.

| File | Origin |
|---|---|
| `tiktok-oembed.json` | Recorded: `tiktok.com/oembed` for `@scout2015/video/6718335390845095173`. |
| `tiktok-oembed-eatthis.json` | Recorded 2026-10-14: `tiktok.com/oembed` for `@eatthisorg/video/7688042287548370208`, whose caption opens with a headline in caps and runs on in one line. |
| `youtube-oembed.json` | Recorded: `youtube.com/oembed` for Short `tPEE9ZwTmy0`. |
| `pinterest-oembed.json` | Recorded: `pinterest.com/oembed.json` for Pin `99360735500167749`, with `title` set to `"oEmbed"`, which Pinterest returns for most Pins. |
| `pinterest-pin-page.html` | Recorded 2026-10-05: the Pin page for Pin `99360735500167749` (`www.pinterest.com` redirects to `de.pinterest.com`) as served to Source Lookup's user agent, reduced to its `<head>` meta tags and title (verbatim). Its `og:title` is "<Pin title> \| <board keywords>". |
| `pinterest-pin-page-plain-title.html` | Recorded 2026-10-05 like the one above, for Pin `85779567902561995`, whose `og:title` has no ` \| `. |
| `pinterest-pin-page-untitled.html` | Recorded 2026-10-05 like the one above, for Pin `99360735527172842`, which has no title of its own: its `og:title` is "Pin auf Instagram" ("Pin on Instagram" in English), made up from its board. |
| `pinterest-pin-page-missing.html` | Recorded 2026-10-05 like the one above, for a Pin that doesn't exist: Pinterest answers 200 with no Pin in it. |
| `blog-recipe-array.html` | Recorded: loveandlemons.com brownies page, reduced to the `<head>` tags Source Lookup reads (verbatim, including unquoted attributes and a Yoast `@graph`). |
| `instagram-reel-page.html` | Recorded: `instagram.com/reel/C0WUh-tqkxU/` as served to Source Lookup's user agent, reduced to its `<head>` meta tags (verbatim). |
| `instagram-embed-captioned.html` | Recorded 2026-10-05: `instagram.com/reel/C0WUh-tqkxU/embed/captioned/` as served to Source Lookup's user agent, reduced to its `<body>` markup (verbatim; the scripts are left out). `/p/C0WUh-tqkxU/embed/captioned/` serves the same. |
| `instagram-embed-no-caption.html` | Hand-made from `instagram-embed-captioned.html`: the caption's text removed, the account's name and the comments link kept. |
| `instagram-embed-broken.html` | Recorded 2026-10-05: `instagram.com/p/AAAAAAAAAAA/embed/captioned/` (no such post), reduced to its `<body>` markup. Instagram answers 200 with an `EmbedBrokenMedia` block. |
| `instagram-embed-video.html` | Recorded 2026-10-16: `instagram.com/reel/Cw2sj1dqqLh/embed/` as served to Source Lookup's user agent, reduced to its `<body>` markup (verbatim; scripts and styles left out). A Reel Instagram's embed plays in place. |
| `instagram-embed-watch-on-instagram.html` | Recorded 2026-10-16 like the one above, for `/reel/DFvsVH_OD9h/embed/`: a Reel Instagram's embed only shows with "Auf Instagram ansehen" (a `WatchOnInstagramContainer` block), which opens Instagram (#279). |
| `instagram-login-page.html` | Hand-made: what a login wall offers (no image). |
| other `blog-*.html`, `broken-page.html` | Hand-made to cover one metadata shape each. |
| `youtube-short-page.html` | Recorded 2026-10-25: `youtube.com/shorts/tPEE9ZwTmy0` as served to Source Lookup's user agent, reduced to its description, `og:` and title tags (verbatim, one per line). |
