// node --test src/apps/finauzi/utils/
//
// Le solde du couple : qui doit combien à qui. Chaque test fixe une décision
// déjà tranchée (cf. l'en-tête de settlement.js) — en particulier les pièges
// rencontrés : le « /2 » qui ne porte QUE sur les apports, et l'ancien
// « remboursement au pot » qui comptait deux fois le même euro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLEMENT_UID as C, LISE_UID as L } from '../../../shared/config/people.js'
import { getAdvances, getBalanceSummary, getContributions, getSettlements } from './settlement.js'

// Taux global des réglages (1 € = 2 A$) : les calculs se font de tête.
const RATE = 2
const NOW = new Date(2026, 9, 8) // 8 octobre 2026, heure locale

let n = 0
const tx = (fields) => ({ id: `t${++n}`, recurrence: 'one-off', date: '2026-09-15', isActive: true, ...fields })
const expense = (amount, fromAccount, split, extra = {}) => tx({ kind: 'expense', amount, currency: fromAccount === 'joint' ? 'AUD' : 'EUR', fromAccount, toAccount: null, split, ...extra })
const income = (amount, toAccount, split, extra = {}) => tx({ kind: 'income', amount, currency: toAccount === 'joint' ? 'AUD' : 'EUR', fromAccount: null, toAccount, split, ...extra })
const transfer = (amount, fromAccount, toAccount, extra = {}) => tx({ kind: 'transfer', amount, currency: fromAccount === 'joint' ? 'AUD' : 'EUR', fromAccount, toAccount, split: 'common', ...extra })

const balance = (list) => getBalanceSummary(list, RATE, NOW)

/** « Lise doit 200 € à Clément » → { debtor: L, creditor: C, amount: 200 }. */
function owes(summary) {
  return { debtor: summary.debtorUid, creditor: summary.creditorUid, amount: summary.amount }
}

// ─── 1. Les apports au pot ─────────────────────────────────────────────────

test('apports : l’écart se partage en deux', () => {
  const list = [transfer(1000, 'clement', 'joint'), transfer(600, 'lise', 'joint')]
  const c = getContributions(list, RATE, NOW)
  assert.deepEqual(c.total, { [C]: 1000, [L]: 600 })
  assert.equal(c.gap, 400)
  assert.equal(c.aheadUid, C)
  assert.equal(c.amountToEqualize, 400, 'à verser AU POT pour égaliser')
  assert.deepEqual(c.credit, { [C]: 200, [L]: -200 })
  // Le chiffre à régler entre eux : la moitié de l'écart, pas l'écart.
  assert.deepEqual(owes(balance(list)), { debtor: L, creditor: C, amount: 200 })
})

test('apports : en A$ depuis un compte perso (salaire australien), convertis au taux', () => {
  const list = [transfer(1000, 'lise', 'joint', { currency: 'AUD' }), transfer(500, 'clement', 'joint')]
  assert.deepEqual(getContributions(list, RATE, NOW).total, { [C]: 500, [L]: 500 })
  assert.equal(balance(list).isSettled, true)
})

test('retrait du pot : un apport négatif, mesuré sur ce qui a atterri sur le perso', () => {
  // 400 A$ partis du joint, 190 € reçus (taux et frais réels) sur le perso de Clément.
  const list = [transfer(1000, 'clement', 'joint'), transfer(1000, 'lise', 'joint'), transfer(400, 'joint', 'clement', { amountReceived: 190 })]
  assert.deepEqual(getContributions(list, RATE, NOW).total, { [C]: 810, [L]: 1000 })
  assert.deepEqual(owes(balance(list)), { debtor: C, creditor: L, amount: 95 })
})

test('un revenu versé sur le joint au nom de quelqu’un est son apport ; un revenu commun, non', () => {
  const list = [income(2000, 'joint', L), income(600, 'joint', 'common')]
  assert.deepEqual(getContributions(list, RATE, NOW).total, { [C]: 0, [L]: 1000 })
})

// ─── 2. Les avances ────────────────────────────────────────────────────────

test('dépense commune payée du perso : l’autre doit la moitié, sans autre division', () => {
  const s = balance([expense(100, 'clement', 'common')])
  assert.deepEqual(s.advances.net, { [C]: 50, [L]: -50 })
  assert.deepEqual(owes(s), { debtor: L, creditor: C, amount: 50 })
})

