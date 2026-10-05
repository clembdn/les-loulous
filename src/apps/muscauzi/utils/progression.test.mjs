// node --test src/apps/muscauzi/utils/*.test.mjs
//
// La barre d'XP. Les cinq premiers tests sont les exemples de la spec, chiffre
// pour chiffre : si l'un d'eux casse, c'est la règle qui a changé, pas un détail.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPassageIndex, buildProgressIndex, exerciseProgress, jumpedEarly, passageXp,
  reachedLoad, roundKg, workingLoad,
} from './progression.js'

const set = (weightKg, reps, extra = {}) => ({ weightKg, reps, ...extra })
const passage = (date, sets, { n = 4, min = 6, max = 10 } = {}) => ({
  date, sets, prescribedSets: n, range: { min, max },
})
const pct = (xp) => Math.round(xp * 100)

// Une séance normalisée, une seule entrée pour l'exercice `ex`.
function session(date, sets, { n = 4, min = 6, max = 10, exerciseId = 'ex', order = 0 } = {}) {
  return {
    date,
    entries: {
      [`i-${date}-${order}`]: {
        exerciseId, order, prescribedSets: n, prescribedRepsMin: min, prescribedRepsMax: max,
        prescribedReps: max, skipped: false,
        sets: sets.map((s, rank) => ({ rank, ...s })),
      },
    },
  }
}

// ── Les exemples de la spec ─────────────────────────────────────────────────

test('6-10 · 4 séries · 18 kg × 8/7/7/6 → 25 %', () => {
  const r = passageXp(passage('d', [set(18, 8), set(18, 7), set(18, 7), set(18, 6)]))
  assert.equal(r.load, 18)
  assert.equal(r.xp, 4 / 16)
  assert.equal(pct(r.xp), 25)
  assert.deepEqual(r.done, [8, 7, 7, 6])
})

test('6-10 · 4 séries · 18 kg × 10/10/10/10 → 100 %, passe à 20 kg', () => {
  const p = passage('d', [set(18, 10), set(18, 10), set(18, 10), set(18, 10)])
  assert.equal(passageXp(p).xp, 1)
  const progress = exerciseProgress([p], { incrementKg: 2 })
  assert.deepEqual(progress.suggestion, { kind: 'levelUp', load: 20 })
})

test('8-12 · 3 séries · 16 kg × 10/12/12 → 83 %, reste à 16 kg', () => {
  const p = passage('d', [set(16, 10), set(16, 12), set(16, 12)], { n: 3, min: 8, max: 12 })
  assert.equal(passageXp(p).xp, 10 / 12)
  assert.equal(pct(passageXp(p).xp), 83)
  assert.deepEqual(exerciseProgress([p], { incrementKg: 2 }).suggestion, { kind: 'stay', load: 16 })
})

test('6-8 · 3 séries · 25 kg × 7/6/5 puis 30 kg × 2 → charge 25 kg, 17 %', () => {
  const r = passageXp(passage('d', [set(25, 7), set(25, 6), set(25, 5), set(30, 2)], { n: 3, min: 6, max: 8 }))
  assert.equal(r.load, 25)
  assert.equal(r.xp, 1 / 6)
  assert.equal(pct(r.xp), 17)
})

test('tractions · 6-8 · 4 séries · 7/2 au poids du corps → 28 %', () => {
  const r = passageXp(passage('d', [set(0, 7), set(0, 2)], { n: 4, min: 6, max: 8 }), { bodyweight: true })
  assert.equal(r.xp, 9 / 32)
  assert.equal(pct(r.xp), 28)
})

// ── Charge de travail ───────────────────────────────────────────────────────

test('charge de travail : la plus fréquente, la plus lourde à égalité', () => {
  assert.equal(workingLoad([set(20, 8), set(20, 8), set(22, 6)]), 20)
  assert.equal(workingLoad([set(20, 8), set(22, 6)]), 22, 'égalité → la plus lourde')
  assert.equal(workingLoad([set(20, 0)]), null, 'une série sans reps ne compte pas')
  assert.equal(workingLoad([]), null)
})

test('une série manquante compte 0', () => {
  const r = passageXp(passage('d', [set(18, 10), set(18, 10)]))
  assert.deepEqual(r.reps, [10, 10, 0, 0])
  assert.equal(r.xp, 8 / 16)
})

