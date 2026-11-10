// The error for something that isn't on this device and needs malkochen to
// answer (#461): a Board never opened here, say, while there is no
// connection. The error screen says so (error.vue) instead of "Da ist was
// angebrannt".
export function needsConnection() {
  return createError({ statusCode: 503, data: { needsConnection: true }, fatal: true })
}
