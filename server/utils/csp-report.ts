// What a browser reports when a page breaks its Content Security Policy
// (server/plugins/headers.ts), in the two formats browsers send: the
// report-uri directive's (application/csp-report, one report) and the
// Reporting API's (application/reports+json, several kinds of report
// together). Anyone can send one, so only the fields worth reading are
// taken, each as text cut to a fixed length.

export const CSP_REPORT_PATH = '/api/csp-report'

export interface Violation {
  // The page, without its query: that can hold what someone searched for.
  document: string
  directive: string
  blocked: string | null
  source: string | null
  line: number | null
}

const URL_LENGTH = 200
const DIRECTIVE_LENGTH = 40
// A page that loads once reports a handful; the rest of a longer batch says
// the same again.
const REPORTS_PER_CALL = 10

type Fields = Record<string, unknown>

const fields = (value: unknown): Fields => typeof value === 'object' && value !== null ? value as Fields : {}
const text = (value: unknown, length: number) => typeof value === 'string' && value !== '' ? value.slice(0, length) : null

function violation(document: unknown, directive: unknown, blocked: unknown, source: unknown, line: unknown): Violation | null {
  const page = text(typeof document === 'string' ? document.split(/[?#]/)[0] : null, URL_LENGTH)
  const broken = text(directive, DIRECTIVE_LENGTH)
  if (page === null || broken === null) return null
  return {
    document: page,
    directive: broken,
    blocked: text(blocked, URL_LENGTH),
    source: text(source, URL_LENGTH),
    line: Number.isSafeInteger(line) ? line as number : null,
  }
}

// The violations a report's body names; none if it isn't a report.
export function violationsIn(contentType: string, body: string): Violation[] {
  let sent: unknown
  try {
    sent = JSON.parse(body)
  }
  catch {
    return []
  }
  if (contentType === 'application/csp-report') {
    const r = fields(fields(sent)['csp-report'])
    const found = violation(r['document-uri'], r['effective-directive'] ?? r['violated-directive'], r['blocked-uri'], r['source-file'], r['line-number'])
    return found ? [found] : []
  }
  if (contentType === 'application/reports+json') {
    return (Array.isArray(sent) ? sent : [sent])
      .map(fields)
      .filter(report => report.type === 'csp-violation')
      .slice(0, REPORTS_PER_CALL)
      .map((report) => {
        const r = fields(report.body)
        return violation(r.documentURL ?? report.url, r.effectiveDirective, r.blockedURL, r.sourceFile, r.lineNumber)
      })
      .filter(found => found !== null)
  }
  return []
}
