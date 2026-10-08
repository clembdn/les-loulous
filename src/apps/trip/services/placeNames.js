import { photonCity, photonReverseUrl } from '../utils/photon.js'

// Les noms des villes visitées, pour la carte du monde : demandés à Photon
// (recherche inverse, gratuite, sans clé) une fois par lieu, puis gardés pour
// toujours sur l'appareil — une ville ne change pas de nom. Donnée dérivée,
// propre à l'appareil : localStorage, comme la météo, jamais Firestore.
//
// Photon dit aussi le PAYS : il corrige les contours simplifiés de la carte,
// où Singapour ou Malte n'existent pas.

const STORAGE_KEY = 'trip:placeNames'
const MAX_ENTRIES = 500
// Photon est un service partagé : une requête à la fois, sans se presser.
const GAP_MS = 350

let cache = null
let version = 0
const listeners = new Set()
const queue = []
const queued = new Set()
const failed = new Set()
let running = false

function load() {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    cache = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    cache = {}
  }
  return cache
}

function save() {
  const entries = Object.entries(cache)
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    cache = Object.fromEntries(entries.slice(0, MAX_ENTRIES))
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Quota plein, navigation privée : les noms vivront le temps de la session.
  }
}

export function placeKey(place) {
  return `${place.lat.toFixed(2)},${place.lng.toFixed(2)}`
}

/** `{ city, countryCode }` déjà connus pour ce lieu, ou `null`. Lecture synchrone. */
export function readPlaceName(place) {
  return load()[placeKey(place)] || null
}

export function subscribePlaceNames(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function placeNamesVersion() {
  return version
}

/** Demande les noms qui manquent, en tâche de fond (en ligne seulement). */
export function requestPlaceNames(places) {
  load()
  for (const place of places) {
    const key = placeKey(place)
    if (cache[key] || queued.has(key) || failed.has(key)) continue
    queued.add(key)
    queue.push({ key, place })
  }
  if (!running) run()
}

async function run() {
  running = true
  while (queue.length && navigator.onLine !== false) {
    const { key, place } = queue.shift()
    try {
      const res = await fetch(photonReverseUrl(place))
      const found = res.ok ? photonCity(await res.json()) : null
      if (found) {
        cache[key] = { ...found, at: Date.now() }
        save()
        version += 1
        listeners.forEach((fn) => fn())
      } else {
        failed.add(key)
      }
    } catch {
      failed.add(key)
    } finally {
      queued.delete(key)
    }
    await new Promise((resolve) => { setTimeout(resolve, GAP_MS) })
  }
  // Coupé en route : le reste attendra le prochain affichage.
  queue.forEach(({ key }) => queued.delete(key))
  queue.length = 0
  running = false
}
