// node --test src/apps/muscauzi/utils/*.test.mjs
//
// Les fourchettes de reps, et la relecture des documents écrits avant qu'elles
// n'existent.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  entryRange, formatPrescription, formatRepRange, normalizeRange, programRangeIndex,
} from './repRange.js'

test('affichage', () => {
  assert.equal(formatRepRange({ min: 6, max: 10 }), '6–10')
  assert.equal(formatRepRange({ min: 8, max: 8 }), '8')
  assert.equal(formatPrescription(4, { min: 6, max: 10 }), '4 × 6–10')
})

test('document ancien sans repli : min = max = l\'ancien nombre fixe', () => {
  assert.deepEqual(normalizeRange(undefined, undefined, 8), { min: 8, max: 8 })
  assert.deepEqual(entryRange({ prescribedReps: 12 }), { min: 12, max: 12 })
  // Rien du tout : plancher à 1, jamais 0.
  assert.deepEqual(normalizeRange(undefined, undefined, undefined), { min: 1, max: 1 })
  // Bornes inversées dans un document : relues dans l'ordre.
  assert.deepEqual(normalizeRange(10, 6, 6), { min: 6, max: 10 })
})

test('la fourchette figée dans l\'entrée l\'emporte sur le programme actuel', () => {
  const entry = { prescribedReps: 10, prescribedRepsMin: 6, prescribedRepsMax: 10 }
  assert.deepEqual(entryRange(entry, { min: 8, max: 12 }), { min: 6, max: 10 })
})

test('une entrée ancienne prend la fourchette du programme actuel', () => {
  // Normalisée par sessionsService : bornes nulles, nombre fixe conservé.
  const legacy = { prescribedReps: 10, prescribedRepsMin: null, prescribedRepsMax: null }
  assert.deepEqual(entryRange(legacy, { min: 6, max: 10 }), { min: 6, max: 10 })
  assert.deepEqual(entryRange(legacy, undefined), { min: 10, max: 10 }, 'sans repli : le nombre fixe')
})

test('fourchettes du programme : la semaine en cours d\'abord, première occurrence', () => {
  const line = (exerciseId, repsMin, repsMax) => ({ exerciseId, repsMin, repsMax, reps: repsMax })
  const programs = {
    even: { days: { 1: [line('dc', 6, 10)], 4: [line('dc', 8, 12), line('sq', 10, 15)] } },
    odd: { days: { 1: [line('dc', 4, 6), line('tr', 6, 8)] } },
  }
  assert.deepEqual(programRangeIndex(programs, 'even'), {
    dc: { min: 6, max: 10 }, sq: { min: 10, max: 15 }, tr: { min: 6, max: 8 },
  })
  assert.deepEqual(programRangeIndex(programs, 'odd').dc, { min: 4, max: 6 })
  assert.deepEqual(programRangeIndex(null), {})
})
