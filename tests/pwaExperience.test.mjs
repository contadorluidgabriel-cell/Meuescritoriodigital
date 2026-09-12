import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('manifest instala o MED como aplicativo e abre no contexto diário', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'))

  assert.equal(manifest.name, 'Meu Escritório Digital')
  assert.equal(manifest.short_name, 'MED')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/?app=1')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.theme_color, '#2456E8')
  assert.ok(manifest.shortcuts.some(item => item.url === '/?push=meu-dia'))
  assert.ok(manifest.shortcuts.some(item => item.url === '/?push=tarefas'))
})

test('runtime registra o mesmo service worker usado pelo push e oferece instalação sem duplicar banner', () => {
  const runtime = read('src/lib/pwa.js')
  const main = read('src/main.jsx')

  assert.match(main, /initPwaRuntime\(\)/)
  assert.match(runtime, /navigator\.serviceWorker\.register\('\/push-sw\.js', \{ scope: '\/' \}\)/)
  assert.match(runtime, /beforeinstallprompt/)
  assert.match(runtime, /appinstalled/)
  assert.match(runtime, /document\.getElementById\('med-pwa-install'\)/)
})

test('PWA abre Meu Dia e atalhos de push continuam roteando para módulos', () => {
  const patch = read('scripts/patch-push-notifications.mjs')

  assert.match(patch, /'meu-dia': 'meu-dia'/)
  assert.match(patch, /pendencias: 'pendencias'/)
  assert.match(patch, /launchParams\.get\('app'\) === '1' \? 'meu-dia' : 'dashboard'/)
  assert.match(patch, /tarefas: 'tarefas'/)
  assert.match(patch, /calendario: 'calendario'/)
})

test('service worker preserva notificações e abertura do Meu Dia', () => {
  const worker = read('public/push-sw.js')

  assert.match(worker, /self\.addEventListener\('push'/)
  assert.match(worker, /self\.addEventListener\('notificationclick'/)
  assert.match(worker, /'open-day': '\/\?push=meu-dia'/)
})
