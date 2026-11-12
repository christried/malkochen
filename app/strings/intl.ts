// What every language's strings write the same way, each in its own
// language (#326): counts by its plural rules, numbers and dates as it writes
// them. Dates always in German time, so the server and the browser render
// the same day.
const ZONE = 'Europe/Berlin'

// The calendar day in German time, as YYYY-MM-DD (en-CA writes it so).
const calendarDay = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE })

// The calendar day of a moment in German time, as YYYY-MM-DD: the day a Cooking
// counts for, and the day of a Planned Dish.
export function berlinDay(at: Date | string): string {
  return calendarDay.format(typeof at === 'string' ? new Date(at) : at)
}

// A word's forms by plural category ("one", "other", and whichever others the
// language has); "other" for any it leaves out.
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

export function intlFor(locale: string) {
  const plurals = new Intl.PluralRules(locale)
  const numbers = new Intl.NumberFormat(locale)
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: ZONE })
  const dayThisYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: ZONE })
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONE })
  const longDayThisYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: ZONE })
  const longDay = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONE })
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: ZONE })
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: ZONE })
  const dateAndTime = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: ZONE })
  // "3. Sept." / "3 Sept", with the year only when it isn't this year.
  const dayOf = (at: Date) => (year.format(at) === year.format(new Date()) ? dayThisYear : day).format(at)
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: ZONE })
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: ZONE })
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: ZONE })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: ZONE })
  // A calendar day, YYYY-MM-DD, as a moment: noon UTC is that day in German time too.
  const noon = (date: string) => new Date(`${date}T12:00:00Z`)
  // A word starting with a capital: Italian writes its days small.
  const capital = (word: string) => word.charAt(0).toLocaleUpperCase(locale) + word.slice(1)
  return {
    // "Donnerstag" / "Thursday", from a calendar day, YYYY-MM-DD.
    weekday: (date: string) => capital(weekdayLong.format(noon(date))),
    // "Do" / "Thu" / "Gio": without the dot some languages add.
    weekdayShort: (date: string) => capital(weekdayShort.format(noon(date)).replace(/\.$/, '')),
    // "19": the number of a day in its month.
    dayNumber: (date: string) => dayNumber.format(noon(date)),
    // "26. November": a day with its month, never its year.
    dayMonth: (date: string) => longDayThisYear.format(noon(date)),
    // "16. bis 22. November": a week from its first day to its last, joined
    // by `to`. The month is named once if both are in it. The year appears
    // when the week isn't in the year of `now` or spans two years: once at
    // the end if both days share a month, else on both days.
    weekRange: (first: string, last: string, to: string, now: Date) => {
      const [a, b] = [noon(first), noon(last)]
      const showYear = year.format(a) !== year.format(b) || year.format(a) !== year.format(now)
      const dayWith = (at: Date) => (showYear ? longDay : longDayThisYear).format(at)
      if (monthName.format(a) !== monthName.format(b)) return `${dayWith(a)} ${to} ${dayWith(b)}`
      const start = longDayThisYear.format(a).replace(monthName.format(a), '').trim()
      return `${start} ${to} ${dayWith(b)}`
    },
    number: (count: number) => numbers.format(count),
    plural: (count: number, forms: PluralForms) => forms[plurals.select(count)] ?? forms.other,
    day: dayOf,
    // "12. November" / "12 November": a day with its month written out, for a
    // sentence; with the year only when it isn't this year.
    dayInFull: (at: Date) => (year.format(at) === year.format(new Date()) ? longDayThisYear : longDay).format(at),
    // "30. Okt. 2026": a calendar day from YYYY-MM-DD, such as a Version's,
    // with its year always. Noon UTC is that day in German time too.
    dayWithYear: (date: string) => day.format(new Date(`${date}T12:00:00Z`)),
    // "März 2026" / "March 2026".
    month: (date: Date) => month.format(date),
    // "26. Okt., 14:35": a day and its time, for a list of events.
    dateTime: (at: Date) => dateAndTime.format(at),
    // "14:35": a time of day, such as when a limit frees up again.
    time: (at: Date) => time.format(at),
    // Whether `at` is today, in German time.
    isToday: (at: Date) => calendarDay.format(at) === calendarDay.format(new Date()),
    // A moment as the Dish History tells it: `today` with its time ("20:55")
    // if it was today, else its day as `day` writes it.
    moment: (at: Date, today: (time: string) => string) =>
      calendarDay.format(at) === calendarDay.format(new Date()) ? today(time.format(at)) : dayOf(at),
  }
}
