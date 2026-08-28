// node --test src/apps/muscauzi/utils/
//
// La bande morte est la seule chose qui compte ici : sans elle, deux kilos
// d'écart sur quatre tonnes s'annoncent comme un progrès.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compare, formatTrend } from './trend.js'

test('sans référence, on ne compare pas', () => {
  assert.equal(compare(100, 0), null)
  assert.equal(compare(100, null), null)
  assert.equal(compare(100, undefined), null)
})

test('un écart sous 1 % est stable', () => {
  assert.equal(compare(4002, 4000).direction, 'flat')
  assert.equal(compare(3990, 4000).direction, 'flat')
})

test('au-delà de 1 %, la direction est dite', () => {
  assert.equal(compare(4100, 4000).direction, 'up')
  assert.equal(compare(3900, 4000).direction, 'down')
})

test('delta et ratio sont bruts, jamais arrondis', () => {
  const t = compare(110, 100)
  assert.equal(t.delta, 10)
  assert.equal(t.ratio, 0.1)
})

test('une chute à zéro reste comparable', () => {
  assert.equal(compare(0, 4000).direction, 'down')
})

test('l’écart écrit porte son signe et sa virgule française', () => {
  assert.equal(formatTrend(compare(104.2, 100)), '+4,2 %')
  assert.equal(formatTrend(compare(98.2, 100)), '−1,8 %')
  assert.equal(formatTrend(compare(4002, 4000)), 'stable')
  assert.equal(formatTrend(null), null)
})

test('au-delà de 10 %, la décimale disparaît', () => {
  assert.equal(formatTrend(compare(125, 100)), '+25 %')
})
