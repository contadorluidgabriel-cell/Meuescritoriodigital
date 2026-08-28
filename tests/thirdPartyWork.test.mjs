import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCnpj, thirdPartyError } from '../src/lib/thirdPartyWork.js'

test('formats outsourced CNPJ in Brazilian pattern', () => {
  assert.equal(formatCnpj('12345678000190'), '12.345.678/0001-90')
})

test('outsourcing fields are optional when outsourcing is disabled', () => {
  assert.equal(thirdPartyError({ terceirizado: false }), '')
})

test('outsourcing requires only CNPJ and name when enabled', () => {
  assert.match(thirdPartyError({ terceirizado: true, terceiroCnpj: '123', terceiroNome: '' }), /14 dígitos/)
  assert.match(thirdPartyError({ terceirizado: true, terceiroCnpj: '12.345.678/0001-90', terceiroNome: '' }), /nome ou razão social/)
  assert.equal(thirdPartyError({ terceirizado: true, terceiroCnpj: '12.345.678/0001-90', terceiroNome: 'Empresa Terceirizada' }), '')
})
