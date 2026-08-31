import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVE_USER_KEY,
  KEYS,
  defaults,
  getLocalUpdatedAt,
  loadOffice,
  officePayload,
  saveOffice,
  today,
  userStoragePrefix,
} from '../src/lib/storage.js'

class LocalStorageMock {
  constructor() { this.map = new Map() }
  get length() { return this.map.size }
  clear() { this.map.clear() }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null }
  key(index) { return [...this.map.keys()][index] ?? null }
  removeItem(key) { this.map.delete(String(key)) }
  setItem(key, value) { this.map.set(String(key), String(value)) }
}

globalThis.localStorage = new LocalStorageMock()

const freshOffice = () => structuredClone(defaults)

test('today uses the local calendar date instead of UTC slicing', () => {
  const lateLocalDate = new Date(2026, 7, 27, 23, 59, 0)
  assert.equal(today(lateLocalDate), '2026-08-27')
})

test('legacy data migrates only to the first active user', () => {
  localStorage.clear()
  localStorage.setItem(KEYS.clients, JSON.stringify([{ id: 'legacy-a', razao: 'Cliente A' }]))

  const userA = loadOffice('user-a')
  assert.equal(userA.clients[0].id, 'legacy-a')
  saveOffice(userA, 'user-a', { touch: false })

  const userB = loadOffice('user-b')
  assert.deepEqual(userB.clients, [])
})

test('each authenticated user keeps an isolated local office snapshot', () => {
  localStorage.clear()
  const officeA = freshOffice()
  officeA.clients = [{ id: 'a', razao: 'Empresa A' }]
  saveOffice(officeA, 'user-a', { touch: false })

  const officeB = freshOffice()
  officeB.clients = [{ id: 'b', razao: 'Empresa B' }]
  saveOffice(officeB, 'user-b', { touch: false })

  assert.equal(loadOffice('user-a').clients[0].id, 'a')
  assert.equal(loadOffice('user-b').clients[0].id, 'b')
})

test('linked CNPJs persist separately and do not become clients', () => {
  localStorage.clear()
  const office = freshOffice()
  office.clients = [{ id: 'cli-a', razao: 'Cliente A', documento: '11.111.111/0001-11' }]
  office.linkedCompanies = [{ id: 'cnpjv-a', clientId: 'cli-a', razao: 'Empresa Relacionada', cnpj: '22.222.222/0001-22', status: 'Ativo' }]

  saveOffice(office, 'user-a', { touch: false })
  const restored = loadOffice('user-a')

  assert.equal(restored.clients.length, 1)
  assert.equal(restored.clients[0].id, 'cli-a')
  assert.equal(restored.linkedCompanies.length, 1)
  assert.equal(restored.linkedCompanies[0].clientId, 'cli-a')
  assert.equal(restored.linkedCompanies[0].cnpj, '22.222.222/0001-22')
})

test('work partners persist separately and can be referenced by shared clients', () => {
  localStorage.clear()
  const office = freshOffice()
  office.partners = [{ id: 'par-a', nome: 'Parceiro A', status: 'Ativo' }]
  office.clients = [{ id: 'cli-a', razao: 'Cliente A', perfilAtendimento: 'Compartilhado', parceiroId: 'par-a' }]

  saveOffice(office, 'user-a', { touch: false })
  const restored = loadOffice('user-a')

  assert.equal(restored.partners.length, 1)
  assert.equal(restored.partners[0].id, 'par-a')
  assert.equal(restored.clients[0].parceiroId, 'par-a')
})

test('local modification timestamp changes only when touch is requested', () => {
  localStorage.clear()
  const office = freshOffice()
  saveOffice(office, 'user-a', { touch: false })
  assert.equal(getLocalUpdatedAt('user-a'), '')
  saveOffice(office, 'user-a', { touch: true })
  assert.match(getLocalUpdatedAt('user-a'), /^\d{4}-\d{2}-\d{2}T/)
})

test('cloud payload does not leak user-scoped cache metadata', () => {
  localStorage.clear()
  const office = freshOffice()
  office.clients = [{ id: 'a', razao: 'Empresa A' }]
  office.linkedCompanies = [{ id: 'cnpjv-a', clientId: 'a', razao: 'Relacionada', cnpj: '22.222.222/0001-22' }]
  office.partners = [{ id: 'par-a', nome: 'Parceiro A' }]
  saveOffice(office, 'user-a', { touch: true })

  const payload = officePayload(office, 'user-a')
  assert.equal(payload[ACTIVE_USER_KEY], undefined)
  assert.equal(Object.keys(payload).some(key => key.startsWith(userStoragePrefix('user-a'))), false)
  assert.equal(payload[KEYS.clients][0].id, 'a')
  assert.equal(payload[KEYS.linkedCompanies][0].clientId, 'a')
  assert.equal(payload[KEYS.partners][0].id, 'par-a')
})