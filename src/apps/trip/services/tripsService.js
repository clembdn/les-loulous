import {
  doc, getDocs, onSnapshot, orderBy, query, setDoc, writeBatch,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { dateKey, optText, readMeta, stamp, text } from '../utils/fields.js'
import { tripDays } from '../utils/tripDates.js'
import { MAX_TRIP_PLACES, tripPlaces } from '../utils/world.js'
import { ALL_TRIP_PARTS, partCol, tripDoc, tripsCol } from './refs.js'
import { publicRefsOf } from './sharesService.js'

function normalizeTrip(raw) {
  const startDate = dateKey(raw.startDate)
  return {
    id: raw.id,
    title: text(raw.title, 120) || 'Voyage sans titre',
    startDate,
    endDate: dateKey(raw.endDate) || startDate,
    notes: optText(raw.notes, 2000),
    // Les lieux du voyage, résumés pour la carte du monde (cf. utils/world.js).
    // `null` : jamais résumé (voyage d'avant la V2·3).
    places: Array.isArray(raw.places) ? raw.places.filter(isPlace).slice(0, MAX_TRIP_PLACES) : null,
    ...readMeta(raw),
  }
}

function isPlace(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
}

function tripFields(fields) {
  return {
    title: text(fields.title, 120),
    startDate: dateKey(fields.startDate),
    endDate: dateKey(fields.endDate),
    notes: optText(fields.notes, 2000),
  }
}

export function subscribeToTrips(callback, onError) {
  const q = query(tripsCol(), orderBy('startDate', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalizeTrip({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Trip] trips error:', err)
    onError?.(err)
  })
}

/**
 * Crée un voyage et rend son id TOUT DE SUITE : l'écran y navigue sans
 * attendre le serveur. `done` est la promesse d'écriture, à ne jamais
 * attendre dans l'UI — hors-ligne, elle ne se résout qu'au retour du réseau.
 */
export function createTrip(fields, currentUid) {
  const ref = doc(tripsCol())
  const done = setDoc(ref, { ...tripFields(fields), ...stamp(null, currentUid) })
  return { id: ref.id, done }
}

// Fusion : un champ ajouté par une version plus récente de l'app survit à
// l'enregistrement depuis une plus ancienne.
export function updateTrip(trip, fields, currentUid) {
  return setDoc(tripDoc(trip.id), { ...tripFields(fields), ...stamp(trip, currentUid) }, { merge: true })
}

/**
 * Range le résumé des lieux du voyage (`tripPlaces`) : « Mes voyages » dessine
 * la carte du monde sans relire le contenu de chaque voyage.
 */
export function saveTripPlaces(trip, places, currentUid) {
  return setDoc(tripDoc(trip.id), { places, ...stamp(trip, currentUid) }, { merge: true })
}

/**
 * Résume un voyage jamais résumé (créé avant la carte du monde, ou jamais
 * rouvert depuis) : ses hébergements et ses jours, lus une fois.
 */
export async function summarizeTrip(trip, currentUid) {
  const [stays, days] = await Promise.all([getDocs(partCol(trip.id, 'stays')), getDocs(partCol(trip.id, 'days'))])
  const places = tripPlaces({
    stays: stays.docs.map((d) => d.data()),
    days: Object.fromEntries(days.docs.map((d) => [d.id, d.data()])),
    dayKeys: tripDays(trip),
  })
  return saveTripPlaces(trip, places, currentUid)
}

async function readParts(tripId) {
  const snaps = await Promise.all(ALL_TRIP_PARTS.map((part) => getDocs(partCol(tripId, part))))
  return Object.fromEntries(ALL_TRIP_PARTS.map((part, i) => [part, snaps[i]]))
}

/**
 * Ce que contient un voyage, pour dire AVANT de le supprimer ce qui part avec
 * lui. Lecture attendue (elle retombe sur le cache hors-ligne).
 */
export async function readTripContents(tripId) {
  const parts = await readParts(tripId)
  const stops = parts.days.docs.reduce((n, d) => n + (d.data().stops?.length || 0), 0)
  return {
    stays: parts.stays.size,
    transports: parts.transports.size,
    stops,
    attachments: parts.attachments.size,
    ideas: parts.ideas.size,
    shares: parts.shares.size,
  }
}

/** Les jours enregistrés, avec leur nombre d'étapes — avant de raccourcir un voyage. */
export async function readDayStopCounts(tripId) {
  const snap = await getDocs(partCol(tripId, 'days'))
  return snap.docs.map((d) => ({ date: d.id, stops: d.data().stops?.length || 0 }))
}

// Un lot Firestore plafonne à 500 opérations : on découpe avec de la marge.
const BATCH_LIMIT = 450

/**
 * Supprime le voyage ET tout ce qu'il contient, liens invités compris.
 *
 * Firestore ne supprime pas les sous-collections avec leur parent : sans ce
 * balayage, jours, hébergements et captures resteraient en base, invisibles
 * mais stockés. Les documents sont relus au moment même de supprimer, pour
 * emporter aussi ce que l'autre vient d'ajouter.
 */
export async function deleteTripCascade(tripId) {
  const parts = await readParts(tripId)
  const refs = Object.values(parts).flatMap((snap) => snap.docs.map((d) => d.ref))
  // Les vitrines des liens invités, hors du voyage : sans quoi ses invités le verraient encore.
  refs.push(...await publicRefsOf(parts.shares.docs.map((d) => d.id)))
  refs.push(tripDoc(tripId))
  const commits = []
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    commits.push(batch.commit())
  }
  return Promise.all(commits)
}
