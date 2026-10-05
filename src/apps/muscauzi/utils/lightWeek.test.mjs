// node --test src/apps/muscauzi/utils/*.test.mjs
//
// La semaine allégée : sa fenêtre de 7 jours, et une série de moins (minimum 2).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInLightWeek, lightSets, lightWeekEnd } from './lightWeek.js'

test('sept jours à partir du jour de lancement, bornes comprises', () => {
  assert.equal(lightWeekEnd('2026-10-05'), '2026-10-11')
  assert.equal(lightWeekEnd('2026-09-28'), '2026-10-04', 'à cheval sur deux mois')
  assert.equal(isInLightWeek('2026-10-05', '2026-10-05'), true, 'le jour même')
  assert.equal(isInLightWeek('2026-10-11', '2026-10-05'), true, 'le septième jour')
  assert.equal(isInLightWeek('2026-10-12', '2026-10-05'), false, 'le huitième')
  assert.equal(isInLightWeek('2026-10-04', '2026-10-05'), false, 'la veille')
  assert.equal(isInLightWeek('2026-10-05', null), false, 'pas de semaine allégée')
})

test('une série de moins, jamais sous deux, jamais plus qu\'avant', () => {
  assert.equal(lightSets(4), 3)
  assert.equal(lightSets(3), 2)
  assert.equal(lightSets(2), 2)
  assert.equal(lightSets(1), 1)
  assert.equal(lightSets(undefined), 1)
})
