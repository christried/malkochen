import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// What the API test server runs with besides the auth settings
// (global-setup.ts), for the tests to see too.

// Where its disk storage keeps images: a folder of its own, so the daily
// sweep the tests run (cleanup.test.ts) never touches the images of local
// dev under .data/images, which its throwaway database doesn't know.
export const IMAGE_DIR = resolve('.data/api-test-images')

// Lets the tests call the daily cleanup job (/api/cron/cleanup) like Vercel Cron.
export const CRON_SECRET = 'test-cron-secret-test-cron-secret'

// The file names stored in one of its folders.
export const storedImages = (folder: 'dishes' | 'pictures' = 'dishes') => readdir(join(IMAGE_DIR, folder)).catch(() => [])
