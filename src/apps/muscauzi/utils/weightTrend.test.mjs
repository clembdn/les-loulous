// node --test src/apps/muscauzi/utils/*.test.mjs
//
// La tendance du poids : moyenne glissante, rythme hebdomadaire, rappel.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daysBetween, daysSinceLastWeighIn, movingAverage, needsWeighIn, rateStatus, weeklyRate,
} from './weightTrend.js'

const w = (date, value) => ({ date, value })

test('écart en jours entre deux clés locales', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-05'), 4)
  assert.equal(daysBetween('2026-09-28', '2026-10-05'), 7, 'à cheval sur deux mois')
  assert.equal(daysBetween('2026-10-05', '2026-10-05'), 0)
})

test('moyenne glissante sur 7 jours CALENDAIRES, pas sur 7 pesées', () => {
  const avg = movingAverage([
    w('2026-10-01', 70), w('2026-10-03', 71), w('2026-10-07', 72), w('2026-10-08', 73),
  ])
  assert.deepEqual(avg.map((a) => a.average), [70, 70.5, 71, 72])
  // Le 8 : le 1er sort de la fenêtre (8 − 6 = 2), le 3 y reste.
  assert.deepEqual(movingAverage([]), [])
})

test('rythme : la pente des pesées, en kg par semaine', () => {
  // Quatorze pesées quotidiennes à +0,05 kg par jour = +0,35 kg par semaine.
  const steady = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(2026, 8, 22 + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return w(key, 70 + 0.05 * i)
  })
  assert.equal(steady[13].date, '2026-10-05')
  assert.equal(weeklyRate(steady, '2026-10-05').rate, 0.35)
})

test('rythme : une pesée haute isolée ne fait pas le rythme', () => {
  const noisy = [w('2026-09-22', 70), w('2026-09-26', 70.2), w('2026-09-30', 71.5), w('2026-10-05', 70.4)]
  const r = weeklyRate(noisy, '2026-10-05')
  // « Dernière moins première » dirait +0,22/sem ; la droite tient compte du pic.
  assert.ok(r.rate > 0 && r.rate < 1, `rythme ${r.rate}`)
  assert.equal(r.count, 4)
})

test('rythme : pas assez de pesées, ou trop resserrées → null', () => {
  assert.equal(weeklyRate([w('2026-10-01', 70), w('2026-10-05', 70.5)], '2026-10-05'), null, 'deux pesées')
  assert.equal(weeklyRate([w('2026-10-02', 70), w('2026-10-03', 70.1), w('2026-10-05', 70.2)], '2026-10-05'), null, 'moins d\'une semaine')
  // Les pesées de plus de 14 jours ne comptent pas.
  assert.equal(weeklyRate([w('2026-09-01', 60), w('2026-09-10', 61), w('2026-10-05', 70)], '2026-10-05'), null)
})

test('rythme face à la cible', () => {
  const target = { min: 0.3, max: 0.4 }
  assert.equal(rateStatus(0.2, target), 'below')
  assert.equal(rateStatus(0.3, target), 'within')
  assert.equal(rateStatus(0.4, target), 'within')
  assert.equal(rateStatus(0.55, target), 'above')
  assert.equal(rateStatus(null, target), null)
  assert.equal(rateStatus(0.3, null), null)
})

test('rappel de pesée au bout de trois jours, jamais pour un profil neuf', () => {
  const weights = [w('2026-10-01', 70)]
  assert.equal(daysSinceLastWeighIn(weights, '2026-10-05'), 4)
  assert.equal(needsWeighIn(weights, '2026-10-03'), false, 'deux jours')
  assert.equal(needsWeighIn(weights, '2026-10-04'), true, 'trois jours')
  assert.equal(needsWeighIn([], '2026-10-05'), false)
})
