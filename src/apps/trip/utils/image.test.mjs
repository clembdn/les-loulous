// node --test src/apps/trip/utils/*.test.mjs
//
// Dimensions de travail d'une capture avant compression.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitWithin } from './image.js'

test('une capture de téléphone garde sa taille', () => {
  assert.deepEqual(fitWithin(1170, 2532), { width: 1170, height: 2532 })
})

test('trop large : ramenée à 1600 px', () => {
  assert.deepEqual(fitWithin(3200, 1800), { width: 1600, height: 900 })
})

test('une très longue capture rapetisse pour tenir dans la limite de Safari', () => {
  const { width, height } = fitWithin(1170, 20000)
  assert.ok(width * height <= 16_000_000)
  assert.ok(Math.abs(width / height - 1170 / 20000) < 0.001, 'proportions gardées')
})
