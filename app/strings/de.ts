// Every piece of UI text lives here. Components read it through useStrings(),
// so adding English later means adding an `en.ts` of type `Strings` and
// choosing between them in useStrings() -- no component changes.
export const de = {
  app: {
    name: 'malkochen',
  },
  signIn: {
    headline: 'Was willst du mal kochen?',
    intro: 'Sammelt Essen, das ihr online findet, und plant, was ihr als Nächstes kocht.',
    google: 'Mit Google anmelden',
    failed: 'Die Anmeldung hat nicht geklappt. Versuch es gleich noch mal.',
  },
  notUnlocked: {
    headline: 'Gleich geht’s los!',
    body: 'Du bist noch nicht für malkochen freigeschaltet. Sag der Person Bescheid, die dich eingeladen hat, dann kannst du loslegen.',
    otherAccount: 'Mit einem anderen Konto anmelden',
  },
  board: {
    emptyColumn: 'Noch nichts hier.',
    signOut: 'Abmelden',
  },
  theme: {
    label: 'Darstellung',
    light: 'Hell',
    dark: 'Dunkel',
    system: 'System',
  },
}

export type Strings = typeof de
