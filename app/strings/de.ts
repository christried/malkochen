// Every piece of UI text lives here. Components read it through useStrings(),
// so adding English later means adding an `en.ts` of type `Strings` and
// choosing between them in useStrings() -- no component changes.
export const de = {
  app: {
    name: 'malkochen',
  },
  home: {
    headline: 'Was willst du mal kochen?',
    intro: 'Noch nichts hier. Füg deinen ersten Link ein!',
  },
  theme: {
    label: 'Darstellung',
    light: 'Hell',
    dark: 'Dunkel',
    system: 'System',
  },
}

export type Strings = typeof de
