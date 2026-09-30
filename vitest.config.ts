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
    ],
  },
})
