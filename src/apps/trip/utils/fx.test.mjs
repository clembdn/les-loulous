// node --test src/apps/trip/utils/*.test.mjs
//
// L'équivalent en euros : parité fixe du franc Pacifique, taux BCE sinon.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eurRate, eurTotal, normalizeRates, showsEur, toEur } from './fx.js'

const RATES = normalizeRates({ date: '2026-10-12', rates: { AUD: 1.6032, USD: 1.1181, bad: 3, JPY: -1 } })

test('taux relus : seulement des codes ISO et des nombres positifs', () => {
  assert.deepEqual(RATES, { date: '2026-10-12', rates: { AUD: 1.6032, USD: 1.1181 } })
  assert.equal(normalizeRates(null), null)
  assert.equal(normalizeRates({ rates: 'x' }), null)
})

test('le franc Pacifique se convertit sans réseau : 1 000 F = 8,38 €', () => {
  assert.equal(toEur(1000, 'XPF', null), 8.38)
  assert.equal(toEur(23200, 'XPF', null), 194.42)
  assert.equal(eurRate('EUR', null), 1)
  assert.equal(toEur(474.39, 'EUR', null), 474.39)
})

test('les autres devises au taux du jour, rien sans taux', () => {
  assert.equal(toEur(1938, 'AUD', RATES), 1208.83)
  assert.equal(toEur(1938, 'AUD', null), null)
  assert.equal(toEur(100, 'THB', RATES), null)
  assert.equal(toEur(null, 'AUD', RATES), null)
})

test('équivalent montré hors euro seulement, et si on sait le calculer', () => {
  assert.equal(showsEur('EUR', RATES), false)
  assert.equal(showsEur('XPF', null), true)
  assert.equal(showsEur('AUD', null), false)
  assert.equal(showsEur('AUD', RATES), true)
})

test('total en euros, avec ce qui n’a pas pu être converti', () => {
  const items = [
    { price: 1938, currency: 'AUD' },
    { price: 23200, currency: 'XPF' },
    { total: 474.39, currency: 'EUR' },
    { price: 100, currency: 'THB' },
    { price: null, currency: 'EUR' },
  ]
  assert.deepEqual(eurTotal(items, RATES), { total: 1877.64, missing: 1 })
})
