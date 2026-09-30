# Claude Design prompts for malkochen

Paste these one after another, in the same Claude Design project. Only move on once you're happy with the current round. Source: the design brief in issue #1.

The prompts are in English, but the **app's UI is German**: every UI string in quotes below is the real copy to use.

## Before you start

- **Style reference:** the **Atoms** app ([godly.design/app/atoms](https://godly.design/app/atoms/)); we have approval to use its design direction. Claude Design may not be able to open the link, so **attach screenshots of it** (and any recordings of its animations) in round 1.
- **Colours are open.** Start from the reference, but we'll revisit the palette in Claude Design.
- **Motion is a first-class part of the design.** It should be everywhere it can be, to make the app playful and beautiful. There are two kinds, and every round asks Claude Design to label which kind each animation is:
  - **UI motion**: interactive, responds to touch in real time (drag, sheets, toasts, tab switches, list changes). Built in the Nuxt app itself.
  - **Motion graphics**: pre-made animated clips (animated illustrations, celebrations, empty-state loops, splash, onboarding). Produced later with **Remotion** in Claude Code, and played in the app as short looping videos.

---

## Round 1: Visual direction (phone Board and Dish card)

> I'm designing **malkochen**, a mobile-first web app with a **German UI** (casual "du" tone). Households collect food they find on TikTok, Instagram, YouTube Shorts, Pinterest and food blogs as **Dishes**. The Dishes sit on shared kanban **Boards** with the Columns "Ideen" → "Diese Woche" → "Gekocht".
>
> **Style reference:** the **Atoms** app. I've attached screenshots, and we have approval to use its design direction. Take its visual language (shapes, type, illustration style, layout rhythm, how it feels) and apply it to a food app. **Treat colours as a starting point**: we'll revisit the palette later.
>
> **Personality:** playful, joyful and beautiful. All imagery is vegan. Food photos are the star; the UI frames them. The app needs both light and dark themes.
>
> **Motion is central to this app.** I want as much motion as possible, as long as it feels delightful and never slows anyone down. For every screen you design, also describe its motion: what moves, when, how (springy, bouncy, soft), and roughly how long. Label each animation as either:
> - **UI motion** (interactive, driven by touch), or
> - **Motion graphic** (a pre-made animated clip, e.g. an animated illustration or a celebration).
>
> For now, design only the **Board screen on a phone**, in **2–3 clearly different directions** within that style:
> - A **Board switcher** at the top, showing the Board's emoji and name (e.g. "🍜 Kochclub").
> - **Column tabs** with Dish counts ("Ideen 12 · Diese Woche 3 · Gekocht 27"). One Column is visible at a time, and you swipe between Columns.
> - A **search** entry and a prominent, thumb-reachable **add** action.
> - A list of **Dish cards**. Each card has:
>   - the image (the dominant element),
>   - the title (max 2 lines, then truncated),
>   - a small **Source badge** (TikTok / Instagram / YouTube / Pinterest / web). Dishes without a link get no badge,
>   - the **avatar** of the person who added it,
>   - "3× gekocht" once it has been cooked,
>   - a small **note icon** if it has a note,
>   - a quick **"Gekocht ✓"** button and a **"…"** menu.
>
> Use realistic content, not lorem ipsum:
> - A mix of **portrait** images (TikTok/Reels/Shorts, 9:16) and **landscape** images (blogs, 4:3 or 16:9).
> - A very long title: "Knuspriger Sesam-Tofu mit Erdnusssoße und Frühlingszwiebeln".
> - One card with an **illustrated placeholder** instead of a photo (a vegan dish illustration). It must look intentional, not like an error.
> - One card marked **"Neu"**, meaning another Member added it since my last visit.
> - One card showing **"3× gekocht"**.
> - German Dish titles, e.g. "Crispy Tofu Bowl", "Omas Linsensuppe", "One-Pot Pasta mit Cashewsoße", "Veganer Käsekuchen".
>
> **Motion to sketch for this screen:**
> - how cards enter when the Board loads (e.g. a staggered pop-in),
> - how switching Column tabs and swiping feels,
> - how the "Neu" marker draws attention,
> - how the "Gekocht ✓" button reacts to a tap,
> - any idle "alive" details (the Board emoji, the add button).
>
> Show each direction in light and dark.

---

## Round 2: Board states and drag and drop (phone)

> Using the direction we chose, design the remaining **Board states on the phone**. Give every state its motion, labelled UI motion or motion graphic:
> 1. **Loading**: skeleton cards, or a playful loading animation.
> 2. **Empty Board**: "Noch nichts hier. Füg deinen ersten Link ein!", with a looping **motion graphic** (e.g. an illustrated pot or veggies bouncing) and the add action highlighted.
> 3. **Empty Column**, e.g. "Diese Woche" with nothing planned yet, with its own small animated illustration.
> 4. **Search** open with results (results animate in as you type), and **search with no results** (animated illustration).
> 5. **Dragging**:
>    - a card lifting while reordering within the Column (scale, tilt, shadow, the other cards making room),
>    - a card dragged **onto another Column's tab**, with the tab reacting playfully as a drop target (grows, wiggles, glows),
>    - the drop itself (the card flying into the tab, the tab count ticking up).
> 6. The **"…" menu** of a card, with "Verschieben nach…" and "Löschen".
> 7. The **"Verschieben nach…" picker**: the current Board's Columns first, then the other Boards and their Columns.
> 8. **Toasts** at the bottom:
>    - after tapping "Gekocht ✓": "Gekocht ✓ · Notiz hinzufügen · Rückgängig". This is the app's **big celebration moment**: design a joyful **motion graphic** (confetti of veggies, a steaming pot, a chef's kiss, whatever fits the style) plus the card leaving the Column,
>    - after deleting: "Gericht gelöscht · Rückgängig", with the card collapsing and the undo bringing it back.
>
> Light and dark for each.

---

## Round 3: Adding a Dish (all states)

> Design the **Add Dish** flow on the phone, as a bottom sheet or a full screen, whichever suits the direction.
>
> **Flow:**
> 1. Paste a link.
> 2. The app looks it up.
> 3. A **preview** appears with the image and a **suggested title**.
> 4. The user can edit the title, change the image (opens the placeholder picker), choose the **Board** (defaults to the last used one), and add an optional **note**.
> 5. "Speichern".
>
> There's also a secondary entry, **"Ohne Link hinzufügen"**, for Dishes from memory or a cookbook. It has a title, a placeholder image and a note.
>
> Show **every state**, each with its motion:
> 1. **Empty**: link field focused, with a hint like "Link von TikTok, Instagram, YouTube, Pinterest oder einem Foodblog".
> 2. **Looking up**: make the wait fun. A **motion graphic** loop (e.g. ingredients being stirred) instead of a spinner.
> 3. **Found**: the image reveals itself (not just appears), and the title types or fades in, pre-filled and editable. The Source badge pops in.
> 4. **Image only (Pinterest)**: an image was found but no title. A friendly prompt to type one ("Wie heißt das Gericht?"), gently animated so it draws attention without looking like an error.
> 5. **Nothing found**: the **placeholder picker** opens automatically and the title field is required.
> 6. **Duplicate warning**: "Schon auf dem Board: 'Crispy Tofu' in Ideen", with "Öffnen" and "Trotzdem speichern".
> 7. **Lookup failed**: a gentle message; the Dish can still be saved with a placeholder image and a typed title.
> 8. **"Ohne Link hinzufügen"** variant.
> 9. **Saved**: the sheet closes, and the new card **flies onto the Board** and lands at the top of the first Column.
>
> Light and dark.

---

## Round 4: Placeholder picker and the 12 vegan illustrations

> Define **one illustration style** that fits the Atoms-inspired direction, then create **12 placeholder illustrations**, **all vegan**. They're used as a Dish's image whenever no photo could be found:
>
> Pasta · Ramen/Suppe · Curry · Buddha Bowl · Salat · Burger · Tacos · Pizza · Wok · Porridge/Frühstück · Brot · Kuchen/Dessert
>
> Each illustration has **two forms**:
> - a **still** version (the default on the Board),
> - an **animated loop** (a **motion graphic**, 2–4 s, seamless): steam rising from the ramen, a pizza slice lifting away, tacos wiggling, bread rising. It plays when the card is in focus (e.g. on long-press, in the Dish detail, in the picker), so a Board full of placeholders doesn't turn into a wall of movement.
>
> Requirements:
> - They must look **intentional and lovely next to real food photos**, never like an error or a missing image.
> - They must work in **portrait and landscape card crops** and in light and dark themes.
> - Keep them consistent in palette, line weight, level of detail and animation style.
>
> Also design the **placeholder picker**: a grid of the 12 with the current selection clearly marked (the selected one plays its loop), opened from the Add Dish flow and from the Dish detail.

---

## Round 5: Dish detail and cooking

> Design the **Dish detail** screen on the phone, opened by tapping a card. The card should **morph into the detail**: the image expands into the header (a shared-element transition), not a plain page change.
>
> Contents:
> - A **large image** (handles portrait and landscape), with subtle parallax on scroll.
> - The **title**, the **note**, and "hinzugefügt von Lisa am 3. Sep".
> - The **Source** with an **"Original öffnen"** button, which opens TikTok/Instagram/YouTube/Pinterest or the browser.
> - Which **Board and Column** it's in.
> - The **Cooking History**: a list of cookings, each with a date, an optional note ("mit Feta besser"), who recorded it, and a way to delete an entry. Include a summary like "3× gekocht · zuletzt 12. Sep". Make that count feel like an achievement, e.g. an animated counter or a small badge that grows with every cooking.
> - Actions:
>   - **Bearbeiten** (edit title, note, image, link),
>   - **"Bild neu laden"** (re-fetch the image from the link),
>   - **"Bild ändern"** (opens the placeholder picker),
>   - **"Verschieben nach…"** (including other Boards),
>   - **Löschen**.
> - **Leave visual room** for a future "eigenes Foto" feature (the user's own photo of their version). Don't design it fully yet.
>
> Also design:
> - The **edit mode** of the Dish detail.
> - The **Cooking note sheet**: a small sheet to add a note to a cooking, opened from the "Gekocht ✓" toast or from the Cooking History.
> - Dish detail states:
>   - with no link,
>   - with a placeholder image (its loop plays here),
>   - never cooked yet (Cooking History empty state, with a small animated illustration).
>
> Label all motion as UI motion or motion graphic. Light and dark.

---

## Round 6: Boards, sharing and settings

> Design the **Board and sharing** screens on the phone, each with its motion:
> 1. **Board switcher**, opened from the top of the Board: a list of my Boards (emoji and name, maybe the number of Members) and **"Neues Board"**. The Board emojis can be alive (a subtle bounce or wiggle).
> 2. **New Board**: a name field and an **emoji picker**. It starts with the Columns "Ideen", "Diese Woche", "Gekocht". Creating the Board is a small celebration: the Columns build themselves in one by one.
> 3. **Board settings**, for any Member:
>    - rename and change the emoji,
>    - manage **Columns**: rename, reorder (drag, with the same lift feel as cards), add, delete. "Gekocht" is marked as special and cannot be deleted, but can be renamed and moved,
>    - the **Members** list, with the Owner marked,
>    - the **Invite Link**, with copy and share (to WhatsApp etc.) and a satisfying "copied" animation,
>    - **"Board verlassen"**.
> 4. **Owner-only** additions in Board settings:
>    - "Link zurücksetzen",
>    - remove a Member,
>    - "Besitz übertragen" (hand over ownership),
>    - delete the Board, with a **type-the-Board-name confirmation**.
> 5. **Delete Column dialog**: "4 Gerichte in 'Diese Woche'. Wohin verschieben?", with a Column picker (defaults to the first Column).
> 6. **Invite landing**: "Du wurdest zu 🍜 Kochclub eingeladen", with the Board's emoji and name, who invited you, and "Mit Google anmelden". Make this a warm, animated welcome (a **motion graphic**): it's many people's first contact with the app.
>
> Light and dark.

---

## Round 7: Access, user settings and system screens

> Design the remaining phone screens, each with its motion:
> 1. **Sign-in**: the app name and identity, and a "Mit Google anmelden" button. This is the first impression: give it a hero **motion graphic** (e.g. the 12 dish illustrations orbiting, or a playful intro loop) that shows what malkochen is about.
> 2. **Not unlocked**: shown when someone signs in but isn't allowed to use the app yet. Friendly, never an error look: "Du bist noch nicht für malkochen freigeschaltet. Sag Lisa Bescheid." If they came through an invite, show the Board they were invited to. Add a small, sympathetic animated illustration.
> 3. **User settings**:
>    - name and avatar from Google (read-only),
>    - **Darstellung**: Hell / Dunkel / System, with an animated theme switch,
>    - "Abmelden".
>    - Reserve a spot for a future **Sprache** (language) setting; German only for now.
> 4. **Offline** screen: a friendly "Du bist offline" message with an animated illustration.
> 5. A generic **error** screen with a retry action and an animated illustration.
> 6. The **app icon**, and an **animated splash screen** (a **motion graphic**, short) for when the app is opened from the home screen.
>
> Light and dark.

---

## Round 8: Desktop and tablet

> Adapt the approved phone design to **desktop and tablet**:
> 1. **Board**: all Columns side by side as a real kanban, with Dishes **dragged between Columns** directly. Show a card mid-drag over another Column, with the Column reacting as a drop target.
> 2. **Dish detail**: as a side panel or modal over the Board, whichever fits better, keeping the card-to-detail morph.
> 3. **Add Dish**: as a dialog.
> 4. **Board settings** and **user settings**.
> 5. **Hover motion** for the desktop: cards, buttons, badges, placeholder illustrations starting their loop on hover.
>
> Keep the phone's visual language; use the extra space for overview, not for new features. Light and dark.

---

## Round 9: Motion system and catalogue

> Now pull all the motion we've designed into one **motion system**:
> 1. **Motion principles**: the app's personality in motion (e.g. springy, bouncy, soft), and what should *never* animate.
> 2. **Motion tokens**: durations, easings and spring settings, named (e.g. `pop`, `settle`, `swoosh`, `celebrate`).
> 3. A **catalogue of every animation** in the app, as a table. For each one:
>    - where it appears and what triggers it,
>    - **UI motion** or **motion graphic**,
>    - duration, and whether it loops,
>    - a short storyboard (keyframes) for every motion graphic.
> 4. **Reduced motion**: for each animation, what happens when the user's device asks for reduced motion (usually a quick fade or a still frame). This is required, not optional.
> 5. **Performance rules**: e.g. at most one looping motion graphic playing on the Board at a time, and loops pause when off-screen.
> 6. **Backgrounds of motion graphics**: design each clip to sit on a **solid surface colour** (one light and one dark version) rather than needing a transparent background, since transparent video doesn't play reliably on iPhones. Flag the few clips where transparency is essential (e.g. confetti over the Board).

---

## Round 10: Handoff for implementation

> The design is approved. Prepare the **handoff for implementation**. The app is built with **Nuxt (Vue) and Tailwind CSS**. **UI motion** will be built in Vue. **Motion graphics** will be produced with **Remotion** (React-based video) and played in the app as short videos.
> 1. **Design tokens** for light and dark:
>    - colours (with semantic names, e.g. surface, text-muted, accent, danger),
>    - type scale and font(s),
>    - spacing scale,
>    - corner radii,
>    - shadows,
>    - the motion tokens from round 9.
> 2. A **component inventory** with variants, states and their UI motion: Dish card, Source badge, avatar, Column tabs, Board switcher, bottom sheet, dialog, toast, buttons, inputs, emoji picker, placeholder picker, Cooking History entry.
> 3. The **interaction specs**:
>    - how a card lifts when dragged,
>    - how a Column tab or Column reacts as a drop target,
>    - the "Gekocht ✓" celebration and toast timing,
>    - swipe between Columns,
>    - the card-to-detail morph,
>    - sheet open and close.
> 4. A **brief per motion graphic**, written so a coding agent can build it in Remotion. For each one:
>    - name,
>    - canvas size and aspect ratio,
>    - length and frame rate,
>    - whether it loops seamlessly,
>    - its background: prefer a **solid background** matching the surface it sits on, with one light and one dark version. Transparent video doesn't play reliably on iPhones, so mark any clip that truly needs transparency,
>    - the storyboard with timing,
>    - the illustrations and colours it uses (as exported assets),
>    - its reduced-motion still frame.
> 5. **Breakpoints**: where the phone layout switches to the multi-Column layout.
> 6. **Assets**, exported: the 12 placeholder illustrations as separate layered assets (so Remotion can animate their parts), all other illustrations, and the app icon in the sizes a web app manifest needs.
