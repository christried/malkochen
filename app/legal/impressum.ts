import type { LegalText } from './text'

// The Impressum of malkochen (#391): German only. Its scope names the app's
// address; the imprint of christried.me stays on christried.me.
export const impressum: LegalText = {
  language: 'de',
  binding: true,
  title: 'Impressum',
  note: '',
  sections: [
    {
      heading: 'Angaben gemäß § 5 DDG',
      blocks: ['Dominik Christian Gilges\nAugust-Thyssen-Str. 16\n52249 Eschweiler'],
    },
    {
      heading: 'Kontakt',
      blocks: ['**E-Mail:** foodieflip.dev@gmail.com'],
    },
    {
      heading: 'Redaktionell verantwortlich',
      blocks: ['Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: Dominik Christian Gilges (Anschrift wie oben).'],
    },
    {
      heading: 'Geltungsbereich',
      blocks: ['Dieses Impressum gilt für die Web-Anwendung **malkochen** unter **malkochen.christried.me**.'],
    },
    {
      heading: 'Verbraucherstreitbeilegung',
      blocks: ['Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht bereit.'],
    },
  ],
}
