// Les cartes emportées hors-ligne : avant le départ, on télécharge les tuiles
// OpenFreeMap autour de chaque lieu du voyage, dans le cache que le service
// worker lit ensuite en priorité (cf. vite.config.js, `trip-map-tiles`).
//
// Appelé par le préchargement des voyages proches (offlineService), au plus
// une fois par jour et par voyage ; les tuiles déjà en cache ne sont pas
// retéléchargées. Gratuit et sans clé, mais pas sans politesse envers un
// service offert : un plafond par voyage, quatre requêtes à la fois.

import { planTiles, tileUrl, tripBounds } from '../utils/tiles.js'

const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
const TILE_CACHE = 'trip-map-tiles'
const META_CACHE = 'trip-map-meta'
const STYLE_URL = '/trip-map/style.json'
const STORAGE_KEY = 'trip:tilesAt'
const EVERY_MS = 24 * 60 * 60 * 1000
const CONCURRENCY = 4

// Les polices des étiquettes (latin de base et ponctuation : « Lisbonne »,
// « Côte », l'apostrophe typographique) et les pictogrammes.
const GLYPH_RANGES = ['0-255', '8192-8447']

const running = new Set()

function lastRun() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function remember(tripId) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...lastRun(), [tripId]: Date.now() }))
  } catch {
    // Navigation privée : on retentera à la prochaine ouverture.
  }
}

function offline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function styleAssets() {
  const style = await fetch(STYLE_URL).then((r) => r.json())
  const fonts = new Set()
  for (const layer of style.layers) {
    const stack = layer.layout?.['text-font']
    if (Array.isArray(stack)) fonts.add(stack.join(','))
  }
  // Même adresse que celle que demandera MapLibre (espaces encodés, virgules
  // laissées telles quelles) : sinon le cache ne la reconnaîtrait pas.
  const glyphs = [...fonts].flatMap((font) => GLYPH_RANGES.map((range) => new URL(style.glyphs
    .replace('{fontstack}', font)
    .replace('{range}', range)).href))
  const sprites = style.sprite ? ['.json', '.png', '@2x.json', '@2x.png'].map((ext) => `${style.sprite}${ext}`) : []
  return [...glyphs, ...sprites]
}

/** Télécharge `urls` dans le cache, sauf celles qui y sont déjà, quelques-unes à la fois. */
async function fill(cache, urls) {
  let next = 0
  async function worker() {
    while (next < urls.length && !offline()) {
      const url = urls[next++]
      if (await cache.match(url)) continue
      try {
        const res = await fetch(url, { mode: 'cors' })
        if (res.ok) await cache.put(url, res)
      } catch {
        // Une tuile ratée n'empêche pas les autres.
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

/**
 * Emporte les cartes d'un voyage. `content` : ce qu'on vient de lire depuis
 * Firestore, `{ stays, transports, days }` (documents bruts).
 */
export async function prefetchTripTiles(tripId, content) {
  if (typeof caches === 'undefined' || offline() || running.has(tripId)) return
  const last = lastRun()[tripId]
  if (last && Date.now() - last < EVERY_MS) return
  const bounds = tripBounds(content)
  if (!bounds.length) return

  running.add(tripId)
  try {
    // Le TileJSON d'abord : c'est lui qui donne l'adresse des tuiles, et sa
    // copie en cache permet de les retrouver hors-ligne.
    const res = await fetch(TILEJSON_URL, { mode: 'cors' })
    if (!res.ok) return
    const meta = await caches.open(META_CACHE)
    await meta.put(TILEJSON_URL, res.clone())
    const template = (await res.json()).tiles?.[0]
    if (!template) return

    const tiles = await caches.open(TILE_CACHE)
    const assets = await styleAssets().catch(() => [])
    await fill(tiles, [...assets, ...planTiles(bounds).map((t) => tileUrl(template, t))])
    if (!offline()) remember(tripId)
  } catch (err) {
    console.warn('[Trip] cartes hors-ligne incomplètes :', err)
  } finally {
    running.delete(tripId)
  }
}
