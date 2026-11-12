# malkochen · Remotion briefs

All clips: 30 fps, H.264 MP4 (+ WebM VP9), solid background baked in, one light and one dark render (`<id>-light.mp4`, `<id>-dark.mp4`). Canvas = 3× the on-screen size. Loops must be seamless: frame N equals frame 0 (build every motion from `Math.sin(2π·frame/N)` or keyframes that end where they start). Play with `<video muted playsinline loop preload="none">`; poster = the still frame PNG. Never autoplay more than one loop on the Board.

Colours are OKLCH mixes (see tokens.json). Hex values below are pre-mixed for each theme.

## placeholder-pasta
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 90 frames = 3s @30fps · **Loop:** seamless
- **Background:** mix(butter 18%, surface-muted) — light `#F2E4CF` / dark `#4A402F`
- **R11:** new drawing
- **Animate:** fork, strand: fork y −12 · rotate −6° (pivot twirl bottom) · strand scaleY 1→1.75 (pivot nest); easing easeInOut; keyframes r11-* in assets/r11-keyframes.css
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still = frame 0: fork resting in the nest, strand short
  - f41: Fork lifted y −12, rotate −6°; strand stretched 1.75× (hold to f50)
  - f90: = frame 0
- **Assets:** assets/illustrations/pasta/layers/{light,dark}/*.svg, assets/illustrations/pasta/pasta-light.svg, assets/illustrations/pasta/pasta-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-ramen
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 81 frames = 2.7s @30fps · **Loop:** seamless
- **Background:** mix(sky 18%, surface-muted) — light `#E3E6DA` / dark `#473E39`
- **Animate:** steam_1..3: alpha 0→.85→0 · y +6→−14; easing easeOut; offset 0.9s each
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f41: Hero apex: alpha 0→.85→0 · y +6→−14
  - f81: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/ramen/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/ramen/ramen-light.svg, assets/illustrations/ramen/ramen-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-bowl
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 96 frames = 3.2s @30fps · **Loop:** seamless
- **Background:** mix(sage 18%, surface-muted) — light `#DDE7E0` / dark `#3B423D`
- **R11:** new drawing
- **Animate:** leaves, tomato: leaves y −2 · rotate −4° (pivot bowl centre) · tomato hop y −10 → squash 1.14/.86; easing easeInOut; keyframes r11-* in assets/r11-keyframes.css
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still = frame 0: leaves upright, tomato resting
  - f48: Leaves at y −2, rotate −4°; tomato starts its hop
  - f61: Tomato apex y −10
  - f74: Tomato lands, squash 1.14 / .86, settles by f87
  - f96: = frame 0
- **Assets:** assets/illustrations/bowl/layers/{light,dark}/*.svg, assets/illustrations/bowl/bowl-light.svg, assets/illustrations/bowl/bowl-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-breakfast
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 90 frames = 3s @30fps · **Loop:** seamless
- **Background:** mix(orchid 18%, surface-muted) — light `#EDDBF1` / dark `#47394A`
- **R11:** new drawing
- **Animate:** drip, drop, berry: drip scaleY 1→1.9 (pivot top) · drop falls y +18 → splat · berry wobble ±10°; easing easeInOut; keyframes r11-* in assets/r11-keyframes.css
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still = frame 0: short drip, berry upright
  - f11: Berry wobbles −10° → 7° → −3°, still by f41
  - f50: Drip stretched 1.9×; drop appears at its tip
  - f70: Drop lands on the plate, splat (scale 1.7 / .4)
  - f83: Drop gone, drip back to 1×
  - f90: = frame 0
- **Assets:** assets/illustrations/breakfast/layers/{light,dark}/*.svg, assets/illustrations/breakfast/breakfast-light.svg, assets/illustrations/breakfast/breakfast-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-burger
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 84 frames = 2.8s @30fps · **Loop:** seamless
- **Background:** mix(butter 18%, surface-muted) — light `#EFE5CF` / dark `#4A402F`
- **Animate:** bun_top: y −14 · rotate −5° → squash; easing spring(0.6, 400); 0/35/60/72/82%
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f42: Hero apex: y −14 · rotate −5° → squash
  - f84: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/burger/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/burger/burger-light.svg, assets/illustrations/burger/burger-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-tacos
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 54 frames = 1.8s @30fps · **Loop:** seamless
- **Background:** mix(butter 18%, surface-muted) — light `#EFE5CF` / dark `#4A402F`
- **Animate:** taco_1, taco_2: rotate ±7° (pivot bottom); easing easeInOut; taco_2 phase −0.9s
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f27: Hero apex: rotate ±7° (pivot bottom)
  - f54: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/tacos/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/tacos/tacos-light.svg, assets/illustrations/tacos/tacos-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-wok
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** mix(sky 18%, surface-muted) — light `#E3E6DA` / dark `#473E39`
- **Animate:** pan, veg_1..5: pan rotate −6° · veg y −26 + rotate 360°; easing cubic(.3,.6,.4,1); veg offset 40ms
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f36: Hero apex: pan rotate −6° · veg y −26 + rotate 360°
  - f72: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/wok/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/wok/wok-light.svg, assets/illustrations/wok/wok-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-bread
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 108 frames = 3.6s @30fps · **Loop:** seamless
- **Background:** mix(butter 18%, surface-muted) — light `#EFE5CF` / dark `#4A402F`
- **Animate:** loaf, steam_1..2: scale 1.04 × 1.10 (pivot bottom); easing easeInOut; 0 / 50 / 100%
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f54: Hero apex: scale 1.04 × 1.10 (pivot bottom)
  - f108: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/bread/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/bread/bread-light.svg, assets/illustrations/bread/bread-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-cake
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** mix(orchid 18%, surface-muted) — light `#F3DECA` / dark `#4D3A2C`
- **Animate:** berry, spark_1..2: berry y −10 → squash · spark scale 0→1; easing easeInOut; spark_2 +1.2s
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f36: Hero apex: berry y −10 → squash · spark scale 0→1
  - f72: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/cake/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/cake/cake-light.svg, assets/illustrations/cake/cake-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-dumplings
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 81 frames = 2.7s @30fps · **Loop:** seamless
- **Background:** mix(sage 18%, surface-muted) — light `#E6E5DA` / dark `#434038`
- **Animate:** steam_1..3: alpha 0→.85→0 · y +6→−14; easing easeOut; offset 0.9s each
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f41: Hero apex: alpha 0→.85→0 · y +6→−14
  - f81: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/dumplings/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/dumplings/dumplings-light.svg, assets/illustrations/dumplings/dumplings-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-smoothie
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** mix(orchid 18%, surface-muted) — light `#F3DECA` / dark `#4D3A2C`
- **Animate:** bubble_1..3: y 0→−38 · alpha; easing easeIn; offset 0.8s each
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f36: Hero apex: y 0→−38 · alpha
  - f72: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/smoothie/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/smoothie/smoothie-light.svg, assets/illustrations/smoothie/smoothie-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## placeholder-eintopf
- **Group:** Placeholder illustrations · **Usage:** Dish thumbnail/header when no photo. Plays only in focus: long-press, detail, picker, hover; once on first view and on scroll-stop.
- **Canvas:** 800×1000 (4:5) · **Length:** 60 frames = 2s @30fps · **Loop:** seamless
- **Background:** mix(carrot 18%, surface-muted) — light `#EBDFCA` / dark `#473B2C`
- **Animate:** lid, puff_l, puff_r: lid y −3 · rotate ±4° ×2 · puffs scale + alpha; easing easeInOut; rattle 0–32%, rest
- **Crops:** Composition is inside the centred 800×800 safe square; the ground tint fills the rest. object-fit: cover works for 4:5, 1:1 and 16:10.
- **Storyboard:**
  - f0: Still pose = frame 0
  - f30: Hero apex: lid y −3 · rotate ±4° ×2 · puffs scale + alpha
  - f60: Back to frame 0 (seamless)
- **Assets:** assets/illustrations/eintopf/layers/{light,dark}/*.svg (order + pivots in layers.json), assets/illustrations/eintopf/eintopf-light.svg, assets/illustrations/eintopf/eintopf-dark.svg
- **Reduced motion still:** frame 0 (also exported as the SVG itself)

## empty-board
- **Group:** States · **Usage:** Board with 0 Dishes (phone + desktop lane)
- **Canvas:** 660×588 (≈10:9) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** column tint (butter 24% into bg) — light `#F4EACE` / dark `#433422`
- **Storyboard:**
  - f0: Topfbert happy, butter blob behind, 4 veggies resting in pot
  - f0: Veggie 1 hops (start offset 0 / 18 / 36 / 54f per veggie)
  - f32: Veggie at apex, rotated 150°
  - f65: Veggie lands back in pot
  - f72: Loop point = frame 0
  - f0: Parallel: steam wisps 72f; eyes blink at f66–70; blob morph 240f (render at 72f subset: keep blob static)
- **Assets:** assets/topfbert/topfbert-happy-*.svg (layers), assets/veggies/*.svg
- **Reduced motion still:** frame 0: veggies resting, eyes open

## empty-column
- **Group:** States · **Usage:** Column with 0 Dishes. Cast by Column position: 1 pea, 2 Knobi, 3 Schoti, 4 pea … (this clip: pea)
- **Canvas:** 570×450 (19:15) · **Length:** 132 frames = 4.4s @30fps · **Loop:** seamless
- **Background:** column tint = mix(<column accent> 24%, bg); blob = mix(<column accent> 40%, surface) — light `#F8E8CE` / dark `#413521`
- **Render:** Render once per Column accent: <id>-<accent>-light.mp4 / -dark.mp4 (5 accents × 2 themes), Remotion input prop `accent`. Equally fine to build in Vue from the layers (pure transform/opacity loops) and tint the background in CSS.
- **R11:** changed: loop now starts with the pea centred, so still = frame 0 (no snap)
- **Animate:** pea: translateX 0 → +40 → −40 → 0 with rotate = x / r (154° at ±40), sine (0–25% sine-out, 25–75% sine-in-out, 75–100% sine-in), pivot = pea centre (95, 51); keyframes r11-* in assets/r11-keyframes.css
- **Storyboard:**
  - f0: Pea centred on the bowl rim, upright, eyes front (= still)
  - f33: Pea right (x +40), rotated +154°
  - f66: Back through centre
  - f99: Pea left (x −40), rotated −154°
  - f132: = frame 0
- **Assets:** assets/clips/empty-column/layers/{light,dark}/*.svg (order, ids, loops, pivots in layers.json), assets/clips/empty-column/empty-column-{light,dark}.svg, assets/clips/empty-column/empty-column-<accent>-{light,dark}.svg
- **Reduced motion still:** frame 0 (= the exported still SVG)

## empty-column-knobi
- **Group:** States · **Usage:** Column with 0 Dishes. Cast by Column position: 1 pea, 2 Knobi, 3 Schoti, 4 pea … (this clip: knobi)
- **Canvas:** 570×450 (19:15) · **Length:** 132 frames = 4.4s @30fps · **Loop:** seamless
- **Background:** column tint = mix(<column accent> 24%, bg); blob = mix(<column accent> 40%, surface) — light `#F2DCF8` / dark `#3D2C41`
- **Render:** Render once per Column accent: <id>-<accent>-light.mp4 / -dark.mp4 (5 accents × 2 themes), Remotion input prop `accent`. Equally fine to build in Vue from the layers (pure transform/opacity loops) and tint the background in CSS.
- **R11:** new
- **Animate:** knobi: rotate 0 → +9° → −9° → 0, sine, pivot (95, 76) inside the bowl · sprout: rotate 0 → −12° → +12° → 0, same curve, lagging 0.3 s (delay −4.1 s), pivot (24, 8) in character space · eyes: scaleY 1 → .1 → 1 at 46–50%, pivot eye centre; keyframes r11-* in assets/r11-keyframes.css
- **Storyboard:**
  - f0: Knobi upright in the bowl, bottom tucked behind the rim (= still)
  - f33: Rocked right +9°; sprout trails −12°
  - f63: Blink (f62–66)
  - f99: Rocked left −9°
  - f132: = frame 0
- **Assets:** assets/clips/empty-column-knobi/layers/{light,dark}/*.svg (order, ids, loops, pivots in layers.json), assets/clips/empty-column-knobi/empty-column-knobi-{light,dark}.svg, assets/clips/empty-column-knobi/empty-column-knobi-<accent>-{light,dark}.svg
- **Reduced motion still:** frame 0 (= the exported still SVG)

## empty-column-schoti
- **Group:** States · **Usage:** Column with 0 Dishes. Cast by Column position: 1 pea, 2 Knobi, 3 Schoti, 4 pea … (this clip: schoti)
- **Canvas:** 570×450 (19:15) · **Length:** 132 frames = 4.4s @30fps · **Loop:** seamless
- **Background:** column tint = mix(<column accent> 24%, bg); blob = mix(<column accent> 40%, surface) — light `#E0EBE3` / dark `#303832`
- **Render:** Render once per Column accent: <id>-<accent>-light.mp4 / -dark.mp4 (5 accents × 2 themes), Remotion input prop `accent`. Equally fine to build in Vue from the layers (pure transform/opacity loops) and tint the background in CSS.
- **R11:** new
- **Animate:** schoti: hop at 0–40% (pivot (95, 66), rim contact) then rest · eyes: translateX −1.6 / +1.6 at 52–64% / 72–86%; keyframes r11-* in assets/r11-keyframes.css
- **Storyboard:**
  - f0: Schoti standing on the bowl rim (= still)
  - f3: Crouch: squash 1.07 / .93
  - f22: Apex: y −16, stretch .96 / 1.05
  - f37: Land: squash 1.09 / .91, settle by f53
  - f69: Looks left (f69–84), then right (f95–114)
  - f132: = frame 0
- **Assets:** assets/clips/empty-column-schoti/layers/{light,dark}/*.svg (order, ids, loops, pivots in layers.json), assets/clips/empty-column-schoti/empty-column-schoti-{light,dark}.svg, assets/clips/empty-column-schoti/empty-column-schoti-<accent>-{light,dark}.svg
- **Reduced motion still:** frame 0 (= the exported still SVG)

## search-empty
- **Group:** States · **Usage:** Search with no results
- **Canvas:** 660×510 (22:17) · **Length:** 108 frames = 3.6s @30fps · **Loop:** seamless
- **Background:** bg — light `#F7F6F2` / dark `#131211`
- **Storyboard:**
  - f0: Magnifier left, −10°; plate empty
  - f54: Magnifier right, +10°; pea peeks out from behind plate (f54–80)
  - f90: Pea ducks
  - f108: = frame 0
- **Assets:** assets/characters/pea.svg, assets/shapes/magnifier.svg, assets/shapes/plate.svg
- **Reduced motion still:** frame 0

## lookup-stir
- **Group:** Add Dish · **Usage:** Link is being looked up
- **Canvas:** 1062×900 (59:50) · **Length:** 144 frames = 4.8s @30fps · **Loop:** seamless
- **Background:** butter 22% into surface-muted (the panel) — light `#EFE3C9` / dark `#524531`
- **Storyboard:**
  - f0: Topfbert stir mood: eyes squeezed, tongue out; spoon −20°
  - f18: Spoon +20° (spoon cycle 36f, ×4)
  - f0: Carrot, pea, pepper orbit in an ellipse (48f per pass, alternate), phase 0 / −32 / −64f
  - f144: = frame 0
- **Assets:** assets/topfbert/topfbert-stir-*.svg, assets/veggies/carrot.svg, assets/veggies/pea.svg, assets/veggies/pepper.svg
- **Reduced motion still:** frame 0; status text is Vue, not in the clip

## lookup-failed
- **Group:** Add Dish · **Usage:** Lookup failed card
- **Canvas:** 276×256 (≈1:1) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** surface-muted — light `#EFEDE8` / dark `#2A2825`
- **Storyboard:**
  - f0: Topfbert oops: tilt −6°, one eye squint, sweat drop appears (scale 0 → 1, f14–22)
  - f58: Drop slides down 10px
  - f72: Drop gone; = frame 0
- **Assets:** assets/topfbert/topfbert-oops-*.svg
- **Reduced motion still:** frame 30

## never-cooked-hut
- **Group:** Dish detail · **Usage:** Cooking History empty (replaces never-cooked). Scene per Dish = [hut, sprung, dampf][hash(dishId) % 3]
- **Canvas:** 510×354 (≈10:7) · **Length:** 144 frames = 4.8s @30fps · **Loop:** seamless
- **Background:** surface (card); blob = mix(sage 36%, surface) — light `#FFFFFF` / dark `#1E1C1A`
- **R11:** new
- **Animate:** hat: hattip, pivot (15, 42) · pea: peapop, pivot (66, 41); pea_eyes: pealook · gaze: gazehut · eyes / eyes_closed: opacity swap at 86–89% · topfbert: breathe 2.4s ×2, pivot (70, 123) · steam_1/2: 2.4s, phase −1.2s; keyframes r11-* in assets/r11-keyframes.css
- **Storyboard:**
  - f0: Topfbert happy, hat on, steam drifting (= still)
  - f14: Hat tips up to −20° (pivot hat brim left), settles at −16°
  - f20: Pea pops out of the pot (y +30 → −3 → 0, squash)
  - f36: Pea looks left (f36–52), right (f59–66); Topfbert looks up at it
  - f77: Pea ducks back into the pot (f77–92)
  - f92: Hat drops back with a 3° bounce, done f109
  - f124: Topfbert blinks (f124–130)
  - f144: = frame 0
- **Assets:** assets/clips/never-cooked-hut/layers/{light,dark}/*.svg (order, ids, loops, pivots in layers.json), assets/clips/never-cooked-hut/never-cooked-hut-{light,dark}.svg
- **Reduced motion still:** frame 0 (= the exported still SVG)

## never-cooked-sprung
- **Group:** Dish detail · **Usage:** Cooking History empty (replaces never-cooked). Scene per Dish = [hut, sprung, dampf][hash(dishId) % 3]
- **Canvas:** 510×354 (≈10:7) · **Length:** 144 frames = 4.8s @30fps · **Loop:** seamless
- **Background:** surface (card); blob = mix(sage 36%, surface) — light `#FFFFFF` / dark `#1E1C1A`
- **R11:** new
- **Animate:** schoti: leapx (outer group, X) + leapy (inner group: Y, lean, squash, turn), pivot (58, 110) · pea: duck at 20% / 70%, pivot (85, 110) · gaze: gazesprung · topfbert: breathe · steam; keyframes r11-* in assets/r11-keyframes.css
- **Storyboard:**
  - f0: Schoti left of the pea, Topfbert looks at Schoti (= still)
  - f3: Crouch
  - f29: Apex over the pea (y −34, lean 10°); pea ducks
  - f48: Lands right, squash; f63 turns round (scaleX → −1)
  - f101: Apex back over the pea; pea ducks
  - f120: Lands left; f135 turns to face right
  - f144: = frame 0; Topfbert's eyes follow throughout
- **Assets:** assets/clips/never-cooked-sprung/layers/{light,dark}/*.svg (order, ids, loops, pivots in layers.json), assets/clips/never-cooked-sprung/never-cooked-sprung-{light,dark}.svg
- **Reduced motion still:** frame 0 (= the exported still SVG)

## never-cooked-dampf
- **Group:** Dish detail · **Usage:** Cooking History empty (replaces never-cooked). Scene per Dish = [hut, sprung, dampf][hash(dishId) % 3]
- **Canvas:** 510×354 (≈10:7) · **Length:** 144 frames = 4.8s @30fps · **Loop:** seamless
- **Background:** surface (card); blob = mix(sage 36%, surface) — light `#FFFFFF` / dark `#1E1C1A`
- **R11:** new
- **Animate:** knobi: ride, pivot (96, 41) in Topfbert space · puff_1..3: puff, phase 0 / −0.1 / −0.2 s · gaze: gazedampf · knobi sprout: wiggle 2.4s · knobi eyes: blink48 · topfbert: breathe; no steam rods (puffs replace them); keyframes r11-* in assets/r11-keyframes.css
- **Storyboard:**
  - f0: Knobi sits on Topfbert's rim (= still)
  - f7: Knobi squashes, three steam puffs rise from the pot (f8–34)
  - f17: Puffs lift Knobi up to y −26, wobbling ±6°; sprout flutters
  - f36: Topfbert looks up at him
  - f89: Knobi lands back on the rim, squash, settles f124
  - f129: Knobi blinks
  - f144: = frame 0
- **Assets:** assets/clips/never-cooked-dampf/layers/{light,dark}/*.svg (order, ids, loops, pivots in layers.json), assets/clips/never-cooked-dampf/never-cooked-dampf-{light,dark}.svg
- **Reduced motion still:** frame 0 (= the exported still SVG)

## milestone-10x
- **Group:** Celebrations · **Usage:** 10th cooking (after toast)
- **Canvas:** 1080×1080 (1:1) · **Length:** 54 frames = 1.8s @30fps · **Loop:** one-shot
- **Background:** sage 55% into bg (full-screen wash is Vue; clip bg matches) — light `#D1DAC5` / dark `#686B59`
- **Note:** Headline "WG-Klassiker!" and subline are Vue text over the wash.
- **Storyboard:**
  - f0: Empty sage
  - f4: 10× pebble pops from scale 0, −20° (to f26, overshoot 1.12 at f18)
  - f8: 7 pebbles burst outward (to f35)
  - f15: Ring pulse starts
  - f54: Pebble resting; hold last frame
- **Assets:** assets/shapes/pebble.svg, assets/shapes/burst-pebbles.svg
- **Reduced motion still:** last frame (54): pebble with "10×", no burst

## board-created
- **Group:** Celebrations · **Usage:** Board erstellt
- **Canvas:** 780×780 (1:1) · **Length:** 36 frames = 1.2s @30fps · **Loop:** one-shot
- **Background:** butter 26% into bg — light `#F3E9CB` / dark `#483723`
- **Note:** Columns build-in, headline and button are Vue (UI motion, see Interaction specs).
- **Storyboard:**
  - f0: Empty
  - f3: Emoji pebble pops (−30° → +8° at f9 → 0 at f13)
  - f3: 10 pebble confetti burst radially (to f18)
  - f36: Hold pebble
- **Assets:** assets/shapes/pebble.svg, Board emoji rendered as text (Noto Color Emoji) by Remotion — or composite emoji in Vue on top
- **Reduced motion still:** last frame

## invite-intro
- **Group:** Invite · **Usage:** Invite landing, first 1.5s
- **Canvas:** 780×750 (26:25) · **Length:** 45 frames = 1.5s @30fps · **Loop:** one-shot
- **Background:** butter 22% into bg — light `#F4EBD1` / dark `#3F3121`
- **Storyboard:**
  - f0: Butter blob
  - f6: Board pebble pops (to f27)
  - f21: Topfbert rises from bottom-left (to f39)
  - f33: Member avatars pop 3×, 3f apart
  - f45: Hand-off to invite-loop frame 0
- **Assets:** assets/topfbert/topfbert-happy-*.svg, assets/veggies/*.svg, avatars are Vue overlays
- **Reduced motion still:** invite-loop frame 0

## invite-loop
- **Group:** Invite · **Usage:** Invite landing, after intro
- **Canvas:** 780×750 (26:25) · **Length:** 420 frames = 14s @30fps · **Loop:** seamless
- **Background:** butter 22% into bg — light `#F4EBD1` / dark `#3F3121`
- **Storyboard:**
  - f0: 6 veggies on a circle r=354px around the pebble
  - f210: Ring rotated 180°, veggies counter-rotate (stay upright)
  - f420: 360° = frame 0
  - f0: Pebble bobs ±8px, 90f cycle; Topfbert bob 78f → use 84f so 420 = 5×84
- **Assets:** assets/topfbert/topfbert-happy-*.svg, assets/veggies/*.svg
- **Reduced motion still:** frame 0

## splash
- **Group:** System · **Usage:** Cold start (web: overlay; Android native splash shows static icon first)
- **Canvas:** 1080×1920 (9:16 (object-fit: cover)) · **Length:** 33 frames = 1.1s @30fps · **Loop:** one-shot
- **Background:** gradient.icon (#FCD980 → #F29B32, 160°) — light `#FCD980→#F29B32` / dark `#FCD980→#F29B32`
- **Storyboard:**
  - f0: Board bg colour
  - f0: Butter gradient blooms from centre (clip circle 0 → 150%, to f10)
  - f2: Icon pebble springs in (scale .2 → 1.14 at f7 → 1 at f10)
  - f10: Lid pops (up 14px, −12° at f12, lands f16)
  - f13: Wordmark rises + dot pops (to f17)
  - f29: Icon zooms 1.9× + fades; Vue cross-fades to Board at f33
- **Assets:** assets/icon/icon-layers/*.svg, wordmark rendered as text: Newsreader 400
- **Reduced motion still:** frame 16: icon + wordmark on butter

## topfbert-wow
- **Group:** System · **Usage:** Sign-in hero centre (ring + tiles are Vue)
- **Canvas:** 348×324 (≈1:1) · **Length:** 84 frames = 2.8s @30fps · **Loop:** seamless
- **Background:** butter 22% into bg — light `#F4EBD1` / dark `#3F3121`
- **Note:** Orbit: Vue rotates the ring (40s linear); each tile shows a placeholder still, every second tile plays its placeholder clip.
- **Storyboard:**
  - f0: Topfbert wow: big eyes, O mouth, steam
  - f42: Up 4px, squash
  - f0: 3 sparkles scale 0 → 1 → 0 (42f cycle, offsets 0/15/27f)
  - f84: = frame 0
- **Assets:** assets/topfbert/topfbert-wow-*.svg
- **Reduced motion still:** frame 0

## not-unlocked
- **Group:** System · **Usage:** Account not unlocked
- **Canvas:** 660×630 (22:21) · **Length:** 84 frames = 2.8s @30fps · **Loop:** seamless
- **Background:** bg — light `#F7F6F2` / dark `#131211`
- **Storyboard:**
  - f0: Sky blob; Topfbert happy; sign "Gleich!" hangs at −8°
  - f42: Sign +8°
  - f84: = frame 0
- **Assets:** assets/topfbert/topfbert-happy-*.svg, assets/shapes/sign.svg (text "Gleich!" Hanken Grotesk 700)
- **Reduced motion still:** frame 21: sign straight

## offline
- **Group:** System · **Usage:** Offline screen
- **Canvas:** 660×600 (11:10) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** bg — light `#F7F6F2` / dark `#131211`
- **Storyboard:**
  - f0: Sky blob; Topfbert sleep (closed eyes, desaturated 60%); Wi-Fi 2 arcs + dot at full
  - f29: Outer arc fades to 12%
  - f40: Inner arc fades to 12%
  - f0: "z" drifts up-right (72f), second z offset 36f
  - f72: Arcs back = frame 0
- **Assets:** assets/topfbert/topfbert-sleep-*.svg, assets/shapes/wifi.svg
- **Reduced motion still:** frame 40

## error
- **Group:** System · **Usage:** Generic error
- **Canvas:** 660×600 (11:10) · **Length:** 72 frames = 2.4s @30fps · **Loop:** seamless
- **Background:** bg — light `#F7F6F2` / dark `#131211`
- **Storyboard:**
  - f0: Carrot blob; Topfbert oops wobble −6°; spill ellipse
  - f0: 3 smoke puffs rise + grow + fade (72f, offsets 0/24/48f)
  - f36: Wobble −2°; spill scaleX 1.12
  - f72: = frame 0
- **Assets:** assets/topfbert/topfbert-oops-*.svg
- **Reduced motion still:** frame 0

## gekocht-topfbert
- **Group:** Celebrations · **Usage:** Pops up behind the Gekocht toast
- **Canvas:** 210×195 (≈1:1) · **Length:** 36 frames = 1.2s @30fps · **Loop:** one-shot
- **Background:** NONE — sits over the live Board — light `transparent` / dark `transparent` · ⚠ **needs transparency**: Overlaps Board content above the toast; no fixed surface behind it.
- **Recommendation:** Build in Vue from assets/topfbert layers (translate + scale + "Mmh!" bubble pop). If video is required: WebM VP9 with alpha for Chromium + HEVC-with-alpha .mov for Safari, and a still PNG as fallback.
- **Storyboard:**
  - f0: Below toast (y +46), scale .6
  - f8: Up to −10px, scale 1.06
  - f12: Settle
  - f18: Wiggle −4° / +3°
  - f20: Bubble "Mmh!" pops
  - f36: Hold
- **Assets:** assets/topfbert/topfbert-happy-*.svg
- **Reduced motion still:** frame 36 PNG

## veggie-confetti
- **Group:** Particles (not video) · **Usage:** Falls over the live Board
- **Length:** 2.4s · not a clip
- **Background:** NONE — light `transparent` / dark `transparent` · ⚠ **needs transparency**: Falls over the live Board
- **Recommendation:** Vue + CSS/SVG particles using assets/veggies/*.svg or assets/shapes/pebble.svg. Not a Remotion clip.
- **Storyboard:**
  - f0: 14 pieces spawn at button centre
  - f4: Launch: dx ±90–170px, up −110…−200px (easeOut)
  - f16: Apex
  - f45: Fall +140…+300px (easeIn), fade from f38
  - f48: Removed
- **Assets:** assets/veggies/*.svg, assets/shapes/pebble.svg
- **Reduced motion still:** none (skipped)

## fly-to-tab-pebble
- **Group:** Particles (not video) · **Usage:** Flies across the UI to a tab
- **Length:** 0.64s · not a clip
- **Background:** NONE — light `transparent` / dark `transparent` · ⚠ **needs transparency**: Flies across the UI to a tab
- **Recommendation:** Vue + CSS/SVG particles using assets/veggies/*.svg or assets/shapes/pebble.svg. Not a Remotion clip.
- **Storyboard:**
  - f0: Spawn
  - f19: End
- **Assets:** assets/veggies/*.svg, assets/shapes/pebble.svg
- **Reduced motion still:** none (skipped)

## drop-burst
- **Group:** Particles (not video) · **Usage:** Pops over the tabs
- **Length:** 0.64s · not a clip
- **Background:** NONE — light `transparent` / dark `transparent` · ⚠ **needs transparency**: Pops over the tabs
- **Recommendation:** Vue + CSS/SVG particles using assets/veggies/*.svg or assets/shapes/pebble.svg. Not a Remotion clip.
- **Storyboard:**
  - f0: Spawn
  - f19: End
- **Assets:** assets/veggies/*.svg, assets/shapes/pebble.svg
- **Reduced motion still:** none (skipped)

## topfbert-idle
- **Group:** Mascot · **Usage:** Wherever Topfbert appears without another loop (e.g. „Schon auf dem Board“ notice). Build in Vue, not as a video.
- **Build in Vue** (transparent, not a video) · **Length:** 180 frames = 6s · **Loop:** seamless
- **Animate:** see assets/topfbert/layers.json → idle
- **Storyboard:**
  - f0: Eyes open, steam_2 half-way (= still)
  - f45: Breath peak (scale .985 / 1.025)
  - f60: Blink (f60–64)
  - f90: Hat at +3°, second breath starts
  - f150: Blink (f150–154), again f159–163
  - f180: = frame 0
- **Assets:** assets/topfbert/topfbert-happy-*.svg, assets/topfbert/topfbert-eyes_closed.svg
- **Reduced motion still:** frame 0
