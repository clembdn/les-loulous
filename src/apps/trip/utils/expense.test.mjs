// node --test src/apps/trip/utils/*.test.mjs
//
// « Envoyer à FinAuzi » : le lien, ce qu'on propose, la ligne de relevé à rattacher.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  expenseDefaults, expenseTitle, linkStatus, linkWindow, normalizeExpenseLink, rankCandidates,
} from './expense.js'

test('le lien relu : identifiant obligatoire, devises FinAuzi seulement', () => {
  assert.equal(normalizeExpenseLink(null), null)
  assert.equal(normalizeExpenseLink({ created: true }), null)
  assert.deepEqual(
    normalizeExpenseLink({ txId: 'tx1', created: true, amount: 245, currency: 'EUR', date: '2027-03-02', basisPrice: 245, basisCurrency: 'EUR' }),
    { txId: 'tx1', created: true, amount: 245, currency: 'EUR', date: '2027-03-02', basisPrice: 245, basisCurrency: 'EUR' },
  )
  assert.equal(normalizeExpenseLink({ txId: 'tx1', currency: 'JPY' }).currency, null)
})

test('le titre : ce qu’on a réservé, et le voyage', () => {
  assert.equal(expenseTitle('stay', { name: 'Hôtel Lisboa' }, 'Portugal'), 'Hôtel Lisboa · Portugal')
  assert.equal(
    expenseTitle('transport', { ref: 'TP1861', from: { name: 'Lisbonne' }, to: { name: 'Ponta Delgada' } }, 'Portugal', 'Vol'),
    'Vol TP1861 Lisbonne → Ponta Delgada · Portugal',
  )
  assert.equal(expenseTitle('transport', { from: {}, to: {} }, 'Portugal', ''), 'Réservation · Portugal')
})

test('le montant proposé : le prix en € ou A$, sinon le montant débité à saisir', () => {
  assert.deepEqual(expenseDefaults({ price: 245, currency: 'EUR' }), { amount: 245, currency: 'EUR', charged: false })
  assert.deepEqual(expenseDefaults({ price: 12000, currency: 'JPY' }), { amount: null, currency: null, charged: true })
  assert.deepEqual(expenseDefaults({ price: null, currency: null }), { amount: null, currency: null, charged: false })
})

test('où en est le lien : envoyée, à jour, prix changé, supprimée dans FinAuzi', () => {
  const link = normalizeExpenseLink({ txId: 'tx1', created: true, amount: 245, currency: 'EUR', basisPrice: 245, basisCurrency: 'EUR' })
  const item = { price: 245, currency: 'EUR' }
  assert.equal(linkStatus(null, item, undefined), 'none')
  assert.equal(linkStatus(link, item, undefined), 'loading')
  assert.equal(linkStatus(link, item, null), 'missing')
  assert.equal(linkStatus(link, item, { id: 'tx1' }), 'ok')
  assert.equal(linkStatus(link, { price: 260, currency: 'EUR' }, { id: 'tx1' }), 'outdated')
  assert.equal(linkStatus(link, { price: 245, currency: 'AUD' }, { id: 'tx1' }), 'outdated')
  // Envoyée sans prix (montant saisi à la main), réservation toujours sans prix : à jour.
  const noBasis = normalizeExpenseLink({ txId: 'tx2', amount: 80, currency: 'AUD', basisPrice: null, basisCurrency: null })
  assert.equal(linkStatus(noBasis, { price: null, currency: null }, { id: 'tx2' }), 'ok')
})

test('rattacher : même montant d’abord, puis le plus proche en date ; jamais une récurrence ni une ligne déjà liée', () => {
  const tx = (id, amount, date, extra = {}) => ({ id, kind: 'expense', recurrence: 'one-off', isActive: true, currency: 'EUR', amount, date, ...extra })
  const txs = [
    tx('far-date', 245, '2027-02-26'),
    tx('same', 245.4, '2027-03-04'),
    tx('other-amount', 31, '2027-03-02'),
    tx('rent', 245, '2027-03-02', { recurrence: 'monthly' }),
    tx('income', 245, '2027-03-02', { kind: 'income' }),
    tx('aud', 245, '2027-03-02', { currency: 'AUD' }),
    tx('too-old', 245, '2027-02-10'),
    tx('taken', 245, '2027-03-02'),
  ]
  const ranked = rankCandidates(txs, { amount: 245, currency: 'EUR', date: '2027-03-02' }, new Set(['taken']))
  assert.deepEqual(ranked.map((r) => r.tx.id), ['same', 'far-date', 'other-amount', 'aud'])
  assert.deepEqual(ranked.map((r) => r.match), [true, true, false, false])
  assert.deepEqual(linkWindow('2027-03-02'), { from: '2027-02-20', to: '2027-03-12' })
})