test('nombre fixe (min = max) : la part des séries qui l\'atteignent', () => {
  const r = passageXp(passage('d', [set(60, 5), set(60, 5), set(60, 4)], { n: 3, min: 5, max: 5 }))
  assert.equal(r.xp, 2 / 3)
})

test('au-delà de N séries, les suivantes n\'entrent pas dans la barre', () => {
  // Une cinquième série ne remplit pas la barre de quatre — y compris au poids du corps.
  const loaded = passageXp(passage('d', [set(18, 10), set(18, 10), set(18, 10), set(18, 6), set(18, 10)]))
  assert.equal(loaded.xp, 12 / 16)
  const bw = passageXp(
    passage('d', [set(0, 8), set(0, 8), set(0, 8), set(0, 6), set(0, 4)], { n: 4, min: 6, max: 8 }),
    { bodyweight: true },
  )
  assert.equal(bw.xp, 30 / 32)
})

test('poids du corps lesté : traité comme une charge', () => {
  const r = passageXp(passage('d', [set(5, 8), set(5, 8)], { n: 2, min: 6, max: 8 }), { bodyweight: true })
  assert.equal(r.load, 5)
  assert.equal(r.xp, 1)
})

// ── Historique, échauffements, données anciennes ────────────────────────────

test('les échauffements sont exclus de la charge de travail et de l\'XP', () => {
  const sessions = [session('2026-09-01', [
    set(10, 12, { warmup: true }), set(10, 12, { warmup: true }), set(10, 12, { warmup: true }),
    set(18, 8), set(18, 7), set(18, 7), set(18, 6),
  ])]
  const [p] = buildPassageIndex(sessions, '2026-09-10').ex
  assert.equal(p.sets.length, 4)
  const r = passageXp(p)
  assert.equal(r.load, 18, 'trois échauffements à 10 kg ne font pas de 10 kg la charge')
  assert.equal(r.xp, 4 / 16)
})

test('une entrée ancienne sans fourchette se lit min = max = prescribedReps', () => {
  const legacy = {
    date: '2026-08-01',
    entries: {
      a: { exerciseId: 'ex', order: 0, prescribedSets: 3, prescribedReps: 8, sets: [
        { rank: 0, weightKg: 50, reps: 8 }, { rank: 1, weightKg: 50, reps: 8 }, { rank: 2, weightKg: 50, reps: 7 },
      ] },
    },
  }
  const [p] = buildPassageIndex([legacy], '2026-09-01').ex
  assert.deepEqual(p.range, { min: 8, max: 8 })
  assert.equal(passageXp(p).xp, 2 / 3)
})

test('la date affichée et la suite sont exclues', () => {
  const sessions = [
    session('2026-09-01', [set(18, 8)]),
    session('2026-09-08', [set(20, 8)]),
    session('2026-09-15', [set(22, 8)]),
  ]
  const index = buildPassageIndex(sessions, '2026-09-08')
  assert.deepEqual(index.ex.map((p) => p.date), ['2026-09-01'])
})

test('deux passages le même jour sont mis bout à bout', () => {
  const s = {
    date: '2026-09-01',
    entries: {
      b: { exerciseId: 'ex', order: 3, prescribedSets: 2, prescribedRepsMin: 6, prescribedRepsMax: 10,
        sets: [{ rank: 0, weightKg: 18, reps: 9 }] },
      a: { exerciseId: 'ex', order: 0, prescribedSets: 4, prescribedRepsMin: 6, prescribedRepsMax: 10,
        sets: [{ rank: 0, weightKg: 18, reps: 10 }, { rank: 1, weightKg: 18, reps: 10 }] },
    },
  }
  const [p] = buildPassageIndex([s], '2026-09-02').ex
  assert.equal(p.prescribedSets, 4, 'la prescription de la première occurrence')
  assert.deepEqual(p.sets.map((x) => x.reps), [10, 10, 9])
})

// ── Niveau ──────────────────────────────────────────────────────────────────

test('niveau : une montée compte seulement si la barre précédente était pleine', () => {
  const full = (load) => passage('d', [set(load, 10), set(load, 10), set(load, 10), set(load, 10)])
  const half = (load) => passage('d', [set(load, 8), set(load, 8), set(load, 8), set(load, 8)])

  // 18 pleine → 20 (+1) ; 20 à moitié → 22 (montée trop tôt, +0) ; 22 pleine → 24 (+1).
  const progress = exerciseProgress([full(18), half(20), half(22), full(22), half(24)], { incrementKg: 2 })
  assert.equal(progress.level, 2)
  // 20 pleine puis 22 : +1 aussi — la montée suit une barre pleine.
  assert.equal(exerciseProgress([half(20), full(20), half(22)], { incrementKg: 2 }).level, 1)
  assert.equal(exerciseProgress([half(18), half(20)], { incrementKg: 2 }).level, 0)
})

