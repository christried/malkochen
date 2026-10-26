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
  // The calendar day in German time, to tell today from other days.
  const calendarDay = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE })
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: ZONE })
  const dateAndTime = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: ZONE })
  // "3. Sept." / "3 Sept", with the year only when it isn't this year.
  const dayOf = (at: Date) => (year.format(at) === year.format(new Date()) ? dayThisYear : day).format(at)
  return {
    number: (count: number) => numbers.format(count),
    plural: (count: number, forms: PluralForms) => forms[plurals.select(count)] ?? forms.other,
    day: dayOf,
    // "30. Okt. 2026": a calendar day from YYYY-MM-DD, such as a Version's,
    // with its year always. Noon UTC is that day in German time too.
    dayWithYear: (date: string) => day.format(new Date(`${date}T12:00:00Z`)),
    // "März 2026" / "March 2026".
    month: (date: Date) => month.format(date),
    // "26. Okt., 14:35": a day and its time, for a list of events.
    dateTime: (at: Date) => dateAndTime.format(at),
    // "14:35": a time of day, such as when a limit frees up again.
    time: (at: Date) => time.format(at),
    // A moment as the Dish History tells it: `today` with its time ("20:55")
    // if it was today, else its day as `day` writes it.
    moment: (at: Date, today: (time: string) => string) =>
      calendarDay.format(at) === calendarDay.format(new Date()) ? today(time.format(at)) : dayOf(at),
  }
}
