# Shipping malkochen to the Google Play Store

Research date: 2026-10-18. Scope: Android only. iOS is out of scope.

Legend:
- **[V]** read in a primary source this session. URL given.
- **[I]** inference. Not found in a source, or not tested on a device.

Repo facts were read from `C:\Users\gilge\Desktop\malkochen`.

---

## TL;DR

- **How easy?** Easy on the technical side. A Trusted Web Activity (TWA) wraps the existing PWA. Bubblewrap makes the Android project from `manifest.webmanifest`. Most work is Play Console paperwork, not code [I].
- **The slow part is the new-account rule.** A new personal account needs a closed test with at least 12 testers, opted in for 14 days in a row, before it can ask for production [V].
- **One real repo gap: account deletion.** The app has Google sign-in accounts. Play requires an in-app way to delete the account and a web link for it. The repo has no account deletion today [V for the rule, V for the repo gap: no `deleteUser` in `server/utils/auth.ts`, nothing in `app/pages/settings.vue` hits for "delete account"]. This must be built.
- **Other repo gaps:** no `public/.well-known/assetlinks.json` (the folder does not exist), and a privacy policy URL is needed (there is `app/utils/legal.ts` and `LegalLinks.vue`; check that the policy covers Play's data questions).
- **Share target, push, sign-in:** share target and push are supported by the TWA mechanism with settings in the Android project. Google sign-in should work because it runs in the browser, not a WebView, but this is untested [I].
- **Updates:** web deploys need no new release. A new bundle is needed only when the wrapper changes (section 6).
- **Effort:** about 1 to 2 agent days of repo work, about half a day of human console work, plus 14 days of waiting for the closed test (section 8).

---

## 1. Repo starting point

- Manifest (`public/manifest.webmanifest`): `id` `/`, `start_url` `/`, `scope` `/`, `display` standalone, `lang` `de`, `theme_color` and `background_color` both `#FCD980`. It has 192 and 512 `any` icons, 192 and 512 `maskable` icons, a monochrome SVG and an SVG `any` icon. [V, read the file]
- Share target: `action` `/share`, `method` GET, params `title`, `text`, `url`. Page is `app/pages/share.vue`. [V]
- Web Push: `web-push` on the server (`server/push/index.ts`) with VAPID keys, client in `app/composables/usePushNotifications.ts`, service worker at `public/sw.js`. [V]
- Auth: Better Auth, Google only (`server/utils/auth.ts`, `app/composables/useAuth.ts` calls `authClient.signIn.social({ provider: 'google' })`). [V]
- No `.well-known` folder in `public/`. [V]
- Earlier research (`docs/research/android-nav-bar-and-share-sheet.md`) already looked at a Bubblewrap TWA only for the nav bar and Direct Share. It did not cover publishing.

## 2. TWA with Bubblewrap or PWABuilder

### What a TWA is
- A TWA opens your site in Chrome full screen, without a URL bar, if the app and the site prove they belong together with Digital Asset Links. Chrome 72 or newer is needed. Otherwise Chrome falls back to a Custom Tab with a toolbar. [V] https://developer.chrome.com/docs/android/trusted-web-activity/
- Digital Asset Links must be set up both ways: the app points at the site (`asset_statements` in the Android manifest) and the site points at the app (`/.well-known/assetlinks.json` at the domain root). Chrome checks only that one location. [V] https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide
- The file needs the package name and the SHA-256 fingerprint of the signing key. [V] same page.

### Bubblewrap
- Install: `npm i -g @bubblewrap/cli`, Node 18 or newer. JDK 17 is required, and the Android command line tools. A Docker image with everything exists. [V] https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md
- `bubblewrap init --manifest=<url>` reads the live manifest, asks for the package ID and signing key details, and writes an Android project plus `twa-manifest.json`. [V] same README.
- `bubblewrap build` makes a signed APK for testing and a signed AAB for the Play Store. [V] same README.
- `bubblewrap fingerprint generateAssetLinks` writes the `assetlinks.json` content. You deploy it to the domain. [V] same README.
- `twa-manifest.json` fields that matter here: `host`, `startUrl`, `packageId`, `iconUrl`, `maskableIconUrl`, `monochromeIconUrl`, `themeColor`, `backgroundColor`, `navigationColor`, `enableNotifications`, `shareTarget`, `shortcuts`, `appVersion`, `appVersionCode`, `fingerprints`. `bubblewrap update` regenerates the project after edits. [V] same README.
- CI use: keystore passwords come from `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD`. [V] same README.

### PWABuilder
- PWABuilder's Android packaging is built on Bubblewrap and runs in a Docker image with the Android build tools. It returns a zip with an `.apk` for testing and an `.aab` for the Play Store. [V] https://github.com/pwa-builder/CloudAPK (README; the repo is archived, the service moved into the main PWABuilder repo)
- I could not read the PWABuilder docs page (it loads by script). Details of its signing key flow are [I].
- Both tools make the same kind of project. Pick PWABuilder for a web form with no local toolchain. Pick Bubblewrap if the build should live in the repo and run in CI. Recommendation: Bubblewrap, so the wrapper is reproducible and `twa-manifest.json` is versioned [I].

### What the repo needs
- **`assetlinks.json`** served at `https://<domain>/.well-known/assetlinks.json` with `Content-Type: application/json` and no redirect. Put it in `public/.well-known/assetlinks.json`. Check that Nitro and the Vercel config serve a dot-folder from `public/` [I: dot-folders are sometimes skipped by static handlers; test it on a deploy].
- **Fingerprint.** With Play App Signing, Google re-signs the app with its own key. The fingerprint that Chrome sees is the Play app signing key, not your upload key. The `assetlinks.json` needs the app signing SHA-256 from Play Console (App integrity), and optionally the upload key SHA-256 for local APK tests. [I, from how Play App Signing works; the Chrome page says "the same signing key links the website and the app". Check the Play Console value after the first upload.]
- **Manifest.** Already fine: name, icons at 192 and 512, maskable icons, `start_url`, `display` standalone. Bubblewrap needs a 512 px PNG for the launcher icon and, if wanted, a maskable and a monochrome icon (`monochromeIconUrl` is used for notification icons). The monochrome icon is an SVG here, and Bubblewrap needs a PNG [I: its generator resizes bitmap icons; check on first run].
- **Play listing assets** (not in the repo today): a 512x512 icon, a 1024x500 feature graphic, at least two phone screenshots [I, standard Play listing fields; confirm in Play Console].

### Signing keys and Play App Signing
- Releases are built around Android App Bundles. [V] https://support.google.com/googleplay/android-developer/answer/9859348
- Play App Signing is set up at the first release. After a release goes to an open track, the app signing key is fixed. [V] same page.
- Upload key versus app signing key: you sign the bundle with the upload key, Google re-signs with the app signing key [I, general Play behaviour; the page I could read does not spell it out].
- **Keep the upload keystore safe and backed up.** It is the human's secret. A lost upload key can be reset through Play support, but it takes time [I].

## 3. Play Console account

- **Fee.** One-time US$25. Prepaid cards are not accepted. [V] https://support.google.com/googleplay/android-developer/answer/6112435
- **Identity.** A government ID and a credit card, both under the legal name. If the data is judged invalid, the fee is not refunded. [V] same page.
- **Device check.** New personal accounts must verify access to an Android device through the Play Console mobile app. [V] same page.
- **Testing rule for new personal accounts** (created after 2023-11-13): a closed test with at least **12 testers**, opted in **continuously for the 14 days** before you apply for production. Testers who leave and rejoin do not count. [V] https://support.google.com/googleplay/android-developer/answer/14151465
- **Organisation accounts** are exempt from that rule per Google's account-type docs [I: I did not read it this session; the fetched page only said the rule applies to personal accounts]. An organisation account needs a D-U-N-S number, which a hobby project does not have [I].
- Testers must be real Google accounts that opt in through the test link. For two users and friends, 12 is the hard part. Plan for it early [I].

## 4. Policy

- **Target SDK.** From 2026-08-31, new apps and updates must target API 36 (Android 16). An extension to 2026-11-01 can be requested. [V] https://developer.android.com/google/play/requirements/target-sdk (page last updated 2026-10-16; it tells you to re-check the Play Console help article before relying on the dates). A fresh Bubblewrap project should default to a current target, but check `targetSdkVersion` in the generated Gradle file [I].
- **Data safety form.** Required for every published app, even if it collects nothing. Internal-only tracks are exempt. A privacy policy URL is required to complete it. [V] https://support.google.com/googleplay/android-developer/answer/10787469 . For malkochen, declare at least: Google account info (name, email), user-generated content (dishes, Boards), device identifiers or push subscription data, and that data is encrypted in transit [I, from the repo's features].
- **Privacy policy.** The repo has legal links (`app/components/LegalLinks.vue`, `app/utils/legal.ts`). Check that the policy page is a public URL without login and names the data above [I].
- **Account deletion.** Required for apps where users can create an account in the app. [V] https://support.google.com/googleplay/android-developer/answer/13327111
  - An in-app path to delete the account and its data, prominent, for example in settings. It may link out to a web page.
  - A web page for deletion that works without installing the app, names the app or developer, and is entered as a link in Play Console.
  - Data kept for legal or security reasons must be disclosed in the privacy policy.
  - **Repo gap:** `app/pages/settings.vue` has no delete-account action, and `server/utils/auth.ts` does not enable Better Auth's delete-user [V for absence]. The DB schema already uses `ON DELETE cascade` for `account` (migration `0001`) and keeps added dishes "as unknown" when an account is deleted (`server/db/schema.ts` lines ~250 and ~270), so the data model has thought about it [V]. What happens to sole-owner Boards needs a product decision [I].
- **Content rating.** An IARC questionnaire in Play Console is required for every new app. [V] https://support.google.com/googleplay/android-developer/answer/9859655 . Boards are shared between invited people, so answer the user-generated-content questions honestly [I].
- **Website wrapper policy.** I did not find a single Play rule that bans TWAs. The Spam, Functionality and User Experience policy has a minimum-functionality angle, which I could not read this session [I]. malkochen has push, share target and an offline page, so it is more than a bare website [I].
- **Other Play Console forms** (App access, Ads, Target audience, News, Government, Financial features): all are short questionnaires [I]. App access: reviewers need a way to sign in. With Google-only sign-in, prepare a test Google account and put its details in the App access form [I].

## 5. Does it work inside a TWA?

### Web Share Target: yes, with Android project config
- Supported in TWAs from Chrome 86. The Android app needs `android-browser-helper` 2.0.1 or newer, the `share_target` JSON in `strings.xml` (action URL fully qualified), a `meta-data` tag for it, and an intent filter for `SEND` and `SEND_MULTIPLE` on the launcher activity. [V] https://developer.chrome.com/docs/android/trusted-web-activity/web-share-target
- Bubblewrap does this from the `shareTarget` field. Its generator makes the `ACTION_SEND` filter with `text/plain` when title, text or url params exist. [V] https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/core/src/lib/TwaGenerator.ts
- The `action` must be a full URL (`https://<domain>/share`), unlike the relative `/share` in the web manifest. Bubblewrap reads the web manifest, so check it resolves this [I].
- With a TWA, malkochen would be a second share target next to the installed PWA, if both are installed. In practice the user has one or the other [I].

### Web Push: yes, through notification delegation
- With delegation, the Android app posts the notification itself, so it follows the app's notification permission, not the browser's. [V] https://developer.android.com/reference/androidx/browser/trusted/TrustedWebActivityService
- Bubblewrap switches it on with `enableNotifications: true` and generates notification icons and a `DelegationService`. [V] README and TwaGenerator.ts above.
- Delegation works with Chrome, Brave and Vivaldi. It is not supported in Samsung Internet, Firefox, Edge, Opera and others. [V] https://github.com/GoogleChrome/android-browser-helper/blob/main/docs/trusted-web-activity-browser-support.md . A TWA launches in the default browser that supports TWAs. Both users have Samsung phones; the default browser may be Samsung Internet, but Chrome is normally installed and a TWA picks a supporting provider [I]. Test on the real phones.
- On Android 13 and up, `POST_NOTIFICATIONS` is a runtime permission for the app [I; general Android behaviour, the TWA page I read did not show it]. Bubblewrap's template handles the request flow [I, unverified].
- The server side (`web-push`, VAPID, `public/sw.js`) needs no change [I]. The page still calls `Notification.requestPermission()` and `pushManager.subscribe`, and Chrome routes the permission through delegation.
- A device test is needed. I did not find docs that guarantee push subscriptions (not just local notifications) behave identically under delegation [I].

### Google sign-in: should work, not tested
- Google blocks sign-in inside embedded WebViews. A TWA is not a WebView. It is a Chrome tab, so the standard redirect flow is allowed [I]. A search found the WebView block in a third-party doc (https://codenameone.com/javadoc/com/codename1/io/oidc/SystemBrowser) but no TWA-specific source [I].
- The redirect goes from `<domain>` to `accounts.google.com` and back to `<domain>/api/auth/callback/google`. When the browser leaves the verified origin, Chrome shows a Custom Tab over the TWA, then returns. When it comes back to the verified origin, the TWA continues [I, from how TWA handles off-origin navigation; not verified on a source this session].
- Two things to check: (1) cookies set during the callback persist (they are Chrome's cookie jar, shared with the TWA) [I], and (2) the `additionalTrustedOrigins` field in `twa-manifest.json` is only needed if the app itself is hosted on more than one origin, not for Google's page [I].
- Test first with the debug APK before anything else. If it fails, the fallback is a one-line `intent` to open the sign-in in Chrome proper [I].

## 6. Updates

- Web deploys (Vercel) reach the TWA at once. The TWA loads the live site. No Play release. [V in spirit: https://developer.chrome.com/docs/android/trusted-web-activity/ describes the TWA as the site shown full screen. I did not find one sentence that says "no release needed".]
- A new AAB is needed when:
  - the manifest values copied into the wrapper change: name, icons, theme and background colour (the splash and status bar come from the Android project), share target, shortcuts [V that these are fields of `twa-manifest.json`; I for "needs a new bundle"];
  - the package ID, domain or signing setup changes;
  - Play raises the target SDK floor (a yearly event, see section 4) [V];
  - Bubblewrap's library or template needs an upgrade (security fixes) [I].
- The earlier research decision to set `theme_color` to `#FCD980` is already in the manifest. A TWA copies it at build time, so keep both in sync [I].
- Plan one wrapper update per year, for the target SDK [I].

## 7. Could a TWA publish Direct Share shortcuts?

- Yes, with native code. Bubblewrap's template ships an empty `shortcuts.xml` and no `ShortcutManager` calls, so nothing comes free. [V, from the earlier research doc: https://github.com/GoogleChromeLabs/bubblewrap/blob/80d97ad2007fd80941ae56588f603bff5b5546b9/packages/core/template_project/app/src/main/res/xml/shortcuts.xml]
- The Direct Share row shows only sharing shortcuts from the Sharing Shortcuts API. [V] https://developer.android.com/develop/ui/compose/sharing/direct-share-targets
- What it takes [I]:
  1. A `<share-target>` in `shortcuts.xml` for an activity in the wrapper.
  2. A small Kotlin class that calls `ShortcutManagerCompat.pushDynamicShortcut` with a long-lived shortcut per Board.
  3. A way to get the Board list from the web app to native code. Options: the web app calls a native bridge (none exists in a plain TWA, and the PostMessage guide at https://developer.chrome.com/docs/android/post-message-twa is the nearest tool), or the wrapper fetches a small JSON endpoint with the user's session, which a native app cannot read from Chrome's cookies. The bridge is the hard part [I].
  4. The share activity then forwards the text to `/share?board=<id>` in the TWA.
- Effort: about 3 to 5 days of agent work plus device tests, and it forks the "wrapper is generated" simplicity because the project must be hand-maintained from then on [I]. Same verdict as the earlier doc: not worth it for the first release.

## 8. Effort and step list

### Estimate [I]
- Repo work: 1 to 2 agent days (account deletion is the largest piece, about half of it).
- Human console and device work: about half a day, spread over a few sittings.
- Calendar time: 14 or more days, driven by the closed test, plus Play review (days).

### Agent can do in the repo
1. Add `public/.well-known/assetlinks.json` (placeholder fingerprints first) and a test that it is served as JSON from the built site.
2. Build account deletion: Better Auth delete-user in `server/utils/auth.ts`, a "Konto löschen" action with confirmation in `app/pages/settings.vue`, server cleanup (push subscriptions, sessions, memberships, Board ownership rules), strings in `app/strings/de.ts`, e2e test.
3. Add a public web page for account deletion (works logged out: explains how, and signs in then deletes) for the Play Console link. Add it to `LegalLinks.vue` if suitable.
4. Review the privacy policy text against the Data safety answers; list the data types.
5. Add a `twa/` folder with `twa-manifest.json` (package ID, host, `enableNotifications`, `shareTarget` with full URL, icons) and a doc/script for `bubblewrap build`. Keep keystores and passwords out of git (`.gitignore`).
6. Prepare listing text (German and English), a 512 icon, a feature graphic and screenshots from the app.
7. Add an e2e/CI check that the manifest still has the fields the wrapper copies.
8. Write the device test script: share from Instagram/TikTok, push arrives, Google sign-in round trip, offline page.

### Only the human can do
1. Create the Play Console developer account: pay US$25, upload ID and card under the legal name, verify the Android device with the Play Console app.
2. Create the upload keystore, store it and its passwords safely (password manager plus offline backup).
3. Enrol in Play App Signing at the first upload and copy the app signing SHA-256 from App integrity to give to the agent for `assetlinks.json`.
4. Build the debug APK on a machine with JDK 17 and the Android SDK (or use the Docker image), install it on a Samsung phone and run the device test. An agent can script it, but cannot hold the phone.
5. Recruit and keep at least 12 testers opted in for 14 straight days (closed test). Needs real Google accounts. Re-count before applying.
6. Fill the Play Console forms: Data safety, content rating, App access (give reviewers a test Google account), target audience, privacy policy URL, account deletion URL.
7. Click "Apply for production" after the 14 days, and answer Google's follow-up questions about the closed test.
8. Accept the developer terms and the first release.

### Order
1. Human: open the Play account (long lead time, ID checks).
2. Agent: items 1 to 5 above in one or two PRs while the account is verifying.
3. Human and agent: debug APK, device test, fix problems.
4. Human: upload the first AAB to a closed test, add testers, start the 14-day clock.
5. Agent: update `assetlinks.json` with the Play signing fingerprint (before the test starts, or the app shows a toolbar).
6. Wait 14 days. Meanwhile finish listing and forms.
7. Human: apply for production, wait for review.

## Open and unverified points

1. Nothing here was run on a device. Push under delegation and Google sign-in in a TWA are the two things to test first.
2. The Chrome developer pages for notification delegation, the quality criteria and PWABuilder docs returned 404 or no content, so delegation details, `POST_NOTIFICATIONS` handling and PWABuilder's key flow rest on the Bubblewrap and Android reference pages plus inference.
3. Whether organisation accounts skip the closed test was not read this session.
4. Play's minimum-functionality policy text for wrapper apps was not read.
5. The Play target SDK page says to confirm dates in the Play Console help article (https://support.google.com/googleplay/android-developer/answer/11926878), which I did not fetch.
6. Whether Nitro or Vercel serves `public/.well-known/` as expected needs a deploy check.
7. Samsung Internet does not support delegation. If the phones' default browser is Samsung Internet and Chrome is absent or disabled, the TWA falls back and push may not work [V for the support table, I for the consequence].
