// node --test src/apps/finauzi/utils/
//
// Les projections du compte joint : « il tient jusqu'à quand, et combien
// faut-il y remettre ? », calculées sur les vraies échéances.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAccountSeries, getMonthlyNetFlow, getRunway, getTopUpNeeded } from './forecast.js'

const RATE = 2
const NOW = new Date(2026, 9, 8) // 8 octobre 2026

let n = 0
const tx = (fields) => ({ id: `t${++n}`, recurrence: 'one-off', isActive: true, split: 'common', ...fields })
const rent = tx({ kind: 'expense', amount: 2400, currency: 'AUD', fromAccount: 'joint', recurrence: 'monthly', date: '2026-07-01' })
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

test('autonomie : la PREMIÈRE date sous le seuil et sous zéro, le vrai point le plus bas', () => {
  // 12 000 A$ au départ, 4 loyers déjà payés (juil. → oct.) : 2 400 A$ aujourd'hui.
  const r = getRunway([rent], 'joint', 12000, { buffer: 1000, rate: RATE, horizonMonths: 6, now: NOW })
  assert.equal(r.currentBalance, 2400)
  assert.equal(ymd(r.bufferDate), '2026-11-01', 'à 0 A$ le 1er novembre : sous le seuil de 1 000')
  assert.equal(r.daysToBuffer, 24)
  assert.equal(ymd(r.zeroDate), '2026-12-01', 'à 0 pile on n’est pas encore à découvert')
  assert.equal(r.monthlyNetFlow, -2400)
  assert.equal(r.isSustainable, false)
  // Le creux réel est au bout de l'horizon, pas au premier franchissement
  // (bug corrigé : l'écran affichait le premier passage sous zéro).
  assert.equal(r.lowest.balance, 2400 - 6 * 2400)
  assert.equal(r.balanceAtHorizon, r.lowest.balance)
})

test('autonomie : alimenté chaque mois autant qu’il dépense, le compte tient', () => {
  // Apport mensuel : 1 300 € partis, 2 400 A$ arrivés (montant reçu saisi).
  const topUp = tx({ kind: 'transfer', amount: 1300, currency: 'EUR', fromAccount: 'clement', toAccount: 'joint', amountReceived: 2400, recurrence: 'monthly', date: '2026-07-01' })
  const r = getRunway([rent, topUp], 'joint', 3000, { buffer: 1000, rate: RATE, horizonMonths: 12, now: NOW })
  assert.equal(r.monthlyNetFlow, 0)
  assert.equal(r.isSustainable, true)
  assert.equal(r.bufferDate, null)
  assert.equal(r.daysToZero, null)
})

test('loyer et apport le même jour : jugé en fin de journée, quel que soit l’ordre de saisie', () => {
  const topUp = tx({ kind: 'transfer', amount: 1300, currency: 'EUR', fromAccount: 'clement', toAccount: 'joint', amountReceived: 2400, recurrence: 'monthly', date: '2026-07-01' })
  for (const list of [[rent, topUp], [topUp, rent]]) {
    const runway = getRunway(list, 'joint', 3000, { buffer: 1000, rate: RATE, horizonMonths: 12, now: NOW })
    assert.equal(runway.bufferDate, null, 'pas de fausse alerte')
    assert.equal(runway.lowest.balance, 3000)
    assert.equal(getTopUpNeeded(list, 'joint', 3000, { buffer: 1000, rate: RATE, until: new Date(2027, 5, 30), now: NOW }).isNeeded, false)
  }
})

test('réappro : combien remettre pour tenir jusqu’à une date sans passer sous le seuil, et la part de chacun', () => {
  const r = getTopUpNeeded([rent], 'joint', 12000, { buffer: 1000, rate: RATE, until: new Date(2027, 0, 31), now: NOW })
  // Nov. : 0, déc. : −2 400, janv. : −4 800 → il manque 5 800 pour rester à 1 000.
  assert.equal(r.lowest, -4800)
  assert.equal(ymd(r.lowestDate), '2027-01-01')
  assert.equal(r.total, 5800)
  assert.equal(r.perPerson, 2900)
  assert.equal(r.isNeeded, true)
  const enough = getTopUpNeeded([rent], 'joint', 30000, { buffer: 1000, rate: RATE, until: new Date(2027, 0, 31), now: NOW })
  assert.equal(enough.total, 0)
  assert.equal(enough.isNeeded, false)
})

test('charge mensuelle : seulement ce qui revient, ramené au mois ; une récurrence finie ne compte plus', () => {
  const weekly = tx({ kind: 'expense', amount: 100, currency: 'AUD', fromAccount: 'joint', recurrence: 'weekly', date: '2026-01-05' })
  const ended = tx({ kind: 'expense', amount: 999, currency: 'AUD', fromAccount: 'joint', recurrence: 'monthly', date: '2026-01-01', endDate: '2026-09-30' })
  const oneOff = tx({ kind: 'expense', amount: 5000, currency: 'AUD', fromAccount: 'joint', date: '2026-11-01' })
  const flow = getMonthlyNetFlow([rent, weekly, ended, oneOff], 'joint', RATE, NOW)
  assert.ok(Math.abs(flow - (-2400 - (100 * 52) / 12)) < 1e-9, String(flow))
})

test('la courbe : part du solde exact, un point par jour de mouvement, va jusqu’au bout', () => {
  const groceries1 = tx({ kind: 'expense', amount: 100, currency: 'AUD', fromAccount: 'joint', date: '2026-10-15' })
  const groceries2 = tx({ kind: 'expense', amount: 50, currency: 'AUD', fromAccount: 'joint', date: '2026-10-15' })
  const series = buildAccountSeries([rent, groceries1, groceries2], 'joint', 12000, { from: new Date(2026, 9, 8), to: new Date(2026, 11, 31), rate: RATE, now: NOW })
  assert.deepEqual(series.map((p) => [ymd(p.date), p.balance]), [
    ['2026-10-08', 2400],
    ['2026-10-15', 2250], // deux courses le même jour : un seul point
    ['2026-11-01', -150],
    ['2026-12-01', -2550],
    ['2026-12-31', -2550],
  ])
  assert.deepEqual(series.map((p) => p.isFuture), [false, true, true, true, true])
})

test('la courbe allégée garde toujours son premier et son dernier point', () => {
  const daily = tx({ kind: 'expense', amount: 1, currency: 'AUD', fromAccount: 'joint', recurrence: 'weekly', date: '2020-01-01' })
  const full = buildAccountSeries([daily], 'joint', 0, { from: new Date(2024, 0, 1), to: new Date(2026, 0, 1), rate: RATE, now: NOW, maxPoints: 100000 })
  const light = buildAccountSeries([daily], 'joint', 0, { from: new Date(2024, 0, 1), to: new Date(2026, 0, 1), rate: RATE, now: NOW, maxPoints: 20 })
  assert.equal(light.length, 20)
  assert.deepEqual(light[0], full[0])
  assert.deepEqual(light.at(-1), full.at(-1))
})