test('dépense de l’autre payée de son perso : l’autre doit tout', () => {
  assert.deepEqual(owes(balance([expense(30, 'clement', L)])), { debtor: L, creditor: C, amount: 30 })
})

test('dépense perso passée sur la carte du joint : on doit la moitié à l’autre', () => {
  // 200 A$ = 100 € ; le pot est 50/50, Lise en a financé 50 €.
  assert.deepEqual(owes(balance([expense(200, 'joint', C)])), { debtor: C, creditor: L, amount: 50 })
})

test('neutres : commun payé du joint, perso payé de son perso', () => {
  const s = balance([expense(500, 'joint', 'common'), expense(80, 'lise', L), expense(40, 'clement', C)])
  assert.equal(s.isSettled, true)
  assert.equal(s.advances.reasons.length, 0)
})

test('revenus : un revenu commun encaissé en perso doit la moitié ; celui de l’autre, tout', () => {
  assert.deepEqual(owes(balance([income(300, 'clement', 'common')])), { debtor: C, creditor: L, amount: 150 })
  assert.deepEqual(owes(balance([income(70, 'lise', C)])), { debtor: L, creditor: C, amount: 70 })
})

// ─── Le piège du « remboursement au pot » ──────────────────────────────────

test('dépense perso sur le joint, puis remboursée au pot : plus rien à régler (pas de double comptage)', () => {
  // Clément paie 200 € de perso avec la carte du joint (400 A$), puis remet
  // 200 € au pot. Il ne doit plus rien : l'ancien flag « remboursement »
  // fabriquait ici un écart fantôme de 100 €.
  const s = balance([
    transfer(1000, 'clement', 'joint'),
    transfer(1000, 'lise', 'joint'),
    expense(400, 'joint', C),
    transfer(200, 'clement', 'joint'),
  ])
  assert.deepEqual(s.parts.advances, { [C]: -100, [L]: 100 })
  assert.deepEqual(s.parts.contributions, { [C]: 100, [L]: -100 })
  assert.equal(s.isSettled, true)
})

// ─── 3. Les règlements et le chiffre unique ────────────────────────────────

test('un seul chiffre : « Lise me doit 500 € et je dois 200 € au pot » se règle en UN virement', () => {
  const list = [
    expense(1000, 'clement', 'common'), // Lise doit 500
    transfer(1000, 'clement', 'joint'),
    transfer(1400, 'lise', 'joint'), // Lise a mis 400 de plus : Clément lui doit 200
  ]
  assert.deepEqual(owes(balance(list)), { debtor: L, creditor: C, amount: 300 })
  // Lise vire 300 € à Clément, de perso à perso : tout est soldé.
  const after = balance([...list, transfer(300, 'lise', 'clement')])
  assert.equal(after.isSettled, true)
  assert.deepEqual(after.parts.settlements, { [C]: -300, [L]: 300 })
})

test('un règlement trop généreux inverse la dette', () => {
  const s = balance([expense(100, 'clement', 'common'), transfer(80, 'lise', 'clement')])
  assert.deepEqual(owes(s), { debtor: C, creditor: L, amount: 30 })
})

test('règlement inter-devises : ce qui a été reçu fait foi', () => {
  // Lise envoie 200 A$, Clément reçoit 95 € (frais) : 95 € de dette effacés.
  const sent = getSettlements([transfer(200, 'lise', 'clement', { currency: 'AUD', amountReceived: 95 })], RATE, NOW)
  assert.deepEqual(sent.net, { [C]: -95, [L]: 95 })
})

test('un virement d’un compte à lui-même ou vers le joint n’est pas un règlement', () => {
  assert.equal(getSettlements([transfer(100, 'clement', 'joint'), transfer(50, 'joint', 'lise')], RATE, NOW).entries.length, 0)
})

// ─── Taux, dates, récurrences ──────────────────────────────────────────────

test('le taux figé sur la ligne l’emporte sur le taux des réglages', () => {
  // 300 A$ à 1,5 = 200 € → moitié 100 € ; au taux global (2) ce serait 75 €.
  assert.equal(balance([expense(300, 'joint', C, { rate: 1.5 })]).amount, 100)
  assert.equal(balance([expense(300, 'joint', C)]).amount, 75)
})

