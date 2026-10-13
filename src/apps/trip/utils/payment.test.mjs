// node --test src/apps/trip/utils/*.test.mjs
//
// Paiements : qui paie, où en est le paiement, le bilan du voyage.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLEMENT_UID, LISE_UID } from '../../../shared/config/people.js'
import {
  amountLeft, JOINT, normalizeCompanions, payerLabel, payerOptions, paymentFields, paymentLine,
  paymentSummary, paymentTag,
} from './payment.js'

// Les montants formatés par Intl contiennent des espaces insécables.
const plain = (s) => s?.replace(/[  ]/g, ' ')

test('compagnons : prénoms rognés, sans doublon, sans Clément, Lise ni le compte commun', () => {
  assert.deepEqual(normalizeCompanions(' Laure , laure, Paul,,Clément, lise, joint, Compte commun'), ['Laure', 'Paul'])
  assert.deepEqual(normalizeCompanions(['Laure', '  ', null]), ['Laure'])
  assert.deepEqual(normalizeCompanions(undefined), [])
  assert.equal(normalizeCompanions(Array.from({ length: 12 }, (_, i) => `P${i}`)).length, 8)
})

test('champs de paiement : l’acompte et l’échéance ne survivent qu’avec leur état', () => {
  assert.deepEqual(paymentFields({}), { paidBy: null, paymentStatus: null, deposit: null, dueDate: null })
  assert.deepEqual(
    paymentFields({ paidBy: ' Laure ', paymentStatus: 'deposit', deposit: '11600', dueDate: '2026-12-01' }),
    { paidBy: 'Laure', paymentStatus: 'deposit', deposit: 11600, dueDate: null },
  )
  assert.deepEqual(
    paymentFields({ paymentStatus: 'due', deposit: 5, dueDate: '2026-12-01' }),
    { paidBy: null, paymentStatus: 'due', deposit: null, dueDate: '2026-12-01' },
  )
  assert.equal(paymentFields({ paymentStatus: 'bientôt' }).paymentStatus, null)
  assert.equal(paymentFields({ paymentStatus: 'due', dueDate: 'demain' }).dueDate, null)
})

test('payeurs : les deux, les compagnons, le compte commun, et un ancien compagnon encore choisi', () => {
  assert.deepEqual(payerOptions(['Laure']).map((p) => p.label), ['Clément', 'Lise', 'Laure', 'Compte commun'])
  assert.deepEqual(payerOptions([], 'Paul').map((p) => p.label), ['Clément', 'Lise', 'Paul', 'Compte commun'])
  // Les invités d'un lien de partage, sans doublon avec les compagnons.
  assert.deepEqual(payerOptions(['Laure'], null, ['laure', 'Marie']).map((p) => p.label), ['Clément', 'Lise', 'Laure', 'Marie', 'Compte commun'])
  assert.equal(payerLabel(CLEMENT_UID), 'Clément')
  assert.equal(payerLabel(JOINT), 'Compte commun')
  assert.equal(payerLabel('Laure'), 'Laure')
  assert.equal(payerLabel(null), null)
})

test('reste à payer', () => {
  assert.equal(amountLeft({ price: 100, paymentStatus: 'paid' }), 0)
  assert.equal(amountLeft({ price: 23200, paymentStatus: 'deposit', deposit: 11600 }), 11600)
  assert.equal(amountLeft({ price: 100, paymentStatus: 'deposit', deposit: 150 }), 0)
  assert.equal(amountLeft({ price: 100, paymentStatus: 'onsite' }), 100)
  assert.equal(amountLeft({ price: null, paymentStatus: 'onsite' }), null)
})

test('l’état en une ligne et en un mot', () => {
  assert.equal(paymentLine({ paymentStatus: 'paid', paidBy: LISE_UID }), 'Payé par Lise')
  assert.equal(
    plain(paymentLine({ paymentStatus: 'deposit', paidBy: 'Laure', price: 200, deposit: 50, currency: 'EUR' })),
    'Acompte de 50 € versé par Laure · reste 150 € sur place',
  )
  assert.equal(paymentLine({ paymentStatus: 'onsite', paidBy: 'Laure' }), 'À payer sur place par Laure')
  assert.equal(paymentLine({ paymentStatus: 'due', dueDate: '2026-12-03' }), 'À payer avant le 3 décembre')
  assert.equal(paymentLine({ paidBy: JOINT }), 'Payeur : Compte commun')
  assert.equal(paymentLine({}), null)
  assert.deepEqual(paymentTag({ paymentStatus: 'paid' }), { tone: 'ok', label: 'Payé' })
  assert.deepEqual(paymentTag({ paymentStatus: 'due', dueDate: '2026-12-03' }), { tone: 'todo', label: 'Avant le 3 décembre' })
  assert.equal(paymentTag({}), null)
})

test('bilan : versé par payeur et par devise, reste sur place, échéances triées', () => {
  const entries = [
    { kind: 'transport', item: { id: 'a', price: 1938, currency: 'AUD', paymentStatus: 'paid', paidBy: CLEMENT_UID } },
    { kind: 'transport', item: { id: 'b', price: 474.39, currency: 'EUR', paymentStatus: 'paid', paidBy: 'Laure' } },
    { kind: 'stay', item: { id: 'c', price: 23200, currency: 'XPF', paymentStatus: 'deposit', deposit: 11600, paidBy: 'Laure' } },
    { kind: 'stay', item: { id: 'd', price: 14500, currency: 'XPF', paymentStatus: 'onsite' } },
    { kind: 'stay', item: { id: 'e', price: 41500, currency: 'XPF', paymentStatus: 'due', dueDate: '2026-12-28' } },
    { kind: 'stay', item: { id: 'f', price: 100, currency: 'EUR', paymentStatus: 'due', dueDate: '2026-12-01' } },
    { kind: 'stay', item: { id: 'g', price: 50, currency: 'EUR', paymentStatus: 'paid' } },
    { kind: 'stay', item: { id: 'h', price: 13680, currency: 'XPF' } },
    { kind: 'stay', item: { id: 'i', price: null } },
  ]
  const s = paymentSummary(entries)
  assert.deepEqual(s.paid, [
    { payer: CLEMENT_UID, label: 'Clément', totals: [{ currency: 'AUD', total: 1938 }] },
    { payer: 'Laure', label: 'Laure', totals: [{ currency: 'XPF', total: 11600 }, { currency: 'EUR', total: 474.39 }] },
    { payer: null, label: null, totals: [{ currency: 'EUR', total: 50 }] },
  ])
  assert.deepEqual(s.onsite, [{ currency: 'XPF', total: 26100 }])
  assert.deepEqual(s.due.map((d) => [d.item.id, d.amount, d.dueDate]), [['f', 100, '2026-12-01'], ['e', 41500, '2026-12-28']])
  assert.equal(s.unknown, 1)
})
