// node --test src/apps/finauzi/utils/
//
// Le grand livre : soldes de chaque compte dans SA devise, virements qui ne
// sont ni dépense ni revenu pour le couple, et le détail ligne à ligne qui
// retombe exactement sur les totaux affichés.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLEMENT_UID as C } from '../../../shared/config/people.js'
import {
  getAccountBalanceAt, getAccountDelta, getAllBalances, getFlowEntries, getNetWorthEUR,
  getSpendingByCategory, getSpendingBySplit, getTransferKind, summarizePeriod,
} from './ledger.js'

const RATE = 2 // 1 € = 2 A$
const NOW = new Date(2026, 9, 8)
const FROM = new Date(2026, 8, 1)
const TO = new Date(2026, 8, 30)

let n = 0
const tx = (fields) => ({ id: `t${++n}`, recurrence: 'one-off', isActive: true, split: 'common', date: '2026-09-15', ...fields })
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`)

const rent = tx({ kind: 'expense', amount: 2400, currency: 'AUD', fromAccount: 'joint', recurrence: 'monthly', date: '2026-07-01', category: 'housing' })
const salary = tx({ kind: 'income', amount: 3000, currency: 'AUD', toAccount: 'joint', split: 'common', date: '2026-09-20', category: 'salary' })
const contribution = tx({ kind: 'transfer', amount: 1000, currency: 'EUR', fromAccount: 'clement', toAccount: 'joint', amountReceived: 1960, date: '2026-09-10' })
const groceries = tx({ kind: 'expense', amount: 120, currency: 'AUD', fromAccount: 'joint', date: '2026-09-12', category: 'groceries' })
const book = tx({ kind: 'expense', amount: 15, currency: 'EUR', fromAccount: 'clement', split: C, date: '2026-09-05', category: 'shopping' })
const hotelEUROnJoint = tx({ kind: 'expense', amount: 400, currency: 'EUR', fromAccount: 'joint', date: '2026-09-25', category: 'travel', rate: 1.5 })
const ALL = [rent, salary, contribution, groceries, book, hotelEUROnJoint]

test('la nature d’un virement se déduit des comptes', () => {
  assert.equal(getTransferKind(contribution).id, 'contribution')
  assert.equal(getTransferKind(tx({ kind: 'transfer', fromAccount: 'joint', toAccount: 'lise' })).id, 'withdrawal')
  assert.equal(getTransferKind(tx({ kind: 'transfer', fromAccount: 'lise', toAccount: 'clement' })).id, 'settlement')
  assert.equal(getTransferKind(rent), null)
})

test('un virement inter-devises : le montant reçu fait foi côté arrivée', () => {
  assert.equal(getAccountDelta(contribution, 'clement', RATE), -1000)
  assert.equal(getAccountDelta(contribution, 'joint', RATE), 1960, 'pas 2 000 au taux de l’app')
  assert.equal(getAccountDelta(contribution, 'lise', RATE), 0)
  // Sans montant reçu : conversion au taux.
  assert.equal(getAccountDelta({ ...contribution, amountReceived: null }, 'joint', RATE), 2000)
})

test('une dépense dans une autre devise que son compte : convertie au taux FIGÉ de la ligne', () => {
  assert.equal(getAccountDelta(hotelEUROnJoint, 'joint', RATE), -600) // 400 € × 1,5
})

test('le solde de chaque compte, dans sa devise, échéances passées comprises', () => {
  const balances = getAllBalances(ALL, { joint: 500, clement: 2000, lise: 800 }, RATE, NOW)
  // Joint : 500 − 3 loyers (juil., août, sept.) − 120 + 3000 + 1960 − 600.
  // (Le loyer du 1er octobre est tombé aussi : 4 loyers au 8 octobre.)
  close(balances.joint, 500 - 4 * 2400 - 120 + 3000 + 1960 - 600)
  close(balances.clement, 2000 - 1000 - 15)
  close(balances.lise, 800)
  // Avant l'apport, le joint ne l'a pas encore.
  close(getAccountBalanceAt(ALL, 'joint', 0, new Date(2026, 8, 9), RATE), -3 * 2400)
})

test('le patrimoine additionne A$ et € en euros', () => {
  close(getNetWorthEUR({ joint: 2000, clement: 500, lise: 250 }, RATE), 1000 + 500 + 250)
})

test('sur le couple, un virement n’est ni dépense ni revenu ; sur un compte, il entre ou sort', () => {
  const couple = summarizePeriod(ALL, { from: FROM, to: TO, rate: RATE })
  close(couple.income, 1500) // 3 000 A$
  // Loyer, courses, livre, hôtel : saisi en euros, l'hôtel vaut ses 400 € (pas reconverti).
  close(couple.expenses, 1200 + 60 + 15 + 400)
  close(couple.transfersIn + couple.transfersOut, 0)
  close(couple.net, couple.income - couple.expenses)

  const joint = summarizePeriod(ALL, { accountId: 'joint', from: FROM, to: TO, rate: RATE })
  close(joint.income, 3000)
  close(joint.expenses, 2400 + 120 + 600)
  close(joint.transfersIn, 1960)
  close(joint.net, 3000 + 1960 - 2400 - 120 - 600)

  const clement = summarizePeriod(ALL, { accountId: 'clement', from: FROM, to: TO, rate: RATE })
  close(clement.transfersOut, 1000)
  close(clement.expenses, 15)
})

test('le détail ligne à ligne retombe exactement sur les totaux (entrées et sorties)', () => {
  for (const accountId of [null, 'joint', 'clement', 'lise']) {
    const summary = summarizePeriod(ALL, { accountId, from: FROM, to: TO, rate: RATE })
    const currency = accountId ? (accountId === 'joint' ? 'AUD' : 'EUR') : 'EUR'
    const sum = (flow) => getFlowEntries(ALL, { accountId, from: FROM, to: TO, rate: RATE, currency, flow }).reduce((s, e) => s + e.amount, 0)
    close(sum('in'), summary.inflow)
    close(sum('out'), summary.outflow)
  }
})

test('dépenses par catégorie et par répartition, virements exclus', () => {
  const byCat = getSpendingByCategory(ALL, { from: FROM, to: TO, rate: RATE })
  close(byCat.housing, 1200)
  close(byCat.travel, 400)
  assert.equal(byCat.transfer, undefined)
  const bySplit = getSpendingBySplit(ALL, { from: FROM, to: TO, rate: RATE })
  close(bySplit.common, 1200 + 60 + 400)
  close(bySplit[C], 15)
})

test('une transaction désactivée ne bouge aucun solde', () => {
  const off = { ...groceries, isActive: false }
  close(getAccountBalanceAt([off], 'joint', 100, NOW, RATE), 100)
  assert.equal(summarizePeriod([off], { from: FROM, to: TO, rate: RATE }).expenses, 0)
})
