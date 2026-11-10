// A copy through JSON: what is kept never shares an object with the one on
// screen, and a reactive proxy can't be cloned into storage.
export const plainCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
