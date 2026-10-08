// Génère public/trip-map/world.json : les contours des pays pour la carte du
// monde de Trip Planner (« Mes voyages »), d'après Natural Earth 1:110m
// (domaine public).
//
// Livré avec l'app (précaché par le service worker) : la carte du monde se
// dessine et reconnaît les pays sans réseau ni bibliothèque de carto.
//
//   node scripts/trip-world.mjs
//
// Format : { countries: [{ id: 'PT', parts: [[contour, trou, …], …] }] }, un
// « part » par terre (continent, île) : on allume l'île visitée, pas tout le
// pays — Ouvéa n'allume ni la métropole ni la Guyane.
// Contour = [lng, lat, lng, lat, …] en centièmes de degré (~1 km, bien assez
// à cette échelle).

import { mkdirSync, writeFileSync } from 'node:fs'

const SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`Natural Earth : HTTP ${res.status}`)
const { features } = await res.json()

const countries = []
for (const { properties: p, geometry: g } of features) {
  // ISO_A2_EH : le code « de fait » (France et Norvège valent -99 dans ISO_A2).
  const id = p.ISO_A2_EH
  // Pas de code (Chypre du Nord, Somaliland), ni l'Antarctique.
  if (!/^[A-Z]{2}$/.test(id) || id === 'AQ') continue
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const parts = []
  for (const polygon of polygons) {
    const rings = []
    for (const ring of polygon) {
      const flat = []
      let prev = null
      for (const [lng, lat] of ring) {
        const x = Math.round(lng * 100)
        const y = Math.round(lat * 100)
        if (prev && prev[0] === x && prev[1] === y) continue
        flat.push(x, y)
        prev = [x, y]
      }
      if (flat.length >= 6) rings.push(flat)
    }
    if (rings.length) parts.push(rings)
  }
  const existing = countries.find((c) => c.id === id)
  if (existing) existing.parts.push(...parts)
  else countries.push({ id, parts })
}

countries.sort((a, b) => a.id.localeCompare(b.id))
mkdirSync('public/trip-map', { recursive: true })
const json = JSON.stringify({ source: 'Natural Earth 1:110m', countries })
writeFileSync('public/trip-map/world.json', json)
console.log(`public/trip-map/world.json : ${countries.length} pays, ${Math.round(json.length / 1024)} Ko`)
