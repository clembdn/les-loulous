// node --test api/_lib/*.test.mjs
//
// Dérouler un lien Maps : redirections, liste blanche, recherche Google par
// ftid, repli Photon ou zone du ftid. Le réseau est simulé : chaque test décrit
// ce que « répond » Internet. Les formes d'URL et de réponses sont relevées sur
// de vrais liens (2026-10) ; `mapsResolver.live.mjs` les vérifie contre Google.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractTitle, findPlaceInSearch, resolveMapsLink } from './mapsResolver.js'

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

// Ce que Google sert au serveur pour une page de lieu : AUCUNE coordonnée du
// lieu, seulement le centre de carte déduit de l'IP du serveur (ici Washington,
// la région Vercel). Le piège qui envoyait tous les lieux au même endroit.
const IP_CENTER_PAGE = '<meta content="https://maps.google.com/maps/api/staticmap?center=38.9072%2C-77.0369&amp;zoom=14" property="og:image">'
  + '<script>window.APP_INITIALIZATION_STATE=[[[4000,-77.0369,38.9072]],[null,null,38.9072,-77.0369]]</script>'

const EIFFEL_FTID = '0x47e66e2964e34e2d:0x8ddca9ee380ef7e0'
const EIFFEL = { lat: 48.8583701, lng: 2.2944813 }

// Une réponse de `/search?tbm=map` réduite à sa forme : chaque résultat est un
// long tableau avec, entre autres, `[null,null,lat,lng]` (index 9), le ftid
// (10) et le nom (11) ; d'autres lieux et le cadrage autour.
function searchResponse(results) {
  const entries = results.map(({ ftid, lat, lng, name }) => {
    const e = Array(14).fill(null)
    e[9] = [null, null, lat, lng]
    e[10] = ftid
    e[11] = name
    return [null, null, null, null, null, null, null, null, null, null, null, null, null, null, e]
  })
  return `)]}'\n${JSON.stringify([['requête', entries], [[null, null, 38.9072, -77.0369]]])}`
}

// Partage depuis l'app Android : nom et adresse dans le chemin, et le ftid
// dans `data=`, sans coordonnées.
const ANDROID_SHARE = `https://www.google.com/maps/place/Tour+Eiffel,+Av.+Gustave+Eiffel,+75007+Paris/data=!4m2!3m1!1s${EIFFEL_FTID}!18m1!1e1?utm_source=mstt_1&entry=gps`
const GOOGLE_SEARCH = /^https:\/\/www\.google\.com\/search\?tbm=map/

