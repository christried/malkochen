# Android navigation bar colour and share sheet placement

Research date: 2026-10-15. Scope: Android only (Chrome-installed PWA, WebAPK). iOS and Safari are out of scope.

Chrome version: Chrome Stable on Android at the research date is **156.0.8078.39**, released 2026-10-14T16:53Z ([Chromium dashboard release feed](https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Android&num=2)). Chromium source links point to branch `8078` (Chrome 156) unless marked `main`. Where I cite `main`, the same logic was also present on `8078` unless noted.

Verification legend used below:
- **[V]** read in a primary source (Chromium, AOSP, developer.android.com, W3C, Chrome docs, GitHub API).
- **[I]** inference from primary code. Not tested on a device.
- **[U]** could not verify against a primary source. Listed again in the open points section.

Repo facts were read from `C:\Users\gilge\Desktop\malkochen`. Repo file links below use absolute paths.

---

## Decisions (2026-10-15)

- **Nav bar: option 1.** Set manifest `theme_color` to `#FCD980`, so dark icons sit on the butter bar. The butter splash stays. This touches `public/manifest.webmanifest`, the assertion in `tests/e2e/installable.spec.ts` and the comment in `nuxt.config.ts`. Check it on a device afterwards.
- **Share sheet: no fix available.** Both users have Samsung phones, and Samsung's share sheet doesn't offer the Pin option. The only code route is a native TWA wrapper with sharing shortcuts, which is not worth building now.

## TL;DR

### Question 1: navigation bar colour

- **Answer.** On Android 15 and later, Chrome cannot colour the navigation bar of an installed malkochen. The window belongs to Chrome's own APK, which targets a recent SDK. Android ignores the colour Chrome requests and draws the bar transparent (in 3-button mode, possibly with a translucent scrim). The colour you see is the window background, which Chrome sets from the manifest `background_color` (#FCD980). The icons are light because Chrome picks icon contrast from the manifest `theme_color` (#131211). This explains "yellow bar with white icons" exactly. It is an inference from code, not a device test [I].
- **Can a page change it?** In the 3-button configuration, no. Meta `theme-color`, CSS, `env(safe-area-inset-*)` and `viewport-fit` do not reach the navigation bar in the code I read. The W3C manifest has no navigation bar member [V]. Chromium reads only `theme_color` and `background_color` from the manifest, not `color_scheme_dark` [V].
- **Recommendation.**
  1. Quick legibility fix that keeps the butter splash: set manifest `theme_color` to `#FCD980`. Chrome then requests a light bar and uses dark icons on it. The bar stays yellow [I].
  2. Neutral bar: change `background_color`. This also changes the splash, because both come from the same value. A butter splash and a neutral bar cannot both come from the manifest on Android 15+ [V for shared source, I for outcome].
  3. Per-Board navigation bar colour: not achievable with the mechanisms I could verify. Do not build it without a device test.

### Question 2: share sheet placement

- **Answer.** The Direct Share row only shows dynamic "sharing shortcuts" published through the `ShortcutManager` API [V, Android docs]. Neither a WebAPK nor a Bubblewrap-generated TWA publishes them, based on the Chromium and Bubblewrap code I read [V for what I read, U for completeness]. I found no manifest member or open proposal for them [V for the searched repos].
- **Zero-code option.** Long-press malkochen in the share sheet and choose **Pin**. This pins it to the top of the app list [V, AOSP strings and code]. Usage history also raises its rank automatically [V, AOSP ranker code].
- **Only route into the Direct Share row.** A native Android wrapper (TWA plus native code) that publishes sharing shortcuts, for example one target per Board. This is a large build and a Play Store release [I].
- **Recommendation.** Tell the user to pin malkochen now. Do not build the native wrapper unless per-Board Direct Share targets are wanted.

---

## Question 1: navigation bar colour

### 1.1 Which colour Chrome requests for an installed web app

