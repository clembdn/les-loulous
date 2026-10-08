// Trajets calculés entre deux lieux d'une journée (V2) : voiture, marche, vélo.
//
// Calculés UNE fois (OpenRouteService, via api/route.js) puis rangés dans le
// document du jour (`days/{date}.legs`) : rouvrir la journée, la consulter
// hors-ligne ou la montrer à un invité ne coûte aucun appel.
//
// Un trajet est reconnu par ses deux bouts (coordonnées arrondies au mètre),
// pas par les étapes : réordonner la journée garde les trajets déjà connus,
// et une étape déplacée de quelques kilomètres en réclame un nouveau.
//
// Module pur, testé sous `node --test`.

import { formatDistance, hasCoords } from './geo.js'
import { decodePolyline } from './polyline.js'

export const LEG_MODES = [
  { id: 'walk', label: 'À pied', travelmode: 'walking', profile: 'foot-walking' },
  { id: 'bike', label: 'Vélo', travelmode: 'bicycling', profile: 'cycling-regular' },
  { id: 'car', label: 'Voiture', travelmode: 'driving', profile: 'driving-car' },
]
export const LEG_MODE_IDS = LEG_MODES.map((m) => m.id)
const BY_ID = Object.fromEntries(LEG_MODES.map((m) => [m.id, m]))

export function getLegMode(id) {
  return BY_ID[id] || BY_ID.car
}

// Au-delà, on ne marche plus : on prend la voiture (modifiable trajet par trajet).
export const WALKING_MAX_M = 1500

// Plafond des règles Firestore (`legs.size() <= 60`).
export const MAX_LEGS_PER_DAY = 60

// OpenRouteService accepte 50 points par requête.
export const MAX_RUN_POINTS = 50

export function autoMode(distanceM) {
  return distanceM <= WALKING_MAX_M ? 'walk' : 'car'
}

// En entiers (1e-5 degré ≈ 1 m) : un point déjà arrondi et le même point
// brut donnent la même clé, sans les caprices de `toFixed`.
function coordKey(p) {
  return `${Math.round(p.lat * 1e5)},${Math.round(p.lng * 1e5)}`
}

export function legKey(from, to) {
  return `${coordKey(from)}>${coordKey(to)}`
}

function point(raw) {
  const lat = Number(raw?.lat)
  const lng = Number(raw?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 }
    : null
}

const optNum = (v) => (Number.isFinite(v) && v >= 0 ? v : null)

/**
 * Un trajet rangé dans un jour :
 *   { from, to, mode, manual, status, distanceM, durationS, polyline }
 * `status` : 'ok' (calculé), 'none' (aucune route : île, frontière fermée —
 * on ne redemande pas), 'pending' (mode changé à la main, à recalculer).
 * `manual` : le mode a été choisi, il ne suit plus la distance.
 */
export function normalizeLeg(raw) {
  const from = point(raw?.from)
  const to = point(raw?.to)
  if (!from || !to) return null
  const status = ['ok', 'none'].includes(raw.status) ? raw.status : 'pending'
  return {
    from,
    to,
    mode: LEG_MODE_IDS.includes(raw.mode) ? raw.mode : 'car',
    manual: raw.manual === true,
    status,
    distanceM: status === 'ok' ? optNum(raw.distanceM) : null,
    durationS: status === 'ok' ? optNum(raw.durationS) : null,
    polyline: status === 'ok' && typeof raw.polyline === 'string' ? raw.polyline : null,
  }
}

export function normalizeLegs(list) {
  return (Array.isArray(list) ? list : []).map(normalizeLeg).filter(Boolean).slice(0, MAX_LEGS_PER_DAY)
}

/**
 * Les trajets de la frise (`timelineLegs`, à vol d'oiseau) complétés par ce
 * qui est rangé dans le jour. Même forme, mêmes clés, plus :
 *   · `key` — les deux bouts ;
 *   · `mode` — choisi à la main, sinon d'après la distance ;
 *   · `manual` ;
 *   · `route` — le trajet calculé dans ce mode, ou `null` s'il manque.
 */
