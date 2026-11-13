# Changelog

What changed in malkochen for the people using it, newest first. Shown in the app under "What's new" (/changelog). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the section names (Added, Changed, Removed, Fixed, Security) stay in English in every language's file: the app shows them translated. The German and Italian versions are `CHANGELOG.de.md` and `CHANGELOG.it.md`, changed in the same PR as this one.

## [Unreleased]

### Added

- Every board has a shopping list now, the same for everyone on it: a third view beside Columns and Week. Open a dish and tap Put on the shopping list to add its ingredients (untick what you already have), or put the whole week on at once from the week plan. Type in anything else you need, and in the shop tap a line to tick it off. Clear done tidies the list, and it all works without a connection too.

### Changed

- The privacy policy now names the week plan and the shopping list among what you store on a board.
- When the Recipe Finder found no recipe, Search again asks it once more. A dish can be searched twice an hour.

### Fixed

- Find recipe now reads the caption of posts added before malkochen kept captions, so a recipe written under an older TikTok is found too.

## [1.3.0] - 2026-11-12

### Added

- Dishes can hold a recipe now. Open a dish and tap Add recipe to write down the ingredients and steps line by line, even without a connection. A pasted list becomes one line per row, and search finds a dish by what goes in it.
- Want malkochen to look up a dish’s recipe for you? You can ask for the Recipe Finder in your settings.
- Every board has a week plan now, beside its columns: a switch at the top moves between Columns and Week. Put dishes on the days you want to cook them, the same dish on several days or several on one day, and say who cooks. On the day, tick a dish off as Cooked ✓ straight from the plan, even without a connection.

### Changed

- The privacy policy now has a section on the Recipe Finder: when it looks for a recipe for you, the caption and the text of the linked page go to Anthropic.

## [1.2.1] - 2026-11-11

### Changed

- A tidier look: in a dish, Cooked ✓ now sits right under the title, next to Open original, so you don’t have to scroll for it. Cards show more of a dish’s title, and on phones the board is calmer, with the cards lying straight on the column’s colour.

## [1.2.0] - 2026-11-10

### Added

- Cooked several dishes? Select them (long-press one, or Ctrl-click on desktop), tap Cooked ✓, and every one of them counts. One celebration for the lot, a classic still gets its own, and one Undo takes it all back.
- malkochen works with a weak signal, or none at all. Boards you’ve opened stay on your phone, so you can move dishes, tap Cooked ✓, comment, give a thumb, fix a title or add a dish by link. It all arrives once you’re back online, and a small bar tells you what’s still waiting.

## [1.1.2] - 2026-11-09

### Changed

- The privacy policy now has a section on Snackbert, a nutrition app you can tell about the dishes you cook, if you have an account there.

## [1.1.1] - 2026-11-09

### Changed

- The privacy policy now says that for TikTok links, as for Instagram, malkochen reads the post’s public embed page.

### Fixed

- Pasting a TikTok link fills in the title, the picture, who posted it and the post’s text again. TikTok had quietly stopped handing them out.

## [1.1.0] - 2026-10-26

### Added

- Share a dish: Share link gives you a link anyone can open, no account needed. If they like the dish, they can copy it onto a board of their own, signing up on the way if they’re new.
- Copy a dish onto another of your boards, with its picture, its link and everything malkochen found about it.
- The post’s text: malkochen keeps the caption a post comes with and shows it in the dish, and search finds dishes by it too. Dishes you added before get theirs over the next few days.
- What’s new pops up: after an update, malkochen shows you once what changed.
- A friendly nudge: if push notifications or the daily email are off, Topfbert asks now and then whether you’d like them, at most once a month and never when something else just popped up.
- Imprint and privacy policy now live inside malkochen, in your language, linked at the bottom of every board.
- Our emails show malkochen’s logo in Gmail.

### Changed

- Push notifications say who did what on which board, and show the dish’s picture.
- Play video only shows on dishes whose video really plays in malkochen.
- What’s new got a makeover: a card for every version, and on desktop a rail to jump between them.
- Our privacy policy is new. It describes malkochen as it is today, including dish links, copies, and that whoever runs malkochen can open every board to help out. Have a look under Privacy at the bottom of any board.
- On desktop, the search opens in the middle of the header, and the settings sit right next to your picture.

### Fixed

- Sheets and windows no longer close when you drag or select text out of them, or when you click beside them after typing something. The close button, Escape and Cancel still close them.
- Field labels sit neatly in the field’s outline, also when Chrome fills the field in for you.
- The comment field’s button and text are centred, with no extra space above.

## [1.0.0] - 2026-10-22

### Added

- Boards: collect what you want to cook, on your own or with others. Invite people with a link, sort dishes into columns like Ideas and This week, find any dish with search, and see at a glance what others added since you last looked.
- Dishes from links: paste one from TikTok, Instagram, YouTube Shorts, Pinterest or a food blog, and malkochen finds the picture, a title and who made it. Videos play right in the dish, and once malkochen is installed on Android, you can share links to it straight from the app you found them in. No link? Add a dish from memory, with your own photo or one of our drawings.
- Cooked and classics: move a dish into Cooked whenever you make it. Each time it climbs a level, from tried to rising favourite to staple, and on the 10th it’s a classic, which Topfbert celebrates with you.
- Votes and comments: give a cooked dish a thumbs up or down, and talk about any dish. Its history shows everything that happened to it, and its card lights up when there’s something new.
- The archive: archived dishes and boards wait there for 30 days, so you can always bring them back.
- Permissions: a board’s owner decides what each member may do, or lets them just look, comment and vote.
- Languages: malkochen speaks German, English and Italian. Pick yours in your settings, and light or dark while you’re there.
- Notifications: push notifications on your devices and a daily email, if you want them, when others add dishes, comment or vote on your boards.
- The tour: Topfbert shows you round the first time you open a board, and again whenever you start it in your settings.
- Open to everyone: anyone can sign up, with Google or a code we email you, and delete your account yourself whenever you like.
- What’s new: this page, linked at the end of your settings and marked New after every update.

[Unreleased]: https://github.com/christried/malkochen/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/christried/malkochen/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/christried/malkochen/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/christried/malkochen/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/christried/malkochen/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/christried/malkochen/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/christried/malkochen/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/christried/malkochen/releases/tag/v1.0.0
