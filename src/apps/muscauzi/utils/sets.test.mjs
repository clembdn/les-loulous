// node --test src/apps/muscauzi/utils/
//
// Ce qu'une série et une séance veulent dire. `isEntryComplete` était
// documentée ici mais appelée par personne : cinq écrans recopiaient sa règle.
// Ce fichier existe pour que la règle partagée soit vérifiée, pas seulement
// partagée.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doneSets, hasWork, isEntryComplete, hasCompletedWork, sessionLineup } from './sets.js'

const set = (weightKg, reps) => ({ weightKg, reps })
const entry = (sets, extra = {}) => ({ sets, skipped: false, prescribedSets: 4, ...extra })

test('une série ne compte que si elle porte des répétitions', () => {
  // Un 0 stocké veut dire « rien saisi », jamais « zéro rep validée ».
  assert.equal(doneSets(entry([set(60, 8), set(60, 0), set(0, 0)])).length, 1)
  assert.deepEqual(doneSets(null), [])
  // Un exercice passé ne compte aucune série, même s'il en porte.
  assert.deepEqual(doneSets(entry([set(60, 8)], { skipped: true })), [])
})

test('la prescription VIVANTE l\'emporte sur celle figée dans l\'entrée', () => {
  // L'entrée a été saisie sous 4×8 ; le programme est passé à 5×8 depuis.
  const saved = entry([set(60, 8), set(60, 8), set(60, 8), set(60, 8)], { prescribedSets: 4 })

  assert.equal(isEntryComplete(saved, 4), true, 'quatre séries sur quatre prescrites')
  assert.equal(isEntryComplete(saved, 5), false, 'quatre séries sur cinq prescrites')
  // Sans prescription vivante, on retombe sur celle figée.
  assert.equal(isEntryComplete(saved, undefined), true)
})

test('un exercice passé est bouclé, une entrée absente ne l\'est pas', () => {
  assert.equal(isEntryComplete(entry([], { skipped: true }), 4), true)
  assert.equal(isEntryComplete(null, 4), false)
  assert.equal(isEntryComplete(undefined, 4), false)
})

test('une prescription illisible retombe sur celle figée, puis sur 1', () => {
  const empty = entry([])
  for (const prescribed of [0, -3, NaN, null, 'x']) {
    assert.equal(isEntryComplete(empty, prescribed), false, `prescrit = ${prescribed}`)
  }

  // Une prescription vivante inutilisable n'ouvre pas la porte : on retombe sur
  // celle que l'entrée a figée (4 ici), pas sur un plancher de 1 qui déclarerait
  // « terminé » dès la première série.
  const oneSet = entry([set(60, 8)], { prescribedSets: 4 })
  assert.equal(isEntryComplete(oneSet, 0), false)

  // Et quand l'entrée n'en porte pas non plus, le plancher est 1 — jamais 0,
  // sinon tout serait terminé d'avance.
  assert.equal(isEntryComplete({ sets: [set(60, 8)], skipped: false }, 0), true)
  assert.equal(isEntryComplete({ sets: [], skipped: false }, 0), false)
})

test('« porte du travail » inclut le non-fait, « a du travail abouti » non', () => {
  assert.equal(hasWork(entry([set(60, 8)])), true)
  assert.equal(hasWork(entry([], { skipped: true })), true, 'un « non fait » assumé compte')
  assert.equal(hasWork(entry([])), false)
  assert.equal(hasWork(null), false)

  assert.equal(hasCompletedWork({ entries: { a: entry([set(60, 8)]) } }), true)
  assert.equal(hasCompletedWork({ entries: { a: entry([], { skipped: true }) } }), false)
  assert.equal(hasCompletedWork({ entries: {} }), false)
  assert.equal(hasCompletedWork(null), false)
})

test('les entrées se relisent dans l\'ordre où elles ont été faites', () => {
  const session = {
    entries: {
      c: { instanceId: 'c', order: 2 },
      a: { instanceId: 'a', order: 0 },
      b: { instanceId: 'b', order: 1 },
    },
  }
  assert.deepEqual(sessionLineup(session).map((e) => e.instanceId), ['a', 'b', 'c'])
  assert.deepEqual(sessionLineup(null), [])
})
