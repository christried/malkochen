import { expect, test } from 'vitest'
import { LEGAL_LINKS } from '../../app/utils/legal'
import { datenschutz } from '../../app/legal/datenschutz'
import { impressum } from '../../app/legal/impressum'

// The legal pages (#391): Impressum (German only) and Datenschutz (German
// binding, English and Italian as translations), in the app itself.

test('the legal links lead to the pages in malkochen', () => {
  expect(LEGAL_LINKS).toEqual([
    { label: 'impressum', href: '/impressum' },
    { label: 'privacy', href: '/datenschutz' },
  ])
})

test('the Impressum is German and names malkochen.christried.me', () => {
  expect(impressum.language).toBe('de')
  expect(impressum.sections.map(section => section.heading)).toContain('Angaben gemäß § 5 DDG')
  expect(JSON.stringify(impressum)).toContain('malkochen.christried.me')
})

test('the Datenschutz comes in German, English and Italian, the German one binding', () => {
  expect(datenschutz.map(text => text.language)).toEqual(['de', 'en', 'it'])
  const [german, english, italian] = datenschutz
  expect(german!.binding).toBe(true)
  expect(english!.binding).toBe(false)
  expect(italian!.binding).toBe(false)
})

test.each(datenschutz.map(text => [text.language, text] as const))('the %s Datenschutz has the same sections as the German one, none empty', (_, text) => {
  const german = datenschutz[0]!
  expect(text.sections.length).toBe(german.sections.length)
  for (const section of text.sections) {
    expect(section.heading.trim()).not.toBe('')
    expect(section.blocks.length).toBeGreaterThan(0)
    for (const block of section.blocks) {
      if (typeof block === 'string') expect(block.trim()).not.toBe('')
      else expect(block.list.length).toBeGreaterThan(0)
    }
  }
})

test('the German Datenschutz describes 1.0.0: Open Sign-up, the Email Digest, Comments and Votes, the Event Log, deleting the account', () => {
  const german = JSON.stringify(datenschutz[0])
  expect(german).toContain('Open Sign-up')
  expect(german).toContain('E-Mail-Zusammenfassung')
  expect(german).toContain('Kommentare')
  expect(german).toContain('Ereignisprotokoll')
  expect(german).toContain('Konto')
  expect(german).toContain('Resend')
  // The old, pre-1.0.0 wording is gone.
  expect(german).not.toContain('Notiz')
})
