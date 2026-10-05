// heic-decode ships no types. Only what server/image-store/photo.ts uses.
declare module 'heic-decode' {
  interface DecodedHeic { width: number, height: number, data: Uint8ClampedArray }
  interface HeicImage { width: number, height: number, decode: () => Promise<DecodedHeic> }
  interface Decode {
    (input: { buffer: Uint8Array }): Promise<DecodedHeic>
    // Every image in the file, each decoded on demand; dispose() frees them.
    all: (input: { buffer: Uint8Array }) => Promise<HeicImage[] & { dispose: () => void }>
  }
  const decode: Decode
  export default decode
}
