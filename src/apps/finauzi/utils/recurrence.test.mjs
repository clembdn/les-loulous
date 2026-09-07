// node --test src/apps/finauzi/utils/
//
// Les échéances réelles d'une récurrence. L'invariant qui compte : une
// récurrence hebdomadaire tombe TOUJOURS le même jour de la semaine, y compris
// de part et d'autre d'un changement d'heure.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getOccurrences, getMonthlyEquivalent } from './recurrence.js'

// Le quantième LOCAL. `toISOString()` repasserait par UTC et décalerait d'un
// jour tout ce que ce fichier cherche justement à vérifier.
const dayOfMonth = (list) => list.map((d) => String(d.getDate()))

// ── Le bug qui a motivé ce fichier ──────────────────────────────────────────
//
// L'arithmétique en millisecondes faisait retomber la date sur le jour d'avant
// après le retour à l'heure d'hiver. Ancrée dimanche 8 mars 2026, la série
// devenait samedi du 11 avril au 3 octobre à Sydney — la moitié de l'année.
//
// Le test ne force pas le fuseau : il vérifie l'invariant dans CELUI où il
// tourne. En UTC il passe déjà ; à Sydney ou Paris il échouait.

test('une récurrence hebdo garde son jour de semaine sur une année entière', () => {
  const tx = { date: '2026-03-08', recurrence: 'weekly' }
  const occurrences = getOccurrences(tx, '2026-03-08', '2026-12-31')

  assert.ok(occurrences.length >= 40, 'une année doit produire ~43 échéances')
  const anchor = occurrences[0].getDay()
  for (const date of occurrences) {
    assert.equal(date.getDay(), anchor, `${date.toDateString()} a changé de jour de semaine`)
  }
})

test('une quinzaine garde un pas de 14 jours de part et d\'autre du changement d\'heure', () => {
  const tx = { date: '2026-03-01', recurrence: 'fortnightly' }
  const occurrences = getOccurrences(tx, '2026-01-01', '2026-07-01')

  assert.ok(occurrences.length >= 8)
  for (let i = 1; i < occurrences.length; i += 1) {
    const gap = Math.round((occurrences[i] - occurrences[i - 1]) / 86400000)
    assert.equal(gap, 14, `écart de ${gap} jours entre deux quinzaines`)
  }
})

// Le saut direct à la première échéance de la fenêtre ne doit ni sauter une
// échéance ni en fabriquer une avant la borne gauche.
test('une fenêtre tardive ne perd ni ne duplique d\'échéance', () => {
  const tx = { date: '2020-01-01', recurrence: 'weekly' }
  const occurrences = getOccurrences(tx, '2026-06-10', '2026-07-05')

  assert.ok(occurrences.length > 0)
  assert.ok(occurrences[0] >= new Date(2026, 5, 10), 'rien avant la borne gauche')
  assert.ok(occurrences[occurrences.length - 1] <= new Date(2026, 6, 5), 'rien après la borne droite')
  for (let i = 1; i < occurrences.length; i += 1) {
    assert.equal(Math.round((occurrences[i] - occurrences[i - 1]) / 86400000), 7)
  }
  const anchor = occurrences[0].getDay()
  for (const date of occurrences) assert.equal(date.getDay(), anchor)
})

// ── Le mensuel, qui n'a jamais eu le problème ───────────────────────────────

test('le mensuel garde le quantième, en le rabotant sur les mois courts', () => {
  const tx = { date: '2026-01-31', recurrence: 'monthly' }
  const occurrences = getOccurrences(tx, '2026-01-01', '2026-04-30')

  assert.deepEqual(dayOfMonth(occurrences), ['31', '28', '31', '30'])
})

test('une ponctuelle ne tombe que dans sa fenêtre', () => {
  const tx = { date: '2026-05-10', recurrence: 'one-off' }

  assert.equal(getOccurrences(tx, '2026-05-01', '2026-05-31').length, 1)
  assert.equal(getOccurrences(tx, '2026-06-01', '2026-06-30').length, 0)
})

test('une date de fin borne la série', () => {
  const tx = { date: '2026-03-01', recurrence: 'weekly', endDate: '2026-03-20' }
  const occurrences = getOccurrences(tx, '2026-01-01', '2026-12-31')

  assert.equal(occurrences.length, 3)
  assert.ok(occurrences[occurrences.length - 1] <= new Date(2026, 2, 20))
})

test('une transaction inactive ne produit aucune échéance', () => {
  const tx = { date: '2026-03-01', recurrence: 'weekly', isActive: false }
  assert.deepEqual(getOccurrences(tx, '2026-01-01', '2026-12-31'), [])
})

test('l\'équivalent mensuel ramène les fréquences à la même échelle', () => {
  assert.equal(getMonthlyEquivalent({ amount: 700, recurrence: 'weekly' }), (700 * 52) / 12)
  assert.equal(getMonthlyEquivalent({ amount: 1400, recurrence: 'fortnightly' }), (1400 * 26) / 12)
  assert.equal(getMonthlyEquivalent({ amount: 900, recurrence: 'monthly' }), 900)
  // Une ponctuelle n'a pas de charge mensuelle : elle ne se produit qu'une fois.
  assert.equal(getMonthlyEquivalent({ amount: 900, recurrence: 'one-off' }), 0)
})