test('partage Android (ftid, sans coordonnées) : le lieu exact, par la recherche Google', async () => {
  const net = fakeFetch([
    ['https://maps.app.goo.gl/android', { status: 302, location: ANDROID_SHARE }],
    [GOOGLE_SEARCH, { html: searchResponse([
      { ftid: '0x47e66fe1a9a4e0f7:0x1', lat: 48.8606, lng: 2.3376, name: 'Louvre' },
      { ftid: EIFFEL_FTID, ...EIFFEL, name: 'Tour Eiffel' },
    ]) }],
  ])
  const r = await resolveMapsLink('https://maps.app.goo.gl/android', { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.deepEqual([r.body.lat, r.body.lng], [EIFFEL.lat, EIFFEL.lng], 'le résultat qui porte CE ftid, pas le premier')
  assert.equal(r.body.approximate, undefined)
  assert.equal(r.body.name, 'Tour Eiffel, Av. Gustave Eiffel, 75007 Paris')
  assert.ok(new URL(net.calls[1]).searchParams.get('q').startsWith('Tour Eiffel'))
})

test('les coordonnées ne viennent JAMAIS de la page (centre déduit de l’IP)', async () => {
  // Lien sans nom : la page n'est lue que pour le titre.
  const bare = `https://www.google.com/maps/place/data=!4m2!3m1!1s${EIFFEL_FTID}`
  const net = fakeFetch([
    [bare, { html: `${IP_CENTER_PAGE}<meta content="Tour Eiffel · Av. Gustave Eiffel, 75007 Paris" property="og:title">` }],
    [GOOGLE_SEARCH, { status: 429 }],
    [/^https:\/\/photon\.komoot\.io\//, { json: { features: [] } }],
  ])
  const r = await resolveMapsLink(bare, { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(r.body.name, 'Tour Eiffel')
  assert.equal(r.body.approximate, true)
  assert.ok(Math.abs(r.body.lat - EIFFEL.lat) < 0.05 && Math.abs(r.body.lng - EIFFEL.lng) < 0.05, 'la zone du ftid, à Paris')
})

test('un résultat Google hors de la zone du ftid est refusé', async () => {
  const net = fakeFetch([
    [GOOGLE_SEARCH, { html: searchResponse([{ ftid: EIFFEL_FTID, lat: 38.9072, lng: -77.0369, name: 'Tour Eiffel' }]) }],
    [/^https:\/\/photon\.komoot\.io\//, { json: { features: [] } }],
  ])
  const r = await resolveMapsLink(ANDROID_SHARE, { fetchImpl: net.impl })
  assert.equal(r.body.approximate, true)
  assert.ok(r.body.lat > 48 && r.body.lat < 49)
})

test('Google muet : OpenStreetMap orienté vers la zone du ftid, et seulement dedans', async () => {
  const photonHit = (lng, lat) => ({ json: { features: [{ geometry: { coordinates: [lng, lat] }, properties: { name: 'Tour Eiffel', city: 'Paris' } }] } })
  const near = fakeFetch([[GOOGLE_SEARCH, { status: 503 }], [/^https:\/\/photon\.komoot\.io\//, photonHit(2.2945, 48.8584)]])
  const r = await resolveMapsLink(ANDROID_SHARE, { fetchImpl: near.impl })
  assert.deepEqual([r.body.lat, r.body.lng, r.body.approximate], [48.8584, 2.2945, true])
  const photonCall = new URL(near.calls.at(-1))
  assert.ok(Number(photonCall.searchParams.get('lat')) > 48, 'recherche orientée vers la zone')

  // La « Tour Eiffel » de Las Vegas : trop loin, on garde la zone.
  const far = fakeFetch([[GOOGLE_SEARCH, { status: 503 }], [/^https:\/\/photon\.komoot\.io\//, photonHit(-115.172, 36.112)]])
  const r2 = await resolveMapsLink(ANDROID_SHARE, { fetchImpl: far.impl })
  assert.ok(r2.body.lat > 48 && r2.body.lat < 49)
})

test('un point sans nom (/maps/search/<lat>,<lng>) se lit directement', async () => {
  const point = 'https://www.google.com/maps/search/16.064556,+108.231402?entry=tts'
  const net = fakeFetch([['https://maps.app.goo.gl/point', { status: 302, location: point }]])
  const r = await resolveMapsLink('https://maps.app.goo.gl/point', { fetchImpl: net.impl })
  assert.deepEqual([r.body.lat, r.body.lng, r.body.name], [16.064556, 108.231402, ''])
})

test('sans ftid : OpenStreetMap retrouve le lieu, signalé approximatif', async () => {
  const shared = 'https://maps.google.com/?q=Gare+do+Oriente,+Lisboa'
  const net = fakeFetch([
    [/^https:\/\/photon\.komoot\.io\//, { json: { features: [{ geometry: { coordinates: [-9.0993, 38.7678] }, properties: { name: 'Gare do Oriente', city: 'Lisboa' } }] } }],
  ])
  const r = await resolveMapsLink(shared, { fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(r.body.approximate, true)
  assert.equal(r.body.lat, 38.7678)
  assert.equal(net.calls.length, 1, 'ni page, ni recherche Google')
})

test('rien trouvé nulle part : 422, avec le nom qu’on a pu lire', async () => {
  const shared = 'https://maps.google.com/?q=Endroit+introuvable'
  const net = fakeFetch([
    [/^https:\/\/photon\.komoot\.io\//, { json: { features: [] } }],
  ])
  const r = await resolveMapsLink(shared, { fetchImpl: net.impl })
  assert.equal(r.status, 422)
  assert.equal(r.body.name, 'Endroit introuvable')
})

test('recherche Google : le lieu au ftid donné, ou rien', () => {
  const text = searchResponse([{ ftid: EIFFEL_FTID, ...EIFFEL, name: 'Tour Eiffel' }])
  assert.deepEqual(findPlaceInSearch(text, EIFFEL_FTID), EIFFEL)
  assert.equal(findPlaceInSearch(text, '0x1:0x2'), null, 'le cadrage voisin n’est pas un lieu')
  assert.equal(findPlaceInSearch('<html>captcha</html>', EIFFEL_FTID), null)
})

test('titre dans le HTML', () => {
  assert.deepEqual(
    extractTitle('<meta content="Pastéis de Belém · R. de Belém 84, Lisboa" property="og:title">'),
    { name: 'Pastéis de Belém', address: 'R. de Belém 84, Lisboa' },
  )
  assert.equal(extractTitle('<meta property="og:title" content="Google Maps">'), null)
})
