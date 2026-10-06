import { getDocsFromServer } from 'firebase/firestore'
import { tripsToPrewarm } from '../utils/tripDates.js'
import { partCol, TRIP_PARTS } from './refs.js'

// Ce qui est emporté hors-ligne, et depuis quand.
//
// Le cache IndexedDB de Firestore (shared/lib/firebase.js) garde tout
// document déjà lu, captures comprises. Il reste à savoir deux choses :
//  · QUAND un voyage a été lu en entier depuis le serveur pour la dernière
//    fois — c'est « disponible hors-ligne · synchro 14:32 » ;
//  · qu'il l'a bien été AVANT de partir, même si on n'a pas rouvert ses
//    jours : les voyages en cours ou qui partent sous 14 jours sont relus à
//    l'ouverture de l'app (`prewarmTrips`).
//
// L'heure de synchro est propre à l'appareil — c'est SON cache qu'elle
// décrit — donc en localStorage, pas dans Firestore.

const STORAGE_KEY = 'trip:syncedAt'
// Un voyage relu il y a moins d'une heure n'a pas besoin de l'être encore.
const PREWARM_EVERY_MS = 60 * 60 * 1000

let syncedAt = null
const listeners = new Set()
const warming = new Set()

function load() {
  if (syncedAt) return syncedAt
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    syncedAt = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    syncedAt = {}
  }
  return syncedAt
}

function update(next) {
  syncedAt = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota plein, navigation privée : l'indicateur vivra le temps de la session.
  }
  listeners.forEach((fn) => fn())
}

/** Dernière lecture complète du voyage depuis le serveur, en ms, ou `null`. */
export function getSyncedAt(tripId) {
  return load()[tripId] ?? null
}

export function subscribeSynced(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function markSynced(tripId, at = Date.now()) {
  update({ ...load(), [tripId]: at })
}

/**
 * Relit depuis le serveur les voyages en cours ou tout proches — de quoi les
 * retrouver entiers, captures comprises, dans un avion ou une vallée sans
 * réseau, même sans avoir ouvert leurs jours avant de partir.
 *
 * `getDocsFromServer` plutôt que `getDocs` : en cas de coupure, une lecture
 * normale retomberait en silence sur le cache, et on noterait « synchro » ce
 * qui n'en est pas une. Ce qu'il lit atterrit dans le cache persistant.
 */
export function prewarmTrips(trips, today) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  // Oublier les voyages supprimés depuis.
  const known = load()
  const ids = new Set(trips.map((t) => t.id))
  if (Object.keys(known).some((id) => !ids.has(id))) {
    update(Object.fromEntries(Object.entries(known).filter(([id]) => ids.has(id))))
  }

  for (const trip of tripsToPrewarm(trips, today)) {
    const last = getSyncedAt(trip.id)
    if (warming.has(trip.id) || (last && Date.now() - last < PREWARM_EVERY_MS)) continue
    warming.add(trip.id)
    Promise.all(TRIP_PARTS.map((part) => getDocsFromServer(partCol(trip.id, part))))
      .then(() => markSynced(trip.id))
      .catch((err) => console.warn('[Trip] préchargement impossible :', err))
      .finally(() => warming.delete(trip.id))
  }
}
