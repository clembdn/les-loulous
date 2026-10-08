// node --test src/apps/trip/utils/*.test.mjs
//
// La valise : catégories devinées, filtres, ce qu'on reprend d'ailleurs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  filterPacking, groupPacking, guessPackingCategory, itemsToAdd, packingKey, packingProgress, packingSuggestions,
} from './packing.js'

test('la clé : sans accents, ni ponctuation, ni pluriel', () => {
  assert.equal(packingKey('  Chaussures de MARCHE '), 'chaussure de marche')
  assert.equal(packingKey('T-shirts'), 't shirt')
  assert.equal(packingKey('Brosse à dents'), 'brosse a dent')
  assert.equal(packingKey('Gaz'), 'gaz')
})

test('la catégorie devinée, en mots entiers', () => {
  assert.equal(guessPackingCategory('Passeports'), 'papers')
  assert.equal(guessPackingCategory('Chargeur USB-C'), 'electronics')
  assert.equal(guessPackingCategory('Crème solaire SPF 50'), 'toiletries')
  assert.equal(guessPackingCategory('Doliprane'), 'health')
  assert.equal(guessPackingCategory('3 t-shirts'), 'clothes')
  assert.equal(guessPackingCategory('Brosse à dents'), 'toiletries')
  // « lunettes de vue » (santé) avant « lunettes » tout court : plus long d'abord.
  assert.equal(guessPackingCategory('Lunettes de vue'), 'health')
  // Pas de sous-chaîne : « cable » n'est pas dans « constable », ni « cb » dans « cbd ».
  assert.equal(guessPackingCategory('Constable (livre)'), 'misc')
  assert.equal(guessPackingCategory('Huile CBD'), 'misc')
  assert.equal(guessPackingCategory('Frisbee'), 'misc')
})

test('groupées par catégorie, dans l’ordre des catégories, puis par nom', () => {
  const groups = groupPacking([
    { id: 1, name: 'Pull', category: 'clothes' },
    { id: 2, name: 'Passeport', category: 'papers' },
    { id: 3, name: 'Chaussettes', category: 'clothes' },
  ])
  assert.deepEqual(groups.map((g) => g.category.id), ['papers', 'clothes'])
  assert.deepEqual(groups[1].items.map((i) => i.name), ['Chaussettes', 'Pull'])
})

test('le filtre d’une personne : ses affaires et les communes', () => {
  const items = [{ name: 'A', owner: null }, { name: 'B', owner: 'u1' }, { name: 'C', owner: 'u2' }]
  assert.equal(filterPacking(items, 'all').length, 3)
  assert.deepEqual(filterPacking(items, 'shared').map((i) => i.name), ['A'])
  assert.deepEqual(filterPacking(items, 'u1').map((i) => i.name), ['A', 'B'])
  assert.deepEqual(packingProgress([{ checked: true }, { checked: false }]), { done: 1, total: 2 })
})

test('reprendre une liste : sans ce qui est déjà là pour la même personne, sans doublon, décoché', () => {
  const existing = [{ name: 'Passeport', owner: 'u1' }, { name: 'Pull', owner: null }]
  const source = [
    { name: 'Passeports', owner: 'u1', category: 'papers', checked: true },
    { name: 'Passeport', owner: 'u2', category: 'papers', checked: true },
    { name: 'pull', owner: null },
    { name: 'Gourde', owner: null },
    { name: 'Gourde', owner: null },
    { name: '  ', owner: null },
  ]
  assert.deepEqual(itemsToAdd(source, existing), [
    { name: 'Passeport', category: 'papers', owner: 'u2' },
    { name: 'Gourde', category: 'misc', owner: null },
  ])
})

test('les suggestions : la liste type, moins ce qui est déjà là, au début des mots', () => {
  const s = packingSuggestions('ch', [{ name: 'Chaussettes' }])
  assert.deepEqual(s.map((t) => t.name), ['Chargeur de téléphone', 'Chaussures de marche'])
  assert.equal(packingSuggestions('', [], 3).length, 3)
})
