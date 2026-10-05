// node --test api/_lib/*.test.mjs
//
// Dérouler un lien Maps : redirections, liste blanche, page, repli Photon.
// Le réseau est simulé : chaque test décrit ce que « répond » Internet.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractCoordsFromHtml, extractTitle, resolveMapsLink } from './mapsResolver.js'

function fakeFetch(routes) {
  const calls = []
  const impl = async (url, options = {}) => {
    calls.push(url)
    const route = routes.find(([match]) => (typeof match === 'string' ? url === match : match.test(url)))
    if (!route) throw new Error(`réseau inattendu : ${url}`)
    const r = route[1]
    return {
      ok: (r.status ?? 200) < 300,
      status: r.status ?? 200,
      headers: { get: (name) => (name === 'location' ? r.location ?? null : null) },
      text: async () => r.html ?? '',
      json: async () => r.json ?? {},
      redirectMode: options.redirect,
    }
  }
  return { impl, calls }
}

const PLACE = 'https://www.google.com/maps/place/Torre+de+Bel%C3%A9m/@38.6916,-9.216,17z/data=!3d38.6915837!4d-9.2159767'

test('un lien court suivi jusqu’au lieu', async () => {
  const net = fakeFetch([['https://maps.app.goo.gl/abc', { status: 302, location: PLACE }]])
  const r = await resolveMapsLink('https://maps.app.goo.gl/abc', { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.deepEqual(
    { name: r.body.name, lat: r.body.lat, lng: r.body.lng },
    { name: 'Torre de Belém', lat: 38.6915837, lng: -9.2159767 },
  )
  assert.deepEqual(net.calls, ['https://maps.app.goo.gl/abc'], 'le lien final se lit sans charger la page')
})

test('une redirection hors de Google Maps est refusée', async () => {
  const net = fakeFetch([['https://maps.app.goo.gl/evil', { status: 302, location: 'https://evil.example/steal' }]])
  const r = await resolveMapsLink('https://maps.app.goo.gl/evil', { fetchImpl: net.impl })
  assert.equal(r.status, 422)
  assert.equal(net.calls.length, 1)
})

test('ce qui n’est pas un lien Maps n’est jamais chargé', async () => {
  const net = fakeFetch([])
  assert.equal((await resolveMapsLink('https://example.com/x', { fetchImpl: net.impl })).status, 400)
  assert.equal((await resolveMapsLink(undefined, { fetchImpl: net.impl })).status, 400)
  assert.equal(net.calls.length, 0)
})

test('la page de consentement européenne est contournée par son paramètre `continue`', async () => {
  const consent = `https://consent.google.com/ml?continue=${encodeURIComponent(PLACE)}&gl=FR`
  const net = fakeFetch([['https://maps.app.goo.gl/eu', { status: 302, location: consent }]])
  const r = await resolveMapsLink('https://maps.app.goo.gl/eu', { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(r.body.lat, 38.6915837)
})

test('sans coordonnées dans l’URL : on les lit dans la page', async () => {
  const shared = 'https://maps.google.com/?q=Past%C3%A9is+de+Bel%C3%A9m,+Lisboa&ftid=0x1:0x2'
  const net = fakeFetch([
    ['https://maps.app.goo.gl/share', { status: 302, location: shared }],
    [shared, { html: '<meta content="https://maps.google.com/maps/api/staticmap?center=38.6975%2C-9.2032&amp;zoom=15" property="og:image">' }],
  ])
  const r = await resolveMapsLink('https://maps.app.goo.gl/share', { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.deepEqual([r.body.name, r.body.address, r.body.lat, r.body.lng], ['Pastéis de Belém', 'Lisboa', 38.6975, -9.2032])
  assert.equal(r.body.approximate, undefined)
})

test('page muette : OpenStreetMap retrouve le lieu, signalé approximatif', async () => {
  const shared = 'https://maps.google.com/?q=Gare+do+Oriente,+Lisboa'
  const net = fakeFetch([
    [shared, { html: '<html></html>' }],
    [/^https:\/\/photon\.komoot\.io\//, { json: { features: [{ geometry: { coordinates: [-9.0993, 38.7678] }, properties: { name: 'Gare do Oriente', city: 'Lisboa' } }] } }],
  ])
  const r = await resolveMapsLink(shared, { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(r.body.approximate, true)
  assert.equal(r.body.lat, 38.7678)
})

test('rien trouvé nulle part : 422, avec le nom qu’on a pu lire', async () => {
  const shared = 'https://maps.google.com/?q=Endroit+introuvable'
  const net = fakeFetch([
    [shared, { status: 500 }],
    [/^https:\/\/photon\.komoot\.io\//, { json: { features: [] } }],
  ])
  const r = await resolveMapsLink(shared, { fetchImpl: net.impl })
  assert.equal(r.status, 422)
  assert.equal(r.body.name, 'Endroit introuvable')
})

test('motifs de coordonnées et titre dans le HTML', () => {
  assert.deepEqual(extractCoordsFromHtml('xx [null,null,-42.8862,147.331] yy'), { lat: -42.8862, lng: 147.331 })
  assert.equal(extractCoordsFromHtml('[null,null,0.0,0.0]'), null, 'le 0,0 d’une page vide')
  assert.equal(extractCoordsFromHtml('<html>'), null)
  assert.deepEqual(
    extractTitle('<meta content="Pastéis de Belém · R. de Belém 84, Lisboa" property="og:title">'),
    { name: 'Pastéis de Belém', address: 'R. de Belém 84, Lisboa' },
  )
  assert.equal(extractTitle('<meta property="og:title" content="Google Maps">'), null)
})
