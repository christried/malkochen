# Snackbert Reports go server to server, matched by email, and malkochen keeps no nutrition data

A Snackbert Report is captured in malkochen: Snackbert's head asks there, and the portion's photo, recording or text is added there. malkochen's server sends it, with the Dish's details, straight to a function in Snackbert, which writes it into the Snackbert account with the same verified email address. malkochen only confirms the Report was sent. It stores none of the portion and never shows calories or Snackbert's answer, so no nutrition data ever lives in malkochen.

Both apps only hold verified addresses (Google, or an email code in malkochen; Google in Snackbert), so matching by email can't reach someone else's account, and nobody has a step to pair. Snackbert is private: only people with a Snackbert account ever see it in malkochen.

## Considered Options

- **Hand off to the Snackbert app** through an Android intent: Android only, a new APK, and a switch of apps in the middle of the moment.
- **A pairing code from the Snackbert app:** needs a new APK and a step nobody would remember, for a private app whose users use the same address in both.
- **Show Snackbert's result in malkochen** (calories, his comment): a 10–30 second wait on two model calls, a way back from Snackbert to malkochen, and nutrition figures, close to health data, kept in a public app.

## Consequences

- Someone who uses different addresses in the two apps can't connect them.
- malkochen's Datenschutz names Snackbert as a recipient; switching Snackbert on in Your Settings is the consent.
- Each caller (malkochen production, Staging) has its own secret, so one can be revoked without the other. Staging's Reports land in the real Snackbert accounts.
