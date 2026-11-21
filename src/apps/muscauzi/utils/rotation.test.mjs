// node --test src/apps/muscauzi/utils/*.test.mjs
//
// Les séances « en boucle » : quelle case proposer pour une date.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastDoneBySlot, nextSlot, rotationSlots, slotForDate, slotOfSession } from './rotation.js'

const line = { exerciseId: 'x', sets: 3 }

// Le programme v3 : quatre cases nommées, trois vides.
const V3 = {
  days: { 1: [line], 2: [line], 3: [line], 4: [line], 5: [], 6: [], 7: [] },
  names: { 1: 'Legs', 2: 'Push', 3: 'Pull', 4: 'Rappel haut' },
}
const slots = rotationSlots(V3)

// Une séance qui porte une vraie série de travail.
function worked(date, name, dayOfWeek = null) {
  return { date, name, dayOfWeek, entries: { a: { sets: [{ rank: 0, weightKg: 20, reps: 10 }] } } }
}

test('les cases sont les jours non vides, dans l\'ordre', () => {
  assert.deepEqual(slots.map((s) => s.slot), [1, 2, 3, 4])
  assert.deepEqual(slots.map((s) => s.name), ['Legs', 'Push', 'Pull', 'Rappel haut'])
  assert.equal(slots[2].position, 3)
  assert.equal(slots[2].count, 4)
  // Une case vide au milieu n'est pas dans la boucle.
  const holes = rotationSlots({ days: { 2: [line], 5: [line] }, names: {} })
  assert.deepEqual(holes.map((s) => s.slot), [2, 5])
})

test('la boucle : 1 → 2 → 3 → 4 → 1', () => {
  assert.equal(nextSlot([], slots, '2026-11-01'), 1, 'aucun historique : la première case')
  const history = []
  const expected = [1, 2, 3, 4, 1, 2]
  expected.forEach((want, i) => {
    const date = `2026-11-0${i + 1}`
    assert.equal(nextSlot(history, slots, date), want)
    history.push(worked(date, slots.find((s) => s.slot === want).name))
  })
})

test('case d\'une séance : nom d\'abord, puis dayOfWeek, sinon aucune', () => {
  assert.equal(slotOfSession({ name: 'Pull', dayOfWeek: 5 }, slots), 3, 'le nom l\'emporte')
  assert.equal(slotOfSession({ name: '', dayOfWeek: 2 }, slots), 2, 'repli sur la case enregistrée')
  assert.equal(slotOfSession({ name: 'Inconnu', dayOfWeek: 6 }, slots), null)
  assert.equal(slotOfSession({ name: 'pull', dayOfWeek: null }, slots), null, 'nom exact')
})

test('une séance commencée garde sa case, même si une autre a été faite après', () => {
  const sessions = [worked('2026-11-10', 'Legs'), worked('2026-11-12', 'Pull')]
  // Le 12 a été fait en Pull après coup : relire le 10 doit toujours
  // montrer Legs, pas « la suivante après Pull ».
  assert.deepEqual(slotForDate({ sessions, slots, dateKey: '2026-11-10' }), { slot: 1, source: 'session' })
  // Même un choix manuel ne déplace pas une séance qui a du travail.
  assert.equal(slotForDate({ sessions, slots, dateKey: '2026-11-10', manual: 4 }).slot, 1)
})

test('sans travail, ou avec un nom inconnu, une séance est ignorée', () => {
  const sessions = [
    worked('2026-11-10', 'Legs'),
    { date: '2026-11-11', name: 'Push', dayOfWeek: 2, entries: {} },
    worked('2026-11-12', 'Cardio', 6),
  ]
  assert.equal(nextSlot(sessions, slots, '2026-11-13'), 2, 'on repart après Legs')
})

test('des échauffements seuls ne font pas avancer la boucle', () => {
  const warm = {
    date: '2026-11-11', name: 'Pull', dayOfWeek: 3,
    entries: { a: { sets: [{ rank: 0, weightKg: 10, reps: 12, warmup: true }] } },
  }
  assert.equal(nextSlot([worked('2026-11-10', 'Legs'), warm], slots, '2026-11-12'), 2)
  // … mais la séance du jour, elle, garde la case choisie à l'échauffement :
  // son nom est déjà écrit, le choix manuel ne survit pas à un redémarrage.
  assert.deepEqual(
    slotForDate({ sessions: [worked('2026-11-10', 'Legs'), warm], slots, dateKey: '2026-11-11' }),
    { slot: 3, source: 'session' },
  )
})

test('deux séances le même jour ne font avancer la boucle qu\'une fois', () => {
  const sessions = [worked('2026-11-10', 'Legs'), worked('2026-11-10', 'Legs')]
  assert.equal(nextSlot(sessions, slots, '2026-11-11'), 2)
  // La séance du jour elle-même ne compte pas : strictement avant.
  assert.equal(nextSlot(sessions, slots, '2026-11-10'), 1)
})

test('choix manuel, puis case suivante', () => {
  const sessions = [worked('2026-11-10', 'Legs')]
  assert.deepEqual(slotForDate({ sessions, slots, dateKey: '2026-11-11', manual: 4 }), { slot: 4, source: 'manual' })
  assert.deepEqual(slotForDate({ sessions, slots, dateKey: '2026-11-11', manual: 6 }), { slot: 2, source: 'next' }, 'case vide : ignorée')
  assert.deepEqual(slotForDate({ sessions, slots, dateKey: '2026-11-11' }), { slot: 2, source: 'next' })
})

test('programme vide : pas de case', () => {
  const none = rotationSlots({ days: {}, names: {} })
  assert.deepEqual(none, [])
  assert.equal(nextSlot([], none, '2026-11-11'), null)
  assert.deepEqual(slotForDate({ sessions: [], slots: none, dateKey: '2026-11-11' }), { slot: null, source: 'none' })
})

// L'historique réel de Clément, une fois les six séances renommées.
const REAL = [
  worked('2026-10-28', 'Push', 3),
  worked('2026-11-10', 'Legs', 2),
  worked('2026-11-11', 'Pull', 3),
  worked('2026-11-13', 'Push', 5),
  worked('2026-11-17', 'Pull', 2),
  worked('2026-11-20', 'Push', 5),
]

test('vraies données : après le Push du 20/11, la suivante est Pull', () => {
  const { slot } = slotForDate({ sessions: REAL, slots, dateKey: '2026-11-21' })
  assert.equal(slots.find((s) => s.slot === slot).name, 'Pull')
  // Rattrapage du 19 : relatif à cette date, après le Pull du 17.
  const back = slotForDate({ sessions: REAL, slots, dateKey: '2026-11-19' })
  assert.equal(slots.find((s) => s.slot === back.slot).name, 'Rappel haut')
  assert.deepEqual(lastDoneBySlot(REAL, slots, '2026-11-21'), {
    1: '2026-11-10', 2: '2026-11-20', 3: '2026-11-17',
  })
})
