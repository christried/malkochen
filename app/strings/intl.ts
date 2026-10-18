// What every language's strings write the same way, each in its own
// language (#326): counts by its plural rules, numbers and dates as it writes
// them. Dates always in German time, so the server and the browser render
// the same day.
const ZONE = 'Europe/Berlin'

// A word's forms by plural category ("one", "other", and whichever others the
// language has); "other" for any it leaves out.
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

export function intlFor(locale: string) {
  const plurals = new Intl.PluralRules(locale)
  const numbers = new Intl.NumberFormat(locale)
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: ZONE })
  const dayThisYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: ZONE })
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONE })
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: ZONE })
  return {
    number: (count: number) => numbers.format(count),
    plural: (count: number, forms: PluralForms) => forms[plurals.select(count)] ?? forms.other,
    // "3. Sept." / "3 Sept", with the year only when it isn't this year.
    day: (date: Date) => (year.format(date) === year.format(new Date()) ? dayThisYear : day).format(date),
    // "März 2026" / "March 2026".
    month: (date: Date) => month.format(date),
  }
}
