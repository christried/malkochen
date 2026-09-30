# Source Lookup fixtures

Upstream responses for Seam 2. Recorded on 2026-09-30 unless noted.

| File | Origin |
|---|---|
| `tiktok-oembed.json` | Recorded: `tiktok.com/oembed` for `@scout2015/video/6718335390845095173`. |
| `youtube-oembed.json` | Recorded: `youtube.com/oembed` for Short `tPEE9ZwTmy0`. |
| `pinterest-oembed.json` | Recorded: `pinterest.com/oembed.json` for Pin `99360735500167749`, with `title` set to `"oEmbed"`, which Pinterest returns for most Pins. |
| `blog-recipe-array.html` | Recorded: loveandlemons.com brownies page, reduced to the `<head>` tags Source Lookup reads (verbatim, including unquoted attributes and a Yoast `@graph`). |
| `instagram-oembed*.json` | Hand-made in the shape of Meta's documented `instagram_oembed` response (recording needs a Meta app token); `-no-fields` is that response after Meta drops `title` and `thumbnail_url`. |
| other `blog-*.html`, `broken-page.html` | Hand-made to cover one metadata shape each. |
