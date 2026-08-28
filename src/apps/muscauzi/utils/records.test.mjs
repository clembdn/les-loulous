// node --test src/apps/muscauzi/utils/
//
// Le record ne doit jamais se battre lui-même : c'était exactement le piège du
// rappel « dernière fois », et il se reproduirait ici sans l'exclusion du jour.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRecordIndex, beatsRecord } from './records.js'

const set = (weightKg, reps) => ({ weightKg, reps })
// Score de substitution : la charge suffit pour les cas testés ici.
const scoreOf = (s) => s.weightKg * s.reps

const session = (date, entries) => ({ date, entries })

const HISTORY = [
  session('2026-08-01', { a: { exerciseId: 'dc', order: 0, sets: [set(55, 8), set(55, 8)] } }),
  session('2026-08-08', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8), set(60, 6)] } }),
  session('2026-08-15', { a: { exerciseId: 'dc', order: 0, sets: [set(80, 10)] } }),
]

test('le record est la meilleure série de tout l’historique', () => {
  const index = buildRecordIndex(HISTORY, null, scoreOf)
  assert.deepEqual(index.dc.set, set(80, 10))
  assert.equal(index.dc.date, '2026-08-15')
})

test('la séance en cours est écartée — le record ne se bat pas lui-même', () => {
  const index = buildRecordIndex(HISTORY, '2026-08-15', scoreOf)
  assert.deepEqual(index.dc.set, set(60, 8))
  assert.equal(index.dc.date, '2026-08-08')
})

test('à égalité, la plus ancienne reste le record', () => {
  const index = buildRecordIndex([
    session('2026-08-01', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
    session('2026-08-08', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
  ], null, scoreOf)
  assert.equal(index.dc.date, '2026-08-01')
})

test('une série sans répétitions ou « non fait » ne fait pas record', () => {
  const index = buildRecordIndex([
    session('2026-08-01', { a: { exerciseId: 'dc', order: 0, sets: [set(200, 0)] } }),
    session('2026-08-08', { a: { exerciseId: 'dc', order: 0, skipped: true, sets: [set(300, 5)] } }),
    session('2026-08-09', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
  ], null, scoreOf)
  assert.deepEqual(index.dc.set, set(60, 8))
})

test('chaque mouvement a son propre record', () => {
  const index = buildRecordIndex([
    session('2026-08-01', {
      a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] },
      b: { exerciseId: 'sq', order: 1, sets: [set(100, 5)] },
    }),
  ], null, scoreOf)
  assert.equal(index.dc.score, 480)
  assert.equal(index.sq.score, 500)
})

test('sans record établi, rien n’est annoncé', () => {
  assert.equal(beatsRecord(1000, null), false)
  assert.equal(beatsRecord(1000, { score: 0 }), false)
})

test('battre le record demande de faire STRICTEMENT mieux', () => {
  assert.equal(beatsRecord(481, { score: 480 }), true)
  assert.equal(beatsRecord(480, { score: 480 }), false)
  assert.equal(beatsRecord(479, { score: 480 }), false)
})