export function routedLegs(timelineLegs, stored = []) {
  const byKey = new Map(stored.map((l) => [legKey(l.from, l.to), l]))
  const out = {}
  for (const [itemKey, leg] of Object.entries(timelineLegs)) {
    if (!hasCoords(leg.from) || !hasCoords(leg.to)) continue
    const key = legKey(leg.from, leg.to)
    const saved = byKey.get(key)
    const manual = !!saved?.manual
    const mode = manual ? saved.mode : autoMode(leg.distanceM)
    const route = saved && saved.mode === mode && saved.status !== 'pending' ? saved : null
    out[itemKey] = { ...leg, key, mode, manual, route }
  }
  return out
}

/** Les trajets d'une journée qu'il reste à calculer, dans l'ordre de la frise. */
export function missingLegs(routed) {
  return Object.values(routed).filter((l) => !l.route)
}

/**
 * Regroupe les trajets à calculer en « courses » : des trajets qui
 * s'enchaînent (l'arrivée de l'un est le départ du suivant) dans le même
 * mode partent en UNE requête, A → B → C, au lieu d'une par tronçon.
 * Rend `[{ mode, legs, points }]`, `points` = les lieux traversés.
 */
export function legRuns(missing) {
  const runs = []
  let run = null
  for (const leg of missing) {
    const chained = run
      && run.mode === leg.mode
      && coordKey(run.points.at(-1)) === coordKey(leg.from)
      && run.points.length < MAX_RUN_POINTS
    if (chained) {
      run.legs.push(leg)
      run.points.push(point(leg.to))
    } else {
      run = { mode: leg.mode, legs: [leg], points: [point(leg.from), point(leg.to)] }
      runs.push(run)
    }
  }
  return runs
}

/**
 * Ce qu'on range dans le jour après un calcul : les trajets de la journée
 * actuelle seulement (ceux d'un ancien ordre disparaissent), calculés ou
 * déjà connus. `results` : `{ [key]: { status, distanceM, durationS, polyline } }`.
 */
export function mergeLegs(routed, results) {
  return Object.values(routed).slice(0, MAX_LEGS_PER_DAY).map((leg) => {
    const base = { from: point(leg.from), to: point(leg.to), mode: leg.mode, manual: leg.manual }
    const r = results[leg.key] || leg.route
    if (!r) return { ...base, status: 'pending', distanceM: null, durationS: null, polyline: null }
    return {
      ...base,
      status: r.status === 'ok' ? 'ok' : 'none',
      distanceM: r.status === 'ok' ? r.distanceM : null,
      durationS: r.status === 'ok' ? r.durationS : null,
      polyline: r.status === 'ok' ? r.polyline : null,
    }
  })
}

/**
 * Change le mode d'un trajet : rangé « à la main », à recalculer. Revenir au
 * mode que donnerait la distance le rend de nouveau automatique.
 */
export function withLegMode(stored, leg, mode) {
  const key = leg.key
  const others = stored.filter((l) => legKey(l.from, l.to) !== key)
  const manual = mode !== autoMode(leg.distanceM)
  return [
    ...others,
    { from: point(leg.from), to: point(leg.to), mode, manual, status: 'pending', distanceM: null, durationS: null, polyline: null },
  ].slice(-MAX_LEGS_PER_DAY)
}

/**
 * Les tracés calculés d'une journée (`routedLegs`), prêts pour la carte :
 * `Map(clé des deux bouts → [[lng, lat], …])`.
 */
export function routeLines(routed) {
  const lines = new Map()
  for (const leg of Object.values(routed || {})) {
    if (leg.route?.status !== 'ok' || !leg.route.polyline) continue
    const points = decodePolyline(leg.route.polyline)
    if (points.length >= 2) lines.set(leg.key, points.map(([lat, lng]) => [lng, lat]))
  }
  return lines
}

/** « 4 min », « 1 h 05 », « 12 h » : une durée de trajet, arrondie à la minute. */
export function formatTravel(seconds) {
  if (!Number.isFinite(seconds)) return ''
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/**
 * Ce qu'on écrit d'un trajet dans la frise : « 16 min · 1,3 km » s'il est
 * calculé, « ≈ 1,3 km » (à vol d'oiseau) sinon.
 */
export function legSummary(leg) {
  const ok = leg?.route?.status === 'ok'
  return {
    routed: ok,
    text: ok
      ? [formatTravel(leg.route.durationS), formatDistance(leg.route.distanceM)].filter(Boolean).join(' · ')
      : `≈ ${formatDistance(leg?.distanceM)}`,
  }
}