test('monter avant d\'avoir rempli la barre déclenche l\'avertissement', () => {
  const last = passage('d', [set(18, 8), set(18, 7), set(18, 7), set(18, 6)])
  const progress = exerciseProgress([last], { incrementKg: 2 })
  assert.equal(jumpedEarly([set(20, 6)], progress), true)
  assert.equal(jumpedEarly([set(18, 9)], progress), false, 'même charge')
  assert.equal(jumpedEarly([], progress), false, 'rien de saisi')

  const fullProgress = exerciseProgress([passage('d', [set(18, 10), set(18, 10), set(18, 10), set(18, 10)])], { incrementKg: 2 })
  assert.equal(jumpedEarly([set(20, 6)], fullProgress), false, 'barre pleine : la montée est méritée')
})

// ── Redescendre ─────────────────────────────────────────────────────────────

test('deux séances de suite sous le bas de la fourchette, même charge → redescendre', () => {
  const full = passage('a', [set(18, 10), set(18, 10), set(18, 10), set(18, 10)])
  const under = (date) => passage(date, [set(20, 5), set(20, 5), set(20, 4), set(20, 4)])

  assert.equal(exerciseProgress([full, under('b')], { incrementKg: 2 }).suggestion.kind, 'stay', 'une seule séance ne suffit pas')
  assert.deepEqual(
    exerciseProgress([full, under('b'), under('c')], { incrementKg: 2 }).suggestion,
    { kind: 'deload', load: 18 },
  )
  // Pas besoin d'une montée juste avant : deux séances sous le bas suffisent.
  assert.equal(exerciseProgress([under('a'), under('b')], { incrementKg: 2 }).suggestion.kind, 'deload')
})

test('pas de redescente si une série atteint le bas, ou si la charge a changé entre-temps', () => {
  const under = (date, load = 20) => passage(date, [set(load, 5), set(load, 5), set(load, 4), set(load, 4)])
  const oneAtMin = passage('c', [set(20, 6), set(20, 5), set(20, 4), set(20, 4)])
  assert.equal(exerciseProgress([under('b'), oneAtMin], { incrementKg: 2 }).suggestion.kind, 'stay')
  assert.equal(exerciseProgress([under('a', 18), under('b', 20)], { incrementKg: 2 }).suggestion.kind, 'stay')
  // Sans pas réglé, on ne sait pas de combien redescendre : on n'invente rien.
  assert.equal(exerciseProgress([under('a'), under('b')], { incrementKg: 0 }).suggestion.kind, 'stay')
})

// ── Tes vraies séances ──────────────────────────────────────────────────────

test('réel · Développé incliné haltère 6-10, 16 × 10/12/12 → 100 %, passe à 18 kg', () => {
  const p = passage('d', [set(16, 10), set(16, 12), set(16, 12)], { n: 3, min: 6, max: 10 })
  assert.equal(passageXp(p).xp, 1)
  assert.deepEqual(exerciseProgress([p], { incrementKg: 2 }).suggestion, { kind: 'levelUp', load: 18 })
})

test('réel · Développé militaire haltères 8-12, 14 × 12/12/12 → 100 %, passe à 16 kg', () => {
  const p = passage('d', [set(14, 12), set(14, 12), set(14, 12)], { n: 3, min: 8, max: 12 })
  assert.equal(passageXp(p).xp, 1)
  assert.deepEqual(exerciseProgress([p], { incrementKg: 2 }).suggestion, { kind: 'levelUp', load: 16 })
})

test('réel · Rowing assis 8-12, N=4, 54 × 12/12/12 + 61 × 8 → charge 54 kg, 75 %', () => {
  const r = passageXp(passage('d', [set(54, 12), set(54, 12), set(54, 12), set(61, 8)], { n: 4, min: 8, max: 12 }))
  assert.equal(r.load, 54)
  assert.equal(r.xp, 0.75)
})

test('réel · Développé couché haltères 8-12, 16 × 12/12 + 18 × 8/10 → égalité, 18 kg, 17 %', () => {
  const r = passageXp(passage('d', [set(16, 12), set(16, 12), set(18, 8), set(18, 10)], { n: 3, min: 8, max: 12 }))
  assert.equal(r.load, 18)
  assert.equal(r.xp, 2 / 12)
  assert.equal(pct(r.xp), 17)
})

