# Claude Design prompts for malkochen

Paste these one after another, in the same Claude Design project. Only move on once you're happy with the current round. Source: the design brief in issue #1.

The prompts are in English, but the **app's UI is German**: every UI string in quotes below is the real copy to use.

---

## Round 1: Visual direction (phone Board and Dish card)

> I'm designing **malkochen**, a mobile-first web app with a **German UI** (casual "du" tone). Households collect food they find on TikTok, Instagram, YouTube Shorts, Pinterest and food blogs as **Dishes**. The Dishes sit on shared kanban **Boards** with the Columns "Ideen" → "Diese Woche" → "Gekocht".
>
> **Look & feel:** warm, plant-based, food-forward. Food photos are the star; the UI frames them and never competes with them. All imagery is vegan. The app needs both light and dark themes. [Attach or describe my references here.]
>
> For now, design only the **Board screen on a phone**, in **2–3 clearly different visual directions**:
> - A **Board switcher** at the top, showing the Board's emoji and name (e.g. "🍜 WG-Küche").
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
> Show each direction in light and dark.

---

## Round 2: Board states and drag and drop (phone)

> Using the direction we chose, design the remaining **Board states on the phone**:
> 1. **Loading** (skeleton cards).
> 2. **Empty Board**: a warm empty state, e.g. "Noch nichts hier. Füg deinen ersten Link ein!", with the add action highlighted.
> 3. **Empty Column**, e.g. "Diese Woche" with nothing planned yet.
> 4. **Search** open with results, and **search with no results**.
> 5. **Dragging**: a card lifted while reordering within the Column. Also a card dragged **onto another Column's tab**, with the tab clearly reacting as a drop target.
> 6. The **"…" menu** of a card, with "Verschieben nach…" and "Löschen".
> 7. The **"Verschieben nach…" picker**: the current Board's Columns first, then the other Boards and their Columns.
> 8. **Toasts** at the bottom:
>    - after tapping "Gekocht ✓": "Gekocht ✓ · Notiz hinzufügen · Rückgängig",
>    - after deleting: "Gericht gelöscht · Rückgängig".
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
> Show **every state**:
> 1. **Empty**: link field focused, with a hint like "Link von TikTok, Instagram, YouTube, Pinterest oder einem Foodblog".
> 2. **Looking up**: a loading state.
> 3. **Found**: image and a pre-filled, editable title.
> 4. **Image only (Pinterest)**: an image was found but no title. A friendly prompt to type one ("Wie heißt das Gericht?"). It must not look like an error.
> 5. **Nothing found**: the **placeholder picker** opens automatically and the title field is required.
> 6. **Duplicate warning**: "Schon auf dem Board: 'Crispy Tofu' in Ideen", with "Öffnen" and "Trotzdem speichern".
> 7. **Lookup failed**: a gentle message; the Dish can still be saved with a placeholder image and a typed title.
> 8. **"Ohne Link hinzufügen"** variant.
>
> Light and dark.

---

## Round 4: Placeholder picker and the 12 vegan illustrations

> Define **one illustration style** that fits our direction, then create **12 placeholder illustrations**, **all vegan**. They're used as a Dish's image whenever no photo could be found:
>
> Pasta · Ramen/Suppe · Curry · Buddha Bowl · Salat · Burger · Tacos · Pizza · Wok · Porridge/Frühstück · Brot · Kuchen/Dessert
>
> Requirements:
> - They must look **intentional and lovely next to real food photos** on the Board, never like an error or a missing image.
> - They must work in **portrait and landscape card crops** and in light and dark themes.
> - Keep them consistent in palette, line weight and level of detail.
>
> Also design the **placeholder picker**: a grid of the 12 with the current selection clearly marked, opened from the Add Dish flow and from the Dish detail.

---

## Round 5: Dish detail and cooking

