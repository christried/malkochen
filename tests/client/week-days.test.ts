import { expect, test } from 'vitest'
import { addDays, addWeeks, isCurrentWeek, isPastDay, weekDays, weekStart } from '../../app/board/week-days'
import { de } from '../../app/strings/de'
import { en } from '../../app/strings/en'
import { it } from '../../app/strings/it'

// The days of a Week Plan (CONTEXT.md: Week Plan): Monday to Sunday in every
// language, by calendar date in German time.

test('a week runs Monday to Sunday, whichever of its days is asked for', () => {
  const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
  expect(weekDays('2026-11-16')).toEqual(week)
  expect(weekDays('2026-11-19')).toEqual(week)
  expect(weekDays('2026-11-22')).toEqual(week)
  expect(weekStart('2026-11-22')).toBe('2026-11-16')
})

test('a week across a month and a year', () => {
  expect(weekDays('2026-12-31')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
})

test('days and weeks are added across the clocks changing', () => {
  expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
  expect(addWeeks('2026-10-19', 1)).toBe('2026-10-26')
  expect(addWeeks('2026-11-16', -3)).toBe('2026-10-26')
})

test('a day is past before today, and today is not', () => {
  expect(isPastDay('2026-11-18', '2026-11-19')).toBe(true)
  expect(isPastDay('2026-11-19', '2026-11-19')).toBe(false)
  expect(isPastDay('2026-11-20', '2026-11-19')).toBe(false)
})

test('the current week is the one holding today', () => {
  expect(isCurrentWeek('2026-11-16', '2026-11-22')).toBe(true)
  expect(isCurrentWeek('2026-11-16', '2026-11-23')).toBe(false)
  expect(isCurrentWeek('2026-11-23', '2026-11-23')).toBe(true)
})

// A Thursday, so the year of the week is the same as the year of its days.
const NOW = new Date('2026-11-19T10:00:00.000Z')

test('the week title says which week, in each language', () => {
  expect(de.week.title('2026-11-16', NOW)).toBe('16. bis 22. November')
  expect(en.week.title('2026-11-16', NOW)).toBe('16 to 22 November')
  expect(it.week.title('2026-11-16', NOW)).toBe('16 al 22 novembre')
})

test('a week across two months names both', () => {
  expect(de.week.title('2026-10-26', NOW)).toBe('26. Oktober bis 1. November')
  expect(en.week.title('2026-10-26', NOW)).toBe('26 October to 1 November')
  expect(it.week.title('2026-10-26', NOW)).toBe('26 ottobre al 1 novembre')
})

test('a week across a year, or of another year, carries its year', () => {
  expect(de.week.title('2026-12-28', NOW)).toBe('28. Dezember 2026 bis 3. Januar 2027')
  expect(de.week.title('2027-12-27', NOW)).toBe('27. Dezember 2027 bis 2. Januar 2028')
  expect(de.week.title('2025-11-17', NOW)).toBe('17. bis 23. November 2025')
  expect(en.week.title('2027-12-27', NOW)).toBe('27 December 2027 to 2 January 2028')
})

test('day names come from the language', () => {
  expect(de.week.weekday('2026-11-19')).toBe('Donnerstag')
  expect(en.week.weekday('2026-11-19')).toBe('Thursday')
  expect(it.week.weekday('2026-11-19')).toBe('Giovedì')
  expect(de.week.weekdayShort('2026-11-16')).toBe('Mo')
  expect(en.week.weekdayShort('2026-11-16')).toBe('Mon')
  expect(it.week.weekdayShort('2026-11-16')).toBe('Lun')
})

test('the day of the month, as the language writes it', () => {
  expect(de.week.dayOfMonth('2026-11-16')).toBe('16.')
  expect(en.week.dayOfMonth('2026-11-16')).toBe('16')
})

test('a day in a sentence: today, tomorrow, a weekday, or a date past this week', () => {
  const today = '2026-11-19'
  expect(de.week.dayPhrase('2026-11-19', today)).toBe('heute')
  expect(de.week.dayPhrase('2026-11-20', today)).toBe('morgen')
  expect(de.week.dayPhrase('2026-11-21', today)).toBe('Samstag')
  expect(de.week.dayPhrase('2026-11-26', today)).toBe('Donnerstag, 26. November')
  expect(en.week.dayPhrase('2026-11-26', today)).toBe('Thursday, 26 November')
})
