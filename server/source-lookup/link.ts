// Small helpers for links, and for reading the loosely typed values upstreams
// return.

const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|dclid|msclkid|igshid|igsh|mc_cid|mc_eid|_hs\w+|si)$/i

// The link without its fragment and the tracking parameters share buttons
// add, so the same page pasted twice gives the same canonical link.
export function withoutTracking(url: URL): string {
  const clean = new URL(url.href)
  clean.hash = ''
  for (const key of [...clean.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) clean.searchParams.delete(key)
  }
  return clean.href
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

// An absolute http(s) URL, resolved against `base` if relative; otherwise null.
export function httpUrl(value: unknown, base?: string): string | null {
  // Whitespace inside means it's not a link at all, not a relative one.
  if (typeof value !== 'string' || !value.trim() || /\s/.test(value.trim())) return null
  try {
    const url = new URL(value.trim(), base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  }
  catch {
    return null
  }
}
