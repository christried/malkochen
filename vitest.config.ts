import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          globalSetup: ['tests/api/global-setup.ts'],
          // One server and one database are shared by every API test file.
          fileParallelism: false,
          hookTimeout: 180_000,
        },
      },
      {
        test: {
          // Seam 2: Source Lookup against recorded upstream fixtures. No
          // server, no database, no network.
          name: 'source-lookup',
          include: ['tests/source-lookup/**/*.test.ts'],
        },
      },
      {
        test: {
          // Seam 3: the Image Store against a faked upstream and storage.
          name: 'image-store',
          include: ['tests/image-store/**/*.test.ts'],
        },
      },
    ],
  },
})
