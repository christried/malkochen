import packageJson from '../package.json'
import { parseServerEnv } from './env'

const { MALKOCHEN_VERSION } = parseServerEnv(process.env)

// malkochen's Version (CONTEXT.md): package.json's, which the newest Version
// in CHANGELOG.md matches (tests/client/changelog.test.ts); empty before
// 1.0.0. The test servers run as one of their own (MALKOCHEN_VERSION).
export const APP_VERSION: string = MALKOCHEN_VERSION || (packageJson as { version?: string }).version || ''
