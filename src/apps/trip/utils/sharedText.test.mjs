// node --test src/apps/trip/utils/*.test.mjs
//
// Un lieu partagé depuis Google Maps (Web Share Target).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSharedPlace } from './sharedText.js'

test('le partage type de Google Maps : nom, adresse, lien court', () => {
  const p = parseSharedPlace({ text: 'Tour de Belém\nAv. Brasília, 1400-038 Lisboa\nhttps://maps.app.goo.gl/abc123' })
  assert.deepEqual(p, {
    name: 'Tour de Belém',
    address: 'Av. Brasília, 1400-038 Lisboa',
    mapsUrl: 'https://maps.app.goo.gl/abc123',
    url: 'https://maps.app.goo.gl/abc123',
  })
})

test('nom dans le titre, lien seul dans le texte', () => {
  const p = parseSharedPlace({ title: 'Pastéis de Belém', text: 'https://maps.app.goo.gl/xyz' })
  assert.equal(p.name, 'Pastéis de Belém')
  assert.equal(p.address, null)
  assert.equal(p.mapsUrl, 'https://maps.app.goo.gl/xyz')
})

test('un titre générique ne fait pas un nom', () => {
  const p = parseSharedPlace({ title: 'Google Maps', text: 'LX Factory https://maps.app.goo.gl/q1' })
  assert.equal(p.name, 'LX Factory')
})

test('lien dans `url`, ponctuation finale retirée', () => {
  const p = parseSharedPlace({ text: 'Allez voir (https://maps.app.goo.gl/k9).', url: '' })
  assert.equal(p.mapsUrl, 'https://maps.app.goo.gl/k9')
  const q = parseSharedPlace({ url: 'https://www.google.com/maps/place/Cabo+da+Roca/@38.78,-9.49,15z' })
  assert.equal(q.mapsUrl, 'https://www.google.com/maps/place/Cabo+da+Roca/@38.78,-9.49,15z')
  assert.equal(q.name, '')
})

test('un lien qui n’est pas Google Maps est gardé à part', () => {
  const p = parseSharedPlace({ text: 'Super resto https://exemple.pt/menu' })
  assert.equal(p.mapsUrl, null)
  assert.equal(p.url, 'https://exemple.pt/menu')
  assert.equal(p.name, 'Super resto')
})
