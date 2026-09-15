// node --test src/apps/muscauzi/utils/
//
// Le record ne doit jamais se battre lui-même : c'était exactement le piège du
// rappel « dernière fois », et il se reproduirait ici sans l'exclusion du jour.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRecordIndex, buildBestIndex, beatsRecord } from './records.js'

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

// ── Le meilleur PASSAGE, l'autre record ─────────────────────────────────────
//
// C'est celui qui manquait : une séance où l'on fait plus de séries et plus de
// répétitions que jamais, sans dépasser son top set, poussait la courbe à son
// sommet sans qu'aucun badge ne le dise.

// Volume : la mesure que trace la courbe d'un exercice chargé.
const volumeOf = (sets) => sets.reduce((acc, s) => acc + s.weightKg * s.reps, 0)

test('le meilleur passage se juge sur le total de la journée, pas sur une série', () => {
  const index = buildBestIndex([
    session('2026-08-01', { a: { exerciseId: 'dc', order: 0, sets: [set(80, 5)] } }),           // 400
    session('2026-08-08', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8), set(60, 8)] } }), // 960
  ], null, volumeOf)
  assert.equal(index.dc.score, 960)
  assert.equal(index.dc.date, '2026-08-08')
})

test('les passages multiples d’un même jour sont mis bout à bout', () => {
  const index = buildBestIndex([
    session('2026-08-01', {
      a: { exerciseId: 'dc', order: 0, sets: [set(60, 5)] },
      b: { exerciseId: 'dc', order: 3, sets: [set(60, 5)] },
    }),
  ], null, volumeOf)
  assert.equal(index.dc.score, 600)
})

test('la séance en cours est écartée du meilleur passage aussi', () => {
  // Sans exclusion, le 15/08 (80 × 10 = 800) ne serait de toute façon pas le
  // meilleur : c'est le 01/08 (55 × 8 deux fois = 880) qui l'emporte au volume,
  // alors qu'il porte la série la PLUS LÉGÈRE de l'historique. Les deux records
  // ne désignent pas le même jour — c'est bien qu'ils répondent à deux
  // questions.
  const index = buildBestIndex(HISTORY, '2026-08-15', volumeOf)
  assert.equal(index.dc.date, '2026-08-01')
  assert.equal(index.dc.score, 880)
})

test('le meilleur passage et la meilleure série ne tombent pas le même jour', () => {
  // C'est TOUT le sujet : le 15/08 porte la série la plus lourde (80 × 10),
  // le 01/08 le plus gros volume (880 contre 800). Un seul badge, celui de la
  // série, laissait donc le sommet de la courbe sans rien dire.
  assert.equal(buildRecordIndex(HISTORY, null, scoreOf).dc.date, '2026-08-15')
  assert.equal(buildBestIndex(HISTORY, null, volumeOf).dc.date, '2026-08-01')
})

test('un « non fait » ne fait pas le meilleur passage', () => {
  const index = buildBestIndex([
    session('2026-08-01', { a: { exerciseId: 'dc', order: 0, skipped: true, sets: [set(300, 5)] } }),
    session('2026-08-08', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
  ], null, volumeOf)
  assert.equal(index.dc.date, '2026-08-08')
})

test('à égalité, le plus ancien passage garde le record', () => {
  const index = buildBestIndex([
    session('2026-08-01', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
    session('2026-08-08', { a: { exerciseId: 'dc', order: 0, sets: [set(60, 8)] } }),
  ], null, volumeOf)
  assert.equal(index.dc.date, '2026-08-01')
})
