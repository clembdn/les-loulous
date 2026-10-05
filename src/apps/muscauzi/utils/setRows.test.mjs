// node --test src/apps/muscauzi/utils/*.test.mjs
//
// Le brouillon de saisie. Deux invariants : l'écran garde toujours au moins N
// séries de travail, et rien ne s'enregistre sans avoir été saisi.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addSet, addWarmup, buildRows, clearRow, fillRow, rowLabels, setField, toSets, toggleWarmup,
} from './setRows.js'

const stored = (rank, weightKg, reps, extra = {}) => ({ rank, weightKg, reps, ...extra })

test('ouverture : N lignes vides, rien d\'enregistré', () => {
  const rows = buildRows({ prescribedSets: 4, entry: null })
  assert.equal(rows.length, 4)
  assert.ok(rows.every((r) => r.weightKg === '' && r.reps === ''))
  assert.deepEqual(toSets(rows), [], 'aucune série fantôme')
})

test('une série saisie s\'enregistre, une charge seule aussi', () => {
  let rows = buildRows({ prescribedSets: 3, entry: null })
  rows = setField(rows, 0, 'weightKg', '62,5')
  rows = setField(rows, 0, 'reps', '8')
  rows = setField(rows, 1, 'weightKg', '22,5')
  assert.deepEqual(toSets(rows), [
    { rank: 0, weightKg: 62.5, reps: 8 },
    { rank: 1, weightKg: 22.5, reps: 0 },
  ])
})

test('relecture : séries à leur rang, trous conservés, échauffement relu', () => {
  const entry = { sets: [stored(0, 10, 12, { warmup: true }), stored(1, 18, 8), stored(3, 18, 7)] }
  const rows = buildRows({ prescribedSets: 4, entry })
  assert.deepEqual(rowLabels(rows, 4).map((l) => l.number), [null, 1, 2, 3, 4])
  assert.equal(rows[0].warmup, true)
  assert.equal(rows[2].reps, '', 'le trou reste vide')
  assert.deepEqual(toSets(rows).map((s) => s.rank), [0, 1, 3])
})

test('un échauffement laissé vide ne revient pas en série fantôme', () => {
  // Échauffement ajouté en tête puis laissé vide : les séries ont glissé au rang 1..4.
  const entry = { sets: [1, 2, 3, 4].map((rank) => stored(rank, 18, 8)) }
  const rows = buildRows({ prescribedSets: 4, entry })
  assert.equal(rows.length, 4)
  assert.deepEqual(rowLabels(rows, 4).map((l) => l.extra), [false, false, false, false])
})

test('basculer en échauffement garde N séries de travail, et revenir les retire', () => {
  let rows = buildRows({ prescribedSets: 3, entry: null })
  rows = fillRow(rows, 0, { weightKg: 10, reps: 12 })
  rows = toggleWarmup(rows, 0, { prescribedSets: 3 })
  assert.equal(rows.length, 4, 'une série de travail ajoutée pour compenser')
  assert.deepEqual(rowLabels(rows, 3).map((l) => l.number), [null, 1, 2, 3])
  assert.deepEqual(toSets(rows), [{ rank: 0, weightKg: 10, reps: 12, warmup: true }])

  rows = toggleWarmup(rows, 0, { prescribedSets: 3 })
  assert.equal(rows.length, 3, 'la ligne vide ajoutée repart')
})

test('un échauffement s\'ajoute en tête, sans décaler la numérotation', () => {
  const rows = addWarmup(buildRows({ prescribedSets: 3, entry: null }))
  assert.equal(rows[0].warmup, true)
  assert.deepEqual(rowLabels(rows, 3).map((l) => l.number), [null, 1, 2, 3])
})

test('valider puis annuler une série', () => {
  let rows = buildRows({ prescribedSets: 2, entry: null })
  rows = fillRow(rows, 0, { weightKg: 20, reps: 7 })
  assert.deepEqual(toSets(rows), [{ rank: 0, weightKg: 20, reps: 7 }])
  rows = clearRow(rows, 0)
  assert.deepEqual(toSets(rows), [])
})

test('une série en plus est numérotée et marquée « en plus »', () => {
  const rows = addSet(buildRows({ prescribedSets: 2, entry: null }))
  assert.deepEqual(rowLabels(rows, 2).map((l) => [l.number, l.extra]), [[1, false], [2, false], [3, true]])
})
