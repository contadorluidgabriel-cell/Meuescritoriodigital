import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFICIAL_MAIN_LOGO, OFFICIAL_REDUCED_LOGO } from '../src/assets/officialBrandJpegs.js'

function jpegBytes(asset) {
  return Buffer.from(asset.base64, 'base64')
}

test('PDF brand assets use the official horizontal and reduced signatures', () => {
  assert.deepEqual([OFFICIAL_MAIN_LOGO.width, OFFICIAL_MAIN_LOGO.height], [320, 85])
  assert.deepEqual([OFFICIAL_REDUCED_LOGO.width, OFFICIAL_REDUCED_LOGO.height], [120, 102])

  for (const asset of [OFFICIAL_MAIN_LOGO, OFFICIAL_REDUCED_LOGO]) {
    const bytes = jpegBytes(asset)
    assert.ok(bytes.length > 1000)
    assert.equal(bytes[0], 0xff)
    assert.equal(bytes[1], 0xd8)
    assert.equal(bytes.at(-2), 0xff)
    assert.equal(bytes.at(-1), 0xd9)
  }
})
