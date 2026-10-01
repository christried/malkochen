// Tailwind v4 reads this through `@config` in app/assets/css/main.css.
// Breakpoints are exactly tokens.json → breakpoints: phone < 768, tablet
// 768–1199, desktop ≥ 1200. Tailwind's default sm/md/lg/xl are removed so
// nobody reaches for a breakpoint the design doesn't have.
module.exports = {
  presets: [require('./tailwind.preset.cjs')],
  theme: {
    screens: { tablet: '768px', desktop: '1200px' },
    // Colours the app adds to the handoff's (main.css): the "Neu" pebble's
    // ink and orange, which the achievement badge shares.
    extend: {
      colors: {
        'neu-ink': 'var(--color-neu-ink)',
        'neu-accent': 'var(--color-neu-accent)',
      },
    },
  },
}
