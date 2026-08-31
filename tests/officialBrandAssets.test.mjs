import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const fixtures = [
  ['brand-main.jpg', 4181, '8c1a62f820d89dd3b248b3ee8ff8a37a5852300f3d331ee3187e594b34402d2b'],
  ['brand-reduced.jpg', 2017, 'ff33e30d902f0c90291dd96e6fa425db97697a7751775e3288f9f843244c443b'],
]

test('PDF uses the exact official logo binaries extracted from the brand kit', () => {
  for (const [filename, expectedSize, expectedHash] of fixtures) {
    const bytes = readFileSync(new URL(`../src/assets/${filename}`, import.meta.url))
    assert.equal(bytes.length, expectedSize)
    assert.equal(bytes[0], 0xff)
    assert.equal(bytes[1], 0xd8)
    assert.equal(bytes.at(-2), 0xff)
    assert.equal(bytes.at(-1), 0xd9)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash)
  }
})
