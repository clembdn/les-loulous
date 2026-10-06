// node --test src/apps/trip/utils/*.test.mjs
//
// Saisie rapide : l'heure lue dans la phrase, la catégorie devinée.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuickAdd } from './quickAdd.js'
import { guessCategory } from './categoryGuess.js'

test('une heure en tête de saisie', () => {
  assert.deepEqual(parseQuickAdd('10h30 Tour de Belém'), { time: '10:30', query: 'Tour de Belém' })
  assert.deepEqual(parseQuickAdd('9h café'), { time: '09:00', query: 'café' })
  assert.deepEqual(parseQuickAdd('  10:30 - Jerónimos'), { time: '10:30', query: 'Jerónimos' })
  assert.deepEqual(parseQuickAdd('à 17 h 15 Miradouro'), { time: '17:15', query: 'Miradouro' })
})

test('une heure en fin de saisie', () => {
  assert.deepEqual(parseQuickAdd('Time Out Market 19h'), { time: '19:00', query: 'Time Out Market' })
  assert.deepEqual(parseQuickAdd('Ponta da Piedade à 19h30'), { time: '19:30', query: 'Ponta da Piedade' })
})

test('pas d’heure : tout est le nom', () => {
  assert.deepEqual(parseQuickAdd('Route 66'), { time: null, query: 'Route 66' })
  assert.deepEqual(parseQuickAdd('LX Factory'), { time: null, query: 'LX Factory' })
  assert.deepEqual(parseQuickAdd('25h Bar'), { time: null, query: '25h Bar' }, 'pas une heure valable')
  assert.deepEqual(parseQuickAdd('10h30'), { time: null, query: '10h30' }, 'une heure seule ne fait pas un lieu')
  assert.deepEqual(parseQuickAdd(''), { time: null, query: '' })
})

test('catégorie d’après les tags OpenStreetMap', () => {
  assert.equal(guessCategory({ osmKey: 'amenity', osmValue: 'restaurant' }), 'food')
  assert.equal(guessCategory({ osmKey: 'tourism', osmValue: 'museum' }), 'visit')
  assert.equal(guessCategory({ osmKey: 'natural', osmValue: 'beach' }), 'beach')
  assert.equal(guessCategory({ osmKey: 'shop', osmValue: 'books' }), 'shopping')
  assert.equal(guessCategory({ osmKey: 'historic', osmValue: 'yes' }), 'visit')
  assert.equal(guessCategory({ osmValue: 'cafe' }), 'coffee', 'classe OpenMapTiles, sans clé')
})

test('catégorie d’après le nom, sans accents', () => {
  assert.equal(guessCategory({ name: 'Praia do Camilo' }), 'beach')
  assert.equal(guessCategory({ name: 'Pastéis de Belém' }), 'coffee')
  assert.equal(guessCategory({ name: 'Time Out Market' }), 'food')
  assert.equal(guessCategory({ name: 'Museu Calouste Gulbenkian' }), 'visit')
  assert.equal(guessCategory({ name: 'Cabo da Roca' }), 'nature')
  assert.equal(guessCategory({ name: 'Kayak dans les grottes' }), 'activity')
  assert.equal(guessCategory({ name: 'Chez Lise' }), null)
})
