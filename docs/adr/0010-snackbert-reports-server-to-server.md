# Snackbert Reports go server to server, matched by email, and malkochen keeps no nutrition data

From the Snackbert grilling session (2026-10-24). A Snackbert Report is captured in malkochen: Snackbert's head asks there, and the portion's photo, recording or text is added there. malkochen's server sends it, with the Dish's details, straight to a function in Snackbert, which writes it into the Snackbert account with the same verified email address. Snackbert analyses it as it does any meal, and the Snackbert app syncs it to Health Connect the next time it opens. malkochen only confirms the Report was sent. It stores none of the portion and never shows calories or Snackbert's answer, so no nutrition data ever lives in malkochen.

Both apps only hold verified addresses (Google, or an email code in malkochen; Google in Snackbert), so matching by email can't reach someone else's account, and nobody has a step to pair. Snackbert is private: only people with a Snackbert account ever see it in malkochen.

## Considered Options

- **Hand off to the Snackbert app** through an Android intent with the Dish's details filled in: no account link and no traffic between the servers, but Android only, a new APK, and a switch of apps in the middle of the moment the wish describes.
- **A pairing code from the Snackbert app:** works across different addresses, but needs a new APK and a step nobody would remember to do, for a private app with two users who use the same address in both.
- **Show Snackbert's result in malkochen** (calories, his comment): more fun, but means waiting 10–30 seconds on two model calls, a way back from Snackbert to malkochen, and nutrition figures, close to health data, kept in a public app.

## Consequences

- Someone who uses different addresses in the two apps can't connect them.
- malkochen's Datenschutz names Snackbert as a recipient; switching Snackbert on in Your Settings is the consent.
- Each caller (malkochen production, Staging) has its own secret, so one can be revoked without the other. Staging's Reports land in the real Snackbert accounts.
