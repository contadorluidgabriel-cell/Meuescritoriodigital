import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const payloadFile = fileURLToPath(new URL('../source-payloads/pnpm-lock.yaml.gz.b64', import.meta.url))
const lockFile = fileURLToPath(new URL('../pnpm-lock.yaml', import.meta.url))
const encoded = readFileSync(payloadFile, 'utf8').replace(/\s+/g, '')
writeFileSync(lockFile, gunzipSync(Buffer.from(encoded, 'base64')))
console.log('pnpm-lock.yaml restored from verified V11.1 payload')
