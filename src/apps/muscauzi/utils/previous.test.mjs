// node --test src/apps/muscauzi/utils/
//
// Le repère « dernière fois ». Le seul invariant qui compte : il ne doit JAMAIS
// contenir la séance du jour — c'était le bug qui vidait le repère dès la
// deuxième série.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPreviousIndex, previousSetAt } from './previous.js'

const set = (weightKg, reps) => ({ weightKg, reps })

function session(date, entries) {
  return { date, entries }
}

// Un développé couché, trois séances : le 1er, le 8 et le 15.
const HISTORY = [
  session('2026-08-01', {
    i1: { exerciseId: 'dc', order: 0, sets: [set(55, 8), set(55, 8)] },
  }),
  session('2026-08-08', {
    i1: { exerciseId: 'dc', order: 0, sets: [set(60, 8), set(60, 7)] },
  }),
  session('2026-08-15', {
    i1: { exerciseId: 'dc', order: 0, sets: [set(62.5, 6)] },
  }),
]

test('la séance du jour est exclue', () => {
  const index = buildPreviousIndex(HISTORY, '2026-08-15')
  assert.equal(index.dc.date, '2026-08-08')
  assert.deepEqual(index.dc.sets, [set(60, 8), set(60, 7)])
})

test('tout ce qui suit la date affichée est exclu aussi (rattrapage)', () => {
  const index = buildPreviousIndex(HISTORY, '2026-08-08')
  assert.equal(index.dc.date, '2026-08-01')
})

test('sans rien avant, il n’y a pas de repère', () => {
  assert.deepEqual(buildPreviousIndex(HISTORY, '2026-08-01'), {})
  assert.deepEqual(buildPreviousIndex([], '2026-08-15'), {})
})

test('une série sans répétitions ne compte pas', () => {
  const index = buildPreviousIndex([
    session('2026-08-01', { i1: { exerciseId: 'dc', order: 0, sets: [set(60, 0), set(60, 8)] } }),
  ], '2026-08-15')
  assert.deepEqual(index.dc.sets, [set(60, 8)])
})

test('un exercice « non fait » ne laisse pas de repère', () => {
  const index = buildPreviousIndex([
    session('2026-08-01', { i1: { exerciseId: 'dc', order: 0, skipped: true, sets: [set(60, 8)] } }),
  ], '2026-08-15')
  assert.deepEqual(index, {})
})

test('deux passages le même jour se mettent bout à bout, dans l’ordre', () => {
  const index = buildPreviousIndex([
    session('2026-08-01', {
      b: { exerciseId: 'dc', order: 5, sets: [set(50, 12)] },
      a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] },
    }),
  ], '2026-08-15')
  assert.equal(index.dc.date, '2026-08-01')
  assert.deepEqual(index.dc.sets, [set(60, 8), set(50, 12)])
})

test('l’index suit le MOUVEMENT, pas l’occurrence de programme', () => {
  // Même exercice, instanceId différent d'une semaine à l'autre : le programme
  // a été réécrit entre-temps. L'historique ne doit pas se couper.
  const index = buildPreviousIndex([
    session('2026-08-01', { vieux: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
  ], '2026-08-15')
  assert.deepEqual(index.dc.sets, [set(60, 8)])
})

test('chaque exercice a son propre repère', () => {
  const index = buildPreviousIndex([
    session('2026-08-01', {
      a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] },
      b: { exerciseId: 'sq', order: 1, sets: [set(100, 5)] },
    }),
  ], '2026-08-15')
  assert.deepEqual(index.dc.sets, [set(60, 8)])
  assert.deepEqual(index.sq.sets, [set(100, 5)])
})

test('au-delà des séries connues, on reprend la dernière', () => {
  const previous = { date: '2026-08-08', sets: [set(60, 8), set(60, 7)] }
  assert.deepEqual(previousSetAt(previous, 0), set(60, 8))
  assert.deepEqual(previousSetAt(previous, 1), set(60, 7))
  assert.deepEqual(previousSetAt(previous, 4), set(60, 7))
  assert.equal(previousSetAt(null, 0), null)
  assert.equal(previousSetAt({ sets: [] }, 0), null)
})
