// node --test src/apps/trip/utils/*.test.mjs
//
// La vitrine d'un lien invité : contenu publié, empreinte, captures, jeton.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attachmentChanges, chunkBySize, contentHash, newShareToken, publicTripContent, TOKEN_RE,
} from './publicTrip.js'

const META = { createdAt: '2026-10-01T10:00:00Z', createdBy: 'uid-a', updatedAt: '2026-10-02T10:00:00Z', updatedBy: 'uid-b' }

function sample(overrides = {}) {
  return {
    trip: { id: 't1', title: 'Portugal', startDate: '2027-05-12', endDate: '2027-05-14', notes: null, ...META },
    stays: [
      { id: 'b', name: 'Pins', price: 80, accessCode: '1234', ...META },
      { id: 'a', name: 'Alfama', price: null, ...META },
    ],
    transports: [],
    days: {
      '2027-05-12': { id: '2027-05-12', date: '2027-05-12', title: 'Lisbonne', notes: null, stops: [{ id: 's1', name: 'Belém' }], ...META },
      '2027-05-13': { id: '2027-05-13', date: '2027-05-13', title: null, notes: null, stops: [], legs: [], ...META },
      '2027-05-14': { id: '2027-05-14', date: '2027-05-14', title: null, notes: null, stops: [], legs: [{ status: 'ok' }], ...META },
      '2027-05-20': { id: '2027-05-20', date: '2027-05-20', title: 'Hors voyage', notes: null, stops: [], ...META },
    },
    dayKeys: ['2027-05-12', '2027-05-13', '2027-05-14'],
    attachments: [{ id: 'z', data: 'xxx' }, { id: 'y', data: 'yyy' }],
    ...overrides,
  }
}

test('la vitrine garde tout ce que l’invité voit, sans qui a écrit quoi', () => {
  const content = publicTripContent(sample())
  assert.deepEqual(content.trip, { title: 'Portugal', startDate: '2027-05-12', endDate: '2027-05-14', notes: null })
  assert.deepEqual(content.stays.map((s) => s.id), ['a', 'b'], 'ordre stable')
  assert.equal(content.stays[1].accessCode, '1234', 'l’invité voit tout, codes compris')
  assert.equal(content.stays[0].createdBy, undefined)
  assert.equal(content.stays[0].updatedAt, undefined)
  assert.deepEqual(Object.keys(content.days), ['2027-05-12', '2027-05-14'], 'ni jour vide, ni jour hors des dates')
  assert.deepEqual(content.days['2027-05-12'].legs, [], 'les trajets calculés partent aussi')
  assert.equal(content.days['2027-05-12'].createdBy, undefined)
  assert.deepEqual(content.attachmentIds, ['y', 'z'], 'les identifiants seulement, sans les images')
})

test('l’empreinte ignore les métadonnées et suit le contenu', () => {
  const base = contentHash(publicTripContent(sample()))
  const resaved = sample()
  resaved.stays[0] = { ...resaved.stays[0], updatedAt: '2026-10-08T00:00:00Z', updatedBy: 'uid-a' }
  assert.equal(contentHash(publicTripContent(resaved)), base, 'réenregistrer sans changement ne republie pas')

  const renamed = sample()
  renamed.stays[0] = { ...renamed.stays[0], name: 'Pins du Sud' }
  assert.notEqual(contentHash(publicTripContent(renamed)), base)

  const moreFiles = sample({ attachments: [{ id: 'z' }, { id: 'y' }, { id: 'x' }] })
  assert.notEqual(contentHash(publicTripContent(moreFiles)), base, 'une capture de plus republie')
  assert.match(base, /^[0-9a-z]+$/)
})

test('captures à copier et à retirer', () => {
  assert.deepEqual(attachmentChanges(['a', 'b'], ['b', 'c']), { add: ['c'], remove: ['a'] })
  assert.deepEqual(attachmentChanges(undefined, ['a']), { add: ['a'], remove: [] })
  assert.deepEqual(attachmentChanges(['a'], ['a']), { add: [], remove: [] })
})

test('paquets de captures sous le plafond d’une requête', () => {
  const items = [5, 4, 3, 6, 1].map((size, i) => ({ id: i, size }))
  const chunks = chunkBySize(items, (x) => x.size, 9)
  assert.deepEqual(chunks.map((c) => c.map((x) => x.size)), [[5, 4], [3, 6], [1]])
  assert.deepEqual(chunkBySize([{ size: 20 }], (x) => x.size, 9).length, 1, 'un élément trop gros part seul')
  assert.deepEqual(chunkBySize([], (x) => x, 9), [])
})

test('jeton : 32 symboles base64url, tirés au hasard', () => {
  const token = newShareToken()
  assert.match(token, TOKEN_RE)
  assert.notEqual(newShareToken(), token)
  const fixed = newShareToken((a) => a.fill(255))
  assert.equal(fixed, '_'.repeat(32))
})