> Design the **Dish detail** screen on the phone, opened by tapping a card:
> - A **large image** (handles portrait and landscape).
> - The **title**, the **note**, and "hinzugefügt von Lisa am 3. Sep".
> - The **Source** with an **"Original öffnen"** button, which opens TikTok/Instagram/YouTube/Pinterest or the browser.
> - Which **Board and Column** it's in.
> - The **Cooking History**: a list of cookings, each with a date, an optional note ("mit Feta besser"), who recorded it, and a way to delete an entry. Include a summary like "3× gekocht · zuletzt 12. Sep".
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
>   - with a placeholder image,
>   - never cooked yet (Cooking History empty state).
>
> Light and dark.

---

## Round 6: Boards, sharing and settings

> Design the **Board and sharing** screens on the phone:
> 1. **Board switcher**, opened from the top of the Board: a list of my Boards (emoji and name, maybe the number of Members) and **"Neues Board"**.
> 2. **New Board**: a name field and an **emoji picker**. It starts with the Columns "Ideen", "Diese Woche", "Gekocht".
> 3. **Board settings**, for any Member:
>    - rename and change the emoji,
>    - manage **Columns**: rename, reorder, add, delete. "Gekocht" is marked as special and cannot be deleted, but can be renamed and moved,
>    - the **Members** list, with the Owner marked,
>    - the **Invite Link**, with copy and share (to WhatsApp etc.),
>    - **"Board verlassen"**.
> 4. **Owner-only** additions in Board settings:
>    - "Link zurücksetzen",
>    - remove a Member,
>    - "Besitz übertragen" (hand over ownership),
>    - delete the Board, with a **type-the-Board-name confirmation**.
> 5. **Delete Column dialog**: "4 Gerichte in 'Diese Woche'. Wohin verschieben?", with a Column picker (defaults to the first Column).
> 6. **Invite landing**: "Du wurdest zu 🍜 WG-Küche eingeladen", with the Board's emoji and name, who invited you, and "Mit Google anmelden".
>
> Light and dark.

---

## Round 7: Access, user settings and system screens

> Design the remaining phone screens:
> 1. **Sign-in**: the app name and identity, and a "Mit Google anmelden" button. This is the first impression, so make it inviting.
> 2. **Not unlocked**: shown when someone signs in but isn't allowed to use the app yet. Friendly, never an error look: "Du bist noch nicht für malkochen freigeschaltet. Sag Lisa Bescheid." If they came through an invite, show the Board they were invited to.
> 3. **User settings**:
>    - name and avatar from Google (read-only),
>    - **Darstellung**: Hell / Dunkel / System,
>    - "Abmelden".
>    - Reserve a spot for a future **Sprache** (language) setting; German only for now.
> 4. **Offline** screen: a friendly "Du bist offline" message.
> 5. A generic **error** screen with a retry action.
> 6. The **app icon** and **splash screen** for when the app is installed on the home screen.
>
> Light and dark.

---

## Round 8: Desktop and tablet

> Adapt the approved phone design to **desktop and tablet**:
> 1. **Board**: all Columns side by side as a real kanban, with Dishes **dragged between Columns** directly. Show a card mid-drag over another Column.
> 2. **Dish detail**: as a side panel or modal over the Board, whichever fits better.
> 3. **Add Dish**: as a dialog.
> 4. **Board settings** and **user settings**.
>
> Keep the phone's visual language; use the extra space for overview, not for new features. Light and dark.

---

## Round 9: Handoff for implementation

> The design is approved. Prepare the **handoff for implementation** in Nuxt with Tailwind CSS:
> 1. **Design tokens** for light and dark:
>    - colours (with semantic names, e.g. surface, text-muted, accent, danger),
>    - type scale and font(s),
>    - spacing scale,
>    - corner radii,
>    - shadows,
>    - motion (durations, easings).
> 2. A **component inventory** with variants and states: Dish card, Source badge, avatar, Column tabs, Board switcher, bottom sheet, dialog, toast, buttons, inputs, emoji picker, placeholder picker, Cooking History entry.
> 3. The **interaction specs**:
>    - how a card lifts when dragged,
>    - how a Column tab reacts as a drop target,
>    - the "Gekocht ✓" feedback and toast timing,
>    - swipe between Columns,
>    - sheet open and close.
> 4. **Breakpoints**: where the phone layout switches to the multi-Column layout.
> 5. The **12 placeholder illustrations** exported as separate assets, and the app icon in the sizes a web app manifest needs.
