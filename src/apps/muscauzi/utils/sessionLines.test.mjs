// node --test src/apps/muscauzi/utils/*.test.mjs
//
// Les séances faites sous un ancien programme se rattachent aux lignes du
// programme actuel, par exercice — au lieu de tout afficher « hors programme ».

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachEntries } from './sessionLines.js'

const line = (instanceId, exerciseId) => ({ instanceId, exerciseId })
const entry = (instanceId, exerciseId, order, sets = [{ rank: 0, weightKg: 20, reps: 8 }]) => ({
  instanceId, exerciseId, order, sets, skipped: false,
})

test('une séance de l\'ancien programme se rattache par exercice', () => {
  const { lines, orphans } = attachEntries(
    [line('new-a', 'dc'), line('new-b', 'sq')],
    [entry('old-a', 'dc', 0), entry('old-b', 'sq', 1)],
  )
  assert.deepEqual(lines.map((l) => l.instanceId), ['old-a', 'old-b'], 'les corrections s\'écrivent sous l\'entrée existante')
  assert.deepEqual(orphans, [])
})

test('une ligne qui a déjà son travail n\'adopte rien', () => {
  const { lines, orphans } = attachEntries(
    [line('new-a', 'dc')],
    [entry('new-a', 'dc', 0), entry('old-a', 'dc', 0)],
  )
  assert.equal(lines[0].instanceId, 'new-a')
  assert.deepEqual(orphans.map((e) => e.instanceId), ['old-a'])
})

test('une entrée vide sous le nouvel identifiant n\'empêche pas le rattachement', () => {
  // Ouvrir la ligne puis passer à la suivante écrit une entrée sans série.
  const { lines } = attachEntries(
    [line('new-a', 'dc')],
    [entry('new-a', 'dc', 0, []), entry('old-a', 'dc', 0)],
  )
  assert.equal(lines[0].instanceId, 'old-a')
})

test('un exercice ajouté à la volée reste hors programme', () => {
  const { lines, orphans, savedIds } = attachEntries(
    [line('new-a', 'dc')],
    [entry('added-1', 'dc', 1000)],
  )
  assert.equal(lines[0].instanceId, 'new-a', 'il ne change pas de place en pleine saisie')
  assert.deepEqual(orphans.map((e) => e.instanceId), ['added-1'])
  assert.ok(savedIds.has('added-1'))
})

test('le même exercice deux fois : rattaché dans l\'ordre de la séance', () => {
  const { lines } = attachEntries(
    [line('new-1', 'dc'), line('new-2', 'dc')],
    [entry('old-2', 'dc', 3), entry('old-1', 'dc', 0)],
  )
  assert.deepEqual(lines.map((l) => l.instanceId), ['old-1', 'old-2'])
})

test('un exercice retiré du programme reste hors programme', () => {
  const { lines, orphans, savedIds } = attachEntries(
    [line('new-a', 'dc')],
    [entry('old-a', 'dc', 0), entry('old-z', 'curl', 1)],
  )
  assert.equal(lines[0].instanceId, 'old-a')
  assert.deepEqual(orphans.map((e) => e.instanceId), ['old-z'])
  assert.deepEqual([...savedIds].sort(), ['old-a', 'old-z'], 'les adoptées comptent comme enregistrées')
})
