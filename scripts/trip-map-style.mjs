// Génère public/trip-map/style.json : le style « Lagon » des cartes de Trip
// Planner, dérivé de « Positron » d'OpenFreeMap (gratuit, sans clé).
//
// Le style est livré avec l'app (précaché par le service worker) : la carte
// sait se dessiner sans réseau, seules les tuiles viennent d'OpenFreeMap et
// sont mises en cache à part (cf. vite.config.js, services/mapTiles.js).
//
//   node scripts/trip-map-style.mjs
//
// À relancer seulement pour changer les couleurs ou suivre une évolution du
// style Positron.

import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'https://tiles.openfreemap.org/styles'

// Terre claire et chaude, eau teintée lagon, parcs d'un vert doux : la carte
// reste un fond, les repères colorés et le tracé passent devant.
const PAINT = {
  background: { 'background-color': '#F3F2EE' },
  park: { 'fill-color': '#DCEAD6' },
  landcover_wood: { 'fill-color': '#D3E5CF' },
  water: { 'fill-color': '#B9DEE8' },
  waterway: { 'line-color': '#A6D3E0' },
  landuse_residential: { 'fill-color': '#EEECE6' },
  building: { 'fill-color': '#E6E3DC', 'fill-outline-color': '#DAD6CD' },
  highway_minor: { 'line-color': '#FFFFFF' },
  highway_major_casing: { 'line-color': '#DCD8CF' },
  highway_motorway_casing: { 'line-color': '#D6D1C6' },
  water_name_point_label: { 'text-color': '#2C7A90' },
  water_name_line_label: { 'text-color': '#2C7A90' },
  label_city: { 'text-color': '#22262D' },
  label_city_capital: { 'text-color': '#22262D' },
  label_town: { 'text-color': '#30353D' },
  label_village: { 'text-color': '#4A505A' },
  label_other: { 'text-color': '#5A6270' },
}

// Les noms en français quand OpenStreetMap les connaît (« Lisbonne »), sinon
// en alphabet latin, sinon tels quels.
const FRENCH_NAME = ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']]

// Les lieux d'intérêt de « Liberty » (musées, plages, gares…), discrets : ils
// n'apparaissent qu'en zoomant (z15+), là où l'on cherche ce qu'il y a autour.
const POI_LAYERS = ['poi_r1', 'poi_r7', 'poi_transit']

async function load(name) {
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`)
  return res.json()
}

const [positron, liberty] = await Promise.all([load('positron'), load('liberty')])

const style = structuredClone(positron)
style.name = 'Loulous · Lagon'
// Les cartouches d'autoroute (A2, E1…) n'aident pas à lire une journée.
style.layers = style.layers.filter((layer) => !/shield/.test(layer.id))
for (const layer of style.layers) {
  Object.assign((layer.paint ||= {}), PAINT[layer.id] || {})
  if (layer.type === 'symbol' && ['place', 'water_name'].includes(layer['source-layer'])) {
    layer.layout['text-field'] = FRENCH_NAME
  }
}

const pois = liberty.layers
  .filter((layer) => POI_LAYERS.includes(layer.id))
  .map((layer) => ({
    ...layer,
    layout: { ...layer.layout, 'text-field': FRENCH_NAME },
    paint: { ...layer.paint, 'text-color': '#5A6270', 'text-halo-color': '#F3F2EE', 'icon-opacity': 0.8 },
  }))
const at = style.layers.findIndex((layer) => layer.id === 'label_other')
style.layers.splice(at === -1 ? style.layers.length : at, 0, ...pois)

mkdirSync('public/trip-map', { recursive: true })
writeFileSync('public/trip-map/style.json', JSON.stringify(style))
console.log(`public/trip-map/style.json : ${style.layers.length} couches, ${Math.round(JSON.stringify(style).length / 1024)} Ko`)