test('réel · Curl marteau 10-12, 12 × 5/7/8/3 → 0 %, et après 12 × 5/5/7 → redescendre', () => {
  const today = passage('b', [set(12, 5), set(12, 7), set(12, 8), set(12, 3)], { n: 3, min: 10, max: 12 })
  assert.equal(passageXp(today).xp, 0)
  const before = passage('a', [set(12, 5), set(12, 5), set(12, 7)], { n: 3, min: 10, max: 12 })
  assert.deepEqual(exerciseProgress([before, today], { incrementKg: 2 }).suggestion, { kind: 'deload', load: 10 })
})

test('une séance d\'avant les fourchettes prend celle du programme actuel', () => {
  // Normalisée par sessionsService : bornes nulles, nombre fixe conservé.
  const legacy = [{
    date: '2026-09-01',
    entries: {
      a: { exerciseId: 'ex', order: 0, prescribedSets: 3, prescribedReps: 10, prescribedRepsMin: null, prescribedRepsMax: null,
        sets: [{ rank: 0, weightKg: 16, reps: 10 }, { rank: 1, weightKg: 16, reps: 12 }, { rank: 2, weightKg: 16, reps: 12 }] },
    },
  }]
  const withProgram = buildProgressIndex(legacy, '2026-09-10', () => ({ incrementKg: 2 }), () => ({ min: 6, max: 10 }))
  assert.deepEqual(withProgram.ex.last.range, { min: 6, max: 10 })
  assert.equal(withProgram.ex.suggestion.load, 18)
  // Sans programme : le nombre fixe d'alors (10) — 3 séries sur 3 l'ont atteint.
  const alone = buildProgressIndex(legacy, '2026-09-10', () => ({ incrementKg: 2 }))
  assert.deepEqual(alone.ex.last.range, { min: 10, max: 10 })
})

// ── Suggestions, arrondis ───────────────────────────────────────────────────

test('barre pleine sans pas réglé → « full », sans charge inventée', () => {
  const p = passage('d', [set(0, 8), set(0, 8), set(0, 8), set(0, 8)], { n: 4, min: 6, max: 8 })
  assert.deepEqual(exerciseProgress([p], { incrementKg: 0, bodyweight: true }).suggestion, { kind: 'full', load: 0 })
})

test('aucun historique → « first »', () => {
  assert.deepEqual(exerciseProgress([], { incrementKg: 2 }), { last: null, level: 0, suggestion: { kind: 'first', load: null } })
})

test('les charges s\'additionnent sans erreur de virgule flottante', () => {
  const full = (load, n = 1) => passage('d', Array.from({ length: n }, () => set(load, 10)), { n, min: 6, max: 10 })
  assert.equal(exerciseProgress([full(62.5)], { incrementKg: 2.5 }).suggestion.load, 65)
  assert.equal(exerciseProgress([full(33)], { incrementKg: 7 }).suggestion.load, 40)
  assert.equal(exerciseProgress([full(0.1 + 0.2)], { incrementKg: 1.25 }).suggestion.load, 1.55)
  assert.equal(roundKg(0.1 + 0.2), 0.3)
})

test('index complet : options par exercice', () => {
  const sessions = [
    session('2026-09-01', [set(18, 10), set(18, 10), set(18, 10), set(18, 10)]),
    session('2026-09-01', [set(40, 10), set(40, 10), set(40, 10), set(40, 10)], { exerciseId: 'm', order: 1 }),
  ]
  // Les deux séances partagent une date : on les fusionne comme le ferait Firestore (un doc par jour).
  const merged = [{ date: '2026-09-01', entries: { ...sessions[0].entries, ...sessions[1].entries } }]
  const index = buildProgressIndex(merged, '2026-09-08', (id) => ({ incrementKg: id === 'm' ? 7 : 2 }))
  assert.equal(index.ex.suggestion.load, 20)
  assert.equal(index.m.suggestion.load, 47)
})

test('charge conseillée atteinte', () => {
  assert.equal(reachedLoad([set(20, 6)], 20), true)
  assert.equal(reachedLoad([set(18, 10)], 20), false)
  assert.equal(reachedLoad([set(20, 0)], 20), false, 'une charge sans reps n\'est pas une série')
})