Chrome runs its navigation bar logic for installed web apps (WebAPK and `WebappActivity`) after native initialisation, and again on theme colour changes and edge-to-edge changes. The code comment says the navigation bar of an installed web app takes the manifest theme colour [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/customtabs/BaseCustomTabActivity.java (`finishNativeInitialization`, `updateNavigationBarColor`)

Non-edge-to-edge path. The requested colour is `getColorProvider().getNavigationBarColor()`. For web apps, `ColorProviderImpl.getNavigationBarColor()` returns the toolbar colour only when a custom theme colour exists and the `WebAppNavigationBarThemeColor` feature is enabled. Otherwise it returns null, and the platform default applies [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebappIntentDataProvider.java (lines ~240-252)
- Feature default: `kWebAppNavigationBarThemeColor` is `FEATURE_ENABLED_BY_DEFAULT` in https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/browser/flags/android/chrome_feature_list.cc

Dark mode. The dark colour provider is used when night mode is on and a dark custom colour exists, or no light custom colour exists [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebappIntentDataProvider.java (`getColorProvider`)

Edge-to-edge path. The bar is set to transparent and the icon contrast is derived from the page's theme colour (`BrowserServicesThemeColorProvider.getThemeColor()`) [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/customtabs/features/CustomTabNavigationBarController.java (`update`, `isEdgeToEdge` branch)

This path is taken only if one of two things holds [V]:
- The short-edges cutout mode is on. `kWebAppShortEdgesCutoutMode` is `FEATURE_DISABLED_BY_DEFAULT` (same `chrome_feature_list.cc`). The `WebappInsetsConsumer` tokens are held only by the display cutout and immersive mode paths (https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/android/java/src/org/chromium/chrome/browser/customtabs/features/WebappInsetsConsumer.java).
- `EdgeToEdgeController` is drawing to the edge and the page is opted in. The controller is created only when gesture navigation insets are seen [V]:
  - https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/browser/ui/android/edge_to_edge/java/src/org/chromium/chrome/browser/ui/edge_to_edge/EdgeToEdgeControllerCreator.java (`onApplyWindowInsets`: it calls the initialiser only if `doAllInsetsIndicateGestureNavigation` and `isEdgeToEdgeBottomChinEnabled`)
  - https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/browser/ui/android/edge_to_edge/java/src/org/chromium/chrome/browser/ui/edge_to_edge/EdgeToEdgeUtils.java (`doAllInsetsIndicateGestureNavigation`)
  - Consequence for 3-button navigation [I]: the controller is probably never created, so the edge-to-edge path is not reached and the page cannot draw under the bar.

Window background. `WebappActivity.getBackgroundDrawable()` returns a `ColorDrawable` of `backgroundColorFallbackToDefault()` [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebappActivity.java

That colour comes from the WebAPK `BACKGROUND_COLOR` metadata [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebApkIntentDataProviderFactory.java (around lines 313-321)

The WebAPK metadata is filled from the manifest, through `info_.background_color` and `UpdateFromManifest` [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/browser/android/webapk/webapk_update_data_fetcher.cc (lines ~177 and ~291)

The splash uses the same value. The WebAPK shell's `SplashTheme` sets `windowBackground` to `background_color_non_empty` [V]:
- https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/webapk/shell_apk/res/values-v31/styles.xml

So the native splash, the Activity window background, and the area under the navigation bar all come from the manifest `background_color` [V for the sources, I for the combined visible result].

### 1.2 Why the requested colour is ignored on Android 15+

- Chrome's own target SDK. The default `target_sdk_version` for Chrome in `build/config/android/config.gni` is `"37"` [V]:
  - https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/build/config/android/config.gni (line ~175)
  - Chrome's own edge-to-edge enforcement check uses `ApkInfo.targetAtLeastB()` [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/browser/ui/android/edge_to_edge/java/src/org/chromium/chrome/browser/ui/edge_to_edge/EdgeToEdgeUtils.java
  - I did not confirm the effective `targetSdkVersion` of a built Stable APK [U].
- The WebAPK shell is not the window owner. The WebAPK shell manifest sets `targetSdkVersion="33"` [V]:
  - https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/android/webapk/shell_apk/AndroidManifest.xml (line 28)
  - https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/android/webapk/shell_apk/BUILD.gn (`target_sdk_version = 33`)
  - WebAPK launches are routed to Chrome's own `WebappActivity`, `WebappActivityN`, or `SameTaskWebApkActivity` classes [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebappLauncherActivity.java (lines ~136-142). Those classes live in Chrome's APK, so the platform rules for Chrome's target SDK apply to the window [I].
- Platform rule. Edge-to-edge is enforced for apps targeting SDK 35 on Android 15 and later [V]: https://developer.android.com/develop/ui/views/layout/edge-to-edge ("Once you target SDK 35 or higher on a device running Android 15 or higher, your app is displayed edge-to-edge").
- AOSP `Window.setNavigationBarColor` documentation: "If the app targets VANILLA_ICE_CREAM or above, the color will be transparent and cannot be changed." `VANILLA_ICE_CREAM` is 35 [V]:
  - https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/Window.java (`setNavigationBarColor` javadoc)
  - https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/os/Build.java (line ~1273)
  - The same rule is written for `setStatusBarColor` in the same file [V].
- 3-button mode. The docs say a translucent scrim is applied unless `setNavigationBarContrastEnforced(false)` is set [V]: https://developer.android.com/develop/ui/views/layout/edge-to-edge ("For three-button navigation bar, set Window.setNavigationBarContrastEnforced to false otherwise there will be a translucent scrim applied"). I did not find Chrome setting this in the files I read [I, not exhaustive].

Result [I]: Chrome requests `#131211`, Android ignores it, and the bar shows the window background (`#FCD980`), possibly under a scrim. Chrome sets the icons from its own contrast decision on the requested colour (section 1.3), so they come out white.

### 1.3 How the icon colour (light or dark) is chosen

- `UiUtils.setNavigationBarIconColor` sets `APPEARANCE_LIGHT_NAVIGATION_BARS` through `WindowInsetsController` on API 30+, with the old `SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR` as fallback [V]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/ui/android/java/src/org/chromium/ui/UiUtils.java (`setNavigationBarIconColor`)
- AOSP doc for the flag: "Changes the foreground color for light navigation bars so that the items on the bar can be read clearly." [V]: https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/WindowInsetsController.java (`APPEARANCE_LIGHT_NAVIGATION_BARS`)
- Chrome decides `needsDarkButtons` as "the requested colour is not light-foreground", using a contrast threshold in `ColorUtils.shouldUseLightForegroundOnBackground` [V]:
  - https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/android/java/src/org/chromium/chrome/browser/customtabs/features/CustomTabNavigationBarController.java
  - https://chromium.googlesource.com/chromium/src/+/refs/heads/main/ui/android/java/src/org/chromium/ui/util/ColorUtils.java (line ~180)
- Chrome calls the icon setter after the colour setter, and the icons are set even when the colour is ignored [V, code order and comment in `updateBarColor`].

### 1.4 Does it change after launch?

- Non-edge-to-edge (the case here): the inputs are fixed, because they come from the WebAPK metadata. The theme colour observer re-runs `updateNavigationBarColor`, but the requested colour does not change [V, BaseCustomTabActivity.java].
- The meta `theme-color` is not read for the navigation bar in this path [V, by absence in the calls above].
- The visible colour changes only when the WebAPK is updated. The WebAPK update reasons include `THEME_COLOR_DIFFERS`, `BACKGROUND_COLOR_DIFFERS`, `DARK_THEME_COLOR_DIFFERS` and `DARK_BACKGROUND_COLOR_DIFFERS` [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/components/webapk/webapk.proto (`enum UpdateReason`). How quickly Chrome applies a manifest change is [U].
- Edge-to-edge (not reached here): the icon contrast follows the page's theme colour at runtime [V, CustomTabNavigationBarController].

### 1.5 Can a page change the navigation bar at runtime?

- **Meta `theme-color`.** Chrome's status bar controller reads the page's `theme-color` for a verified origin [V]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/android/java/src/org/chromium/chrome/browser/ui/system/README.md (PWA section). It does not feed the navigation bar in the non-edge-to-edge path (section 1.1).
- **`viewport-fit=cover` and `env(safe-area-inset-bottom)`.** Chrome's opt-in test for edge-to-edge is `isPageOptedIntoEdgeToEdge()`. The simple implementation returns `isDrawingToEdge()` [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/browser/ui/android/edge_to_edge/java/src/org/chromium/chrome/browser/ui/edge_to_edge/SimpleEdgeToEdgeController.java. I did not find where the page's `viewport-fit` feeds that decision [U]. Because the controller needs gesture navigation (section 1.1), `viewport-fit` should have no effect in 3-button mode [I].
- **CSS.** A page cannot paint outside its Activity window. The window is padded for the system bars in this path [I].
- **Manifest.**
  - The W3C manifest spec defines `theme_color` and `background_color`, lets the user agent use `color_scheme_dark` in place of them when the OS is dark, and never mentions the navigation bar or Android system bars [V]: https://w3c.github.io/manifest/ (`theme_color`, `background_color`, `color_scheme_dark`).
  - Chromium's manifest parser on `main` reads `theme_color` and `background_color` only. It does not read `color_scheme_dark` [V]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/manifest/manifest_parser.cc (`ParseThemeColor`, `ParseBackgroundColor`; no `color_scheme_dark`).
  - w3c/manifest issue 975, "Add support for defining a theme color for both light & dark modes (prefers color scheme)", was closed on 2026-04-09 with reason `completed` [V]: https://github.com/w3c/manifest/issues/975 (API: https://api.github.com/repos/w3c/manifest/issues/975). Its comments point to issue 1045 as the place where this was discussed [V]. The current status of 1045 is [U].
  - A GitHub search of `repo:WICG/manifest-incubations` and `repo:w3c/manifest` for "navigation bar" turned up no proposal for a navigation bar colour member [V for search results, U for completeness].
- **Other manifest members.** I found no navigation bar, `display_override` or edge-to-edge member relevant to colour [V for search results].

### 1.6 Does changing `background_color` break the splash match?

Yes, by design. The splash, the window background and the area under the navigation bar all use `background_color` (section 1.1). Changing it changes all three together. On Android 15+ there is no manifest lever that sets the navigation bar independently of the splash [I].

The repo says the same. `nuxt.config.ts` has a comment that the manifest `background_color` is butter "not the Board's: the native splash must match the first frame of the web splash that follows it" (`C:\Users\gilge\Desktop\malkochen\nuxt.config.ts`, lines 24-30). `SplashScreen.vue` relies on that match, starting at frame 10 of the clip (`C:\Users\gilge\Desktop\malkochen\app\components\SplashScreen.vue`).

### 1.7 Options and trade-offs

| Option | Effect on the navigation bar (Android 15+) | Effect on splash | Cost | Confidence |
|---|---|---|---|---|
| A. `theme_color` to `#FCD980` | Bar stays butter. Chrome requests a light colour, so icons become dark and readable. | None | Low: one manifest value, one e2e assertion, one comment | [I] for icons. The bar stays yellow, which the user dislikes. |
| B. `background_color` to a neutral value (for example `#131211`), with `theme_color` `#131211` | Bar becomes neutral. Icons light. | Splash becomes neutral and no longer matches the web splash's butter first frame | High: redesign `SplashScreen.vue` and the splash clip so its first frame is the new colour | [I] |
| C. Per-Board bar colour | Not reachable by any mechanism I could verify. Needs page-driven edge-to-edge, which needs gesture navigation in Chrome's current gate. | None | Unknown; would need a device test on a gesture-navigation phone | [U] |
| D. Native TWA wrapper | Same Chrome activity rules apply, so no gain on Android 15+ (inference: `CustomTabsIntent` colours are ignored the same way) | None | High (native project, Play release) | [I] |

Note on Option D. AndroidX deprecated `CustomTabsIntent.Builder.setNavigationBarColor` in favour of `setDefaultColorSchemeParams` [V]: https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/browser/browser/src/main/java/androidx/browser/customtabs/CustomTabsIntent.java (`setNavigationBarColor`, line ~1145). Bubblewrap's TWA manifest has `navigationColor`, `navigationColorDark`, `navigationDividerColor` and `navigationDividerColorDark` [V]: https://github.com/GoogleChromeLabs/bubblewrap/blob/80d97ad2007fd80941ae56588f603bff5b5546b9/packages/cli/README.md (lines ~377-380). None of this changes the Android 15+ rule above [I].

### 1.8 Recommendation and what changes in the repo

Recommended: Option A now, then decide on Option B with the user.

Option A, files to change:
- `C:\Users\gilge\Desktop\malkochen\public\manifest.webmanifest`: `theme_color` from `#131211` to `#FCD980`. Check the result on a device first (section 1.2 predicts dark icons). Expect the status bar colour for non-verified origins to change (section 1.1, [U] for the exact effect).
- `C:\Users\gilge\Desktop\malkochen\tests\e2e\installable.spec.ts`: the assertion `theme_color: '#131211'` must change with the manifest.
- `C:\Users\gilge\Desktop\malkochen\nuxt.config.ts` line 30: the comment "theme_color stays #131211" must change.
- The installed WebAPK must update before the change shows on the phone (section 1.4).

Option B, files to change in addition: `public/manifest.webmanifest` `background_color`, `app/components/SplashScreen.vue` (its first frame and the comments that name the butter), the splash clip in `remotion/`, and the `background_color` assertion in `tests/e2e/installable.spec.ts`.

Repo facts relevant to the per-Board question, read in this session:
- The page `theme-color` tags are static (`nuxt.config.ts` lines 41-42). Nothing in `app/` changes them at runtime (search of `app/` for `theme-color`, `themeColor` and `theme_color` returned no hits outside `nuxt.config.ts`).
- The per-Board look is CSS: Column accent tints on phones, and a gradient (`--board-gradient`) on tablet and desktop (`C:\Users\gilge\Desktop\malkochen\app\assets\css\main.css` lines ~104-133, `C:\Users\gilge\Desktop\malkochen\app\utils\columns.ts` lines 30-32). Chrome cannot read a per-Board colour from this, because the navigation bar and status bar take only the manifest and static meta values.
- `nuxt.config.ts` line 39 says "The status bar takes the Board's background (tokens.css --color-bg)". `--color-bg` is the page background token, not a per-Board value. Given static meta tags, the status bar follows the light or dark theme colour, not a Board. This needs a device check, because the user reports the status bar follows the Board (see open points).

---

## Question 2: share sheet placement

### 2.1 How the Android sharesheet orders targets

- **Direct Share row.** Direct Share targets are shown only when they come from the Sharing Shortcuts API. The docs say: "The Sharesheet Direct Share row only surfaces dynamic shortcuts provided by the Sharing Shortcuts API." [V]: https://developer.android.com/develop/ui/compose/sharing/direct-share-targets. The same page says the sheet "shows a fixed number of Direct Share targets. These suggestions are sorted by rank."
- **Sharing shortcuts.** A shortcut must set categories and be declared with `<share-target>` in `shortcuts.xml`. Each `dynamic` shortcut is pushed with `pushDynamicShortcut`, and usage reporting improves rank [V, same page]. Shortcuts with no user activity for 30 days are "stale" [V, same page].
- **ChooserTargetService.** Deprecated. The docs say Android 10 (API 29) replaced it with Sharing Shortcuts, and Android 11 (API 30) deprecated it. AOSP marks the class `@Deprecated` and points to the direct share instructions [V]: https://developer.android.com/develop/ui/compose/sharing/direct-share-targets; https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/service/chooser/ChooserTargetService.java (class javadoc).
- **App list ranking.** AOSP's `ResolverRankerServiceResolverComparator` ranks app targets with `UsageStats` over a 7-day window (`USAGE_STATS_PERIOD`), a 12-hour recency window with a 2.0 multiplier (`RECENCY_TIME_PERIOD`, `RECENCY_MULTIPLIER`), total time in foreground, launch count, and chooser counts for the same action and content type [V]: https://android.googlesource.com/platform/packages/modules/IntentResolver/+/refs/heads/main/java/src/com/android/intentresolver/model/ResolverRankerServiceResolverComparator.java. A prediction-service comparator exists too, and `ChooserActivity` uses `AppPredictorFactory` [V]: https://android.googlesource.com/platform/packages/modules/IntentResolver/+/refs/heads/main/java/src/com/android/intentresolver/ChooserActivity.java. Which ranker a given phone uses is [U], because it depends on the OS build and OEM.
- **Pinning.** A long-press on a target opens the target actions dialog (`ChooserActivity.onTargetLongPressed` calls `showTargetDetails` for app and direct share targets) [V]: https://android.googlesource.com/platform/packages/modules/IntentResolver/+/refs/heads/main/java/src/com/android/intentresolver/ChooserActivity.java (`onTargetLongPressed`). The dialog offers Pin or Unpin [V]: https://android.googlesource.com/platform/packages/modules/IntentResolver/+/refs/heads/main/java/src/com/android/intentresolver/ChooserTargetActionsDialogFragment.java (`pinComponent`, `toggleShortcutPinned`). Pin strings: "Pin this app to the top of the Sharesheet app list." and "Un-pin this app in the Sharesheet, so that it is sorted normally." [V]: https://android.googlesource.com/platform/packages/modules/IntentResolver/+/refs/heads/main/java/res/values/strings.xml (`pin_specific_target`, `unpin_specific_target`). Pin state is stored locally in the `chooser_pin_settings` SharedPreferences [V, ChooserActivity.java and ChooserTargetActionsDialogFragment.java].
- **Pin cap.** Press reports say four pinned apps at most [U, secondary sources: https://9to5google.com/2020/03/02/google-pixel-android-share-menu-pin-update/ and https://www.androidpolice.com/2020/03/02/pixels-on-android-10-can-now-pin-apps-to-the-share-menu-thanks-to-the-march-update/]. I did not find the cap in AOSP.
- **OEM sheets (Samsung One UI).** I found no primary Samsung source on its sharesheet ordering or pinning [U]. The only Samsung-specific items were a user forum thread and a third-party comparison, which are not authoritative: https://eu.community.samsung.com/t5/suggestions/direct-share/idc-p/1369874

### 2.2 Can a WebAPK publish sharing shortcuts?

No, based on the code I read. The WebAPK provides two static things:
- **Share targets.** Each `share_target` becomes an `activity-alias` with an `ACTION_SEND` intent filter for `text/plain` (plus `SEND_MULTIPLE` for file shares). These are static intent filters, not direct share targets [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/chrome/android/webapk/shell_apk/AndroidManifest.xml (lines ~110-147, `share_template`).
- **Launcher shortcuts.** The shell declares `android.app.shortcuts` (the static `shortcuts.xml` resource) for the manifest's `shortcuts` member [V]: same file, lines ~85 and ~104.
- Chromium's WebAPK update reasons include `SHORTCUTS_DIFFER` and `WEB_SHARE_TARGET_DIFFERS`. Both trigger a WebAPK update [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/components/webapk/webapk.proto
- Chrome's own sharing uses `Intent.createChooser` with a broadcast `PendingIntent` [V]: https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/components/browser_ui/share/android/java/src/org/chromium/components/browser_ui/share/ShareHelper.java. That is outgoing sharing, not a Direct Share publisher.
- **Limit of this check.** Chromium source search is not available to me (source.chromium.org search is a JavaScript application), so I read the relevant WebAPK files only. Absence of a `ShortcutManager` share publisher elsewhere in Chromium is [U].
- **Web platform.** The W3C manifest says `shortcuts` are "key tasks within a web application", ordered by priority, with presentation at the user agent's discretion. It does not define share shortcuts or Direct Share [V]: https://w3c.github.io/manifest/ (`shortcuts`). The Web Share Target entry is a static `share_target` in the manifest, and the app must be installed first [V]: https://developer.chrome.com/docs/capabilities/web-apis/web-share-target ("On all platforms, your web app has to be installed before it will show up as a potential target.").
- **Proposals.** GitHub search of `repo:WICG/manifest-incubations`, `repo:w3c/manifest` and `repo:w3c/web-share-target` for sharing shortcuts found no proposal for Direct Share in the manifest [V for search results, U for completeness]. The web-share-target hits were unrelated PRs.

### 2.3 Could a TWA publish sharing shortcuts?

Not from the Bubblewrap scaffold. It is possible with custom native code, at a cost:
- Bubblewrap's generated `shortcuts.xml` is an empty `<shortcuts />` [V]: https://github.com/GoogleChromeLabs/bubblewrap/blob/80d97ad2007fd80941ae56588f603bff5b5546b9/packages/core/template_project/app/src/main/res/xml/shortcuts.xml. Its share target generator adds only `ACTION_SEND` intent filters for `text/plain` and files [V]: https://github.com/GoogleChromeLabs/bubblewrap/blob/80d97ad2007fd80941ae56588f603bff5b5546b9/packages/core/src/lib/TwaGenerator.ts (`generateShareTargetIntentFilter`).
- To publish Direct Share targets, the TWA project would need: a `<share-target>` in `shortcuts.xml` that names an Activity in the TWA app; dynamic sharing shortcuts pushed for each destination (for malkochen, one per Board); long-lived shortcuts; usage reports; and avoiding stale targets (no user activity for 30 days) [V, Android docs: https://developer.android.com/develop/ui/compose/sharing/direct-share-targets]. That Activity would open the Board in the web app. Getting the Board list from the web app into native code is a bridge I did not verify [U].
- Costs: a native Android module, a Play Store release, Digital Asset Links kept valid, and a per-Board sync. These are [I] estimates from the requirements above.

### 2.4 What the user can do today, without code

1. Open the share sheet in Instagram, TikTok or a browser.
2. Long-press malkochen's icon and choose **Pin malkochen** (AOSP wording: "Pin <app name>").
3. Malkochen then appears at the top of the app list [V, AOSP strings].
4. Keep sharing to malkochen. Chooser counts and usage raise its rank over time [V, AOSP ranker].

Exact labels and positions depend on the phone's sheet. On Samsung, the steps are [U].

### 2.5 Options and trade-offs

| Option | Where malkochen appears | Effort | Confidence |
|---|---|---|---|
| A. Long-press Pin (user action) | Top of the app list, one tap after the sheet opens | None | [V] for AOSP behaviour. [U] for OEM sheets |
| B. Rely on usage ranking | Rises over time without any setup | None | [V] for AOSP ranker; [U] for the rank of the active ranker on the user's phone |
| C. TWA plus native sharing shortcuts, one per Board | Direct Share row, per-Board targets | High | [I] |
| D. More WebAPK changes | None: no WebAPK API exists for sharing shortcuts | n/a | [V] that none exists in the code read |

### 2.6 Recommendation and what changes in the repo

Recommended: Option A (and B happens for free). No repo change.

- The manifest `share_target` (`public/manifest.webmanifest`) already uses `GET` with `title`, `text` and `url`, and Chrome turns it into a `text/plain` `ACTION_SEND` filter [V]. No change needed for placement.
- Option C would add a native project next to the web app. That is a new repo, a Play listing, and Digital Asset Links. Not recommended unless per-Board Direct Share targets are wanted.

---

## Open and unverified points

1. **Device test.** Nothing here was tested on a phone. The yellow-bar-and-white-icons explanation (section 1.2) is an inference from code. The check is: (a) the WebAPK's installed `theme_color` and `background_color`, (b) Android version, (c) whether the bar changes when the Board changes. Option A's icon effect should be checked the same way.
2. **Status bar.** The user says the status bar follows the Board. On targetSdk 35+ the status bar colour request is ignored in the same way as the navigation bar (section 1.2). Chrome's status bar code (`StatusBarColorController`) feeds a colour to `EdgeToEdgeSystemBarColorHelper`. I could not locate that helper's source in the branch or in `main` [U]. If the status bar truly follows the Board, the mechanism behind it is unknown and may differ from the navigation bar. This must be resolved before deciding Option B.
3. **Which navigation bar mechanism applies.** I read `CustomTabNavigationBarController` and `EdgeToEdgeControllerCreator`. I did not read the controller that decides page opt-in (`viewport-fit`) in C++ [U].
4. **Chrome bug tracker.** issues.chromium.org is a JavaScript application and the legacy bugs.chromium.org search returned only a shell page. No Chromium bug IDs are cited [U].
5. **Feature status.** The Chromium flags checked (`WebAppNavigationBarThemeColor` enabled, `EdgeToEdgeEverywhere` enabled, `WebAppShortEdgesCutoutMode` disabled) are their compiled defaults in Chrome 156 [V]. Server-side rollouts can change them, and I did not check chromestatus.com or origin trials [U].
6. **WebAPK metadata source for dark colours.** The W3C manifest has `color_scheme_dark`, but Chromium's parser does not read it on `main`. I did not determine where `dark_background_color` and `dark_theme_color` come from [U].
7. **WebAPK update timing.** How often Chrome applies manifest changes to an installed WebAPK is [U].
8. **Pin cap and OEM sheets.** The four-pin cap comes only from press reports [U]. Samsung One UI behaviour is [U].
9. **Samsung.** No primary source found. Treat any Samsung-specific step as unverified.
10. **Chromium-wide search.** I could not search all of Chromium for `ShortcutManager` publishers. The "no WebAPK sharing shortcuts" claim rests on the WebAPK shell and update code I read [U for completeness].
11. **TWA navigation bar.** The claim that a TWA is subject to the same Android 15+ ignore rule is an inference from the shared Chrome Custom Tab activity. Not tested [I].