test('les récurrences comptent chaque échéance passée, pas les futures', () => {
  // Apport mensuel de 100 € depuis le 15 juin : juin, juillet, août, septembre = 4.
  const monthly = transfer(100, 'clement', 'joint', { recurrence: 'monthly', date: '2026-06-15' })
  assert.equal(getContributions([monthly], RATE, NOW).total[C], 400)
  // Une dépense datée de demain ne compte pas encore.
  assert.equal(balance([expense(100, 'clement', 'common', { date: '2026-10-09' })]).isSettled, true)
  // Une récurrence terminée s'arrête à sa date de fin.
  const ended = transfer(100, 'lise', 'joint', { recurrence: 'monthly', date: '2026-06-15', endDate: '2026-07-31' })
  assert.equal(getContributions([ended], RATE, NOW).total[L], 200)
})

test('une transaction désactivée ne compte nulle part', () => {
  const off = { isActive: false }
  assert.equal(balance([expense(100, 'clement', 'common', off), transfer(500, 'lise', 'joint', off), transfer(50, 'lise', 'clement', off)]).isSettled, true)
})

test('sous un centime, c’est de l’arrondi, pas une dette', () => {
  // 0,01 € commun : 0,005 € chacun, arrondi à 0,01 → réglé ou pas, jamais négatif.
  const s = balance([expense(0.01, 'clement', 'common')])
  assert.ok(s.amount >= 0 && s.amount <= 0.01)
  assert.equal(balance([]).isSettled, true)
  assert.equal(balance([]).debtorUid, null)
})

// ─── Invariant ─────────────────────────────────────────────────────────────

test('invariant : ce que l’un doit, l’autre le reçoit exactement (300 historiques aléatoires)', () => {
  let seed = 42
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const accounts = ['joint', 'clement', 'lise']
  const splits = ['common', C, L]
  for (let run = 0; run < 300; run++) {
    const list = Array.from({ length: 1 + Math.floor(rand() * 25) }, () => {
      const amount = Math.round(rand() * 200000) / 100
      const kind = pick(['expense', 'income', 'transfer'])
      const extra = {
        currency: pick(['EUR', 'AUD']),
        date: `2026-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
        recurrence: pick(['one-off', 'one-off', 'monthly', 'weekly']),
        ...(rand() < 0.3 ? { rate: 1.4 + rand() } : {}),
        ...(rand() < 0.2 ? { amountReceived: Math.round(rand() * 100000) / 100 } : {}),
      }
      if (kind === 'expense') return expense(amount, pick(accounts), pick(splits), extra)
      if (kind === 'income') return income(amount, pick(accounts), pick(splits), extra)
      const from = pick(accounts)
      return transfer(amount, from, pick(accounts.filter((a) => a !== from)), extra)
    })
    const s = balance(list)
    assert.equal(s.net[C] + s.net[L], 0, `déséquilibre ${s.net[C]} / ${s.net[L]}`)
    assert.equal(s.amount, Math.round(Math.abs(s.net[C]) * 100) / 100)
    if (!s.isSettled) {
      assert.notEqual(s.debtorUid, s.creditorUid)
      assert.ok(s.net[s.creditorUid] > 0 && s.net[s.debtorUid] < 0, 'le créancier est bien celui qu’on doit payer')
    }
    // Le détail de l'écran Équilibre, vu du côté de l'un ou de l'autre,
    // retombe au centime sur le solde affiché.
    for (const uid of [C, L]) {
      const sum = s.parts.contributions[uid] + s.parts.advances[uid] + s.parts.settlements[uid]
      assert.equal(Math.round(sum * 100), Math.round(s.net[uid] * 100), `détail ${sum} ≠ solde ${s.net[uid]}`)
    }
  }
})

test('les détails expliquent le chiffre : chaque avance a sa raison', () => {
  const a = getAdvances([expense(100, 'clement', 'common'), expense(200, 'joint', L)], RATE, NOW)
  assert.deepEqual(a.reasons.map((r) => [r.uid, r.amountEUR, r.label]).sort(), [
    [C, 50, 'a avancé une dépense commune'],
    [L, -50, 'a utilisé le compte joint pour du perso'],
  ].sort())
})
