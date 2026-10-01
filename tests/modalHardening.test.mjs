import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/modal-hardening.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('global modal hardening loads after application styles', () => {
  assert.match(main, /import '\.\/modal-hardening\.css'/)
})

test('all operational modal families stay above fixed application chrome', () => {
  for (const selector of ['.client-modal', '.task-modal', '.process-modal', '.obligation-modal', '.finance-modal', '.dashboard-modal', '.outsourced-modal']) {
    assert.ok(css.includes(selector), `missing modal selector ${selector}`)
  }
  assert.match(css, /z-index:\s*2000\s*!important/)
})

test('desktop modal cards fit the viewport and remain scrollable', () => {
  assert.match(css, /max-height:\s*calc\(100dvh - 32px\)/)
  assert.match(css, /overflow-y:\s*auto\s*!important/)
  assert.match(css, /position:\s*sticky\s*!important/)
})

test('mobile modal behavior remains a bottom sheet', () => {
  assert.match(css, /@media \(max-width: 820px\)/)
  assert.match(css, /align-items:\s*flex-end\s*!important/)
  assert.match(css, /height:\s*94dvh\s*!important/)
})
