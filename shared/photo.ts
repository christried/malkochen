// "Eigenes Foto": what a Member's own photo may be, for the upload (server)
// and the early check before it (client).

// Larger files are refused, before and after the upload.
export const PHOTO_MAX_BYTES = 10_000_000

// What the file picker offers. The server goes by the file's content, never
// by its name or the type the browser claims.
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

// Why an upload was refused: by status code, so the client can say it kindly.
export const PHOTO_TOO_LARGE = 413
export const PHOTO_NOT_AN_IMAGE = 415
