import { expect, test } from 'vitest'
import { chooseLanguage } from '../../shared/language'

// Choosing the language (#326): the user's stored choice, else the first of
// the browser's preferred languages malkochen speaks, else English. The
// browser's languages come as the Accept-Language header (the server) or
// as navigator.languages (the browser).

test.each([
  ['de', 'en-US,en;q=0.9', 'de'],
  ['en', 'de-DE,de;q=0.9', 'en'],
  ['auto', 'de-DE,de;q=0.9', 'de'],
  ['auto', 'en-GB', 'en'],
])('stored choice %s with Accept-Language %s gives %s', (choice, header, language) => {
  expect(chooseLanguage(choice, header)).toBe(language)
})

test('a choice malkochen doesn\'t know counts as "auto"', () => {
  expect(chooseLanguage('fr', 'de')).toBe('de')
  expect(chooseLanguage(null, 'de')).toBe('de')
  expect(chooseLanguage(undefined, 'en')).toBe('en')
})

test('a regional language counts as its language', () => {
  expect(chooseLanguage('auto', 'de-CH')).toBe('de')
  expect(chooseLanguage('auto', 'de-AT,en;q=0.5')).toBe('de')
  expect(chooseLanguage('auto', 'EN-gb')).toBe('en')
})

test('the weights decide, not the order the header lists them in', () => {
  expect(chooseLanguage('auto', 'en-GB;q=0.8,de;q=0.9')).toBe('de')
  expect(chooseLanguage('auto', 'en-GB;q=0.8, de-DE')).toBe('de')
  expect(chooseLanguage('auto', 'de;q=0.5, en-GB;q=0.8')).toBe('en')
  // A language weighted 0 is one the browser doesn't want.
  expect(chooseLanguage('auto', 'de;q=0, fr')).toBe('en')
})

test('languages malkochen doesn\'t speak are passed over for the next one it does', () => {
  expect(chooseLanguage('auto', 'fr-FR,fr;q=0.9,de;q=0.8')).toBe('de')
  expect(chooseLanguage('auto', 'es-ES, it;q=0.7, en;q=0.5')).toBe('it')
})

test('Italian, from Italy or Switzerland, gets Italian (#327)', () => {
  expect(chooseLanguage('auto', 'it-IT,it;q=0.9,en;q=0.8')).toBe('it')
  expect(chooseLanguage('auto', 'it-CH, en-GB;q=0.8')).toBe('it')
  expect(chooseLanguage('auto', 'de-CH;q=0.4, it-CH;q=0.9')).toBe('it')
  expect(chooseLanguage('auto', ['it-CH', 'de-CH'])).toBe('it')
  expect(chooseLanguage('it', 'de-DE')).toBe('it')
  expect(chooseLanguage('de', 'it-IT')).toBe('de')
})

test('with none malkochen speaks, it is English', () => {
  expect(chooseLanguage('auto', 'fr-FR,fr;q=0.9')).toBe('en')
  expect(chooseLanguage('auto', '*')).toBe('en')
})

test('without any preferred language, it is English', () => {
  expect(chooseLanguage('auto', '')).toBe('en')
  expect(chooseLanguage('auto', [])).toBe('en')
  expect(chooseLanguage('auto', null)).toBe('en')
  expect(chooseLanguage('auto', ',;q=0.5, ')).toBe('en')
})

test('the browser\'s own list (navigator.languages) is taken in its order', () => {
  expect(chooseLanguage('auto', ['fr-FR', 'de-DE', 'en-US'])).toBe('de')
  expect(chooseLanguage('auto', ['en-US', 'de'])).toBe('en')
  expect(chooseLanguage('de', ['en-US'])).toBe('de')
})
