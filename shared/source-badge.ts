import type { SourceKind } from '../server/source-lookup'

// The five Source badges (PRD: TikTok, Instagram, YouTube, Pinterest and
// blog/web). Reels and posts share Instagram's; any web page gets "web".
export type SourceBadgeKind = 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'web'

export function badgeKind(kind: SourceKind): SourceBadgeKind {
  switch (kind) {
    case 'tiktok': return 'tiktok'
    case 'instagram-reel':
    case 'instagram-post': return 'instagram'
    case 'youtube-short': return 'youtube'
    case 'pinterest-pin': return 'pinterest'
    case 'blog':
    case 'other': return 'web'
  }
}
