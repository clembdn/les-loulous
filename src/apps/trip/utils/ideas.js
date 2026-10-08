// La liste « à caser » : des lieux repérés, pas encore placés dans un jour.
// Où les placer ? Là où l'on sera déjà : le jour dont les lieux (étapes,
// hébergements, gares) sont les plus proches.
// Module pur, testé sous `node --test`.

import { hasCoords, haversineM } from './geo.js'

// Au-delà, un jour n'est plus « près » d'un lieu : on ne le suggère pas.
export const NEAR_DAY_M = 50_000
// Ce qu'une journée montre sous sa frise : ce qui se fait dans la foulée.
export const NEAR_IDEA_M = 15_000
// Deux jours à la même distance (le même hôtel), à 100 m près.
const SAME_DISTANCE_M = 100

const coords = (p) => ({ lat: p.lat, lng: p.lng })

/**
 * Les points localisés de chaque jour : ses étapes, l'hébergement qu'on
 * quitte le matin et celui du soir, les gares et aéroports de ses trajets.
 * `{ [date]: [{ lat, lng }] }`, un jour sans lieu connu a une liste vide.
 */
export function dayPoints(dayKeys, timelines, nights) {
  const out = {}
  dayKeys.forEach((date, i) => {
    const points = []
    for (const item of timelines[date] || []) {
      if (item.type === 'stop' && hasCoords(item.stop)) points.push(coords(item.stop))
      else if ((item.type === 'checkin' || item.type === 'checkout') && hasCoords(item.stay)) points.push(coords(item.stay))
      else if (item.type === 'transport') {
        const t = item.transport
        if (item.phase !== 'arrival' && hasCoords(t.from)) points.push(coords(t.from))
        if (item.phase !== 'departure' && hasCoords(t.to)) points.push(coords(t.to))
      }
    }
    const morning = i > 0 ? nights[i - 1]?.stays?.[0] : null
    const tonight = nights[i]?.stays?.[0]
    for (const stay of [morning, tonight]) if (hasCoords(stay)) points.push(coords(stay))
    out[date] = points
  })
  return out
}

/** Distance d'un lieu au plus proche des points d'un jour, `Infinity` sans point. */
export function distanceToPoints(place, points) {
  if (!hasCoords(place)) return Infinity
  let best = Infinity
  for (const p of points || []) best = Math.min(best, haversineM(place, p))
  return best
}

/**
 * Les jours où caser un lieu, du plus proche au plus lointain (≤ `maxM`).
 * À distance égale (souvent : le même hôtel plusieurs nuits), le jour le
 * moins chargé d'abord, puis le plus tôt. `stopCounts` : `{ [date]: n }`.
 * Rend `[{ date, distanceM }]`.
 */
export function rankDays(place, pointsByDate, { stopCounts = {}, maxM = NEAR_DAY_M } = {}) {
  if (!hasCoords(place)) return []
  return Object.entries(pointsByDate)
    .map(([date, points]) => ({ date, distanceM: distanceToPoints(place, points) }))
    .filter((d) => d.distanceM <= maxM)
    .sort((a, b) => {
      if (Math.abs(a.distanceM - b.distanceM) > SAME_DISTANCE_M) return a.distanceM - b.distanceM
      const load = (stopCounts[a.date] || 0) - (stopCounts[b.date] || 0)
      return load || a.date.localeCompare(b.date)
    })
}

/** Le jour suggéré pour un lieu, ou `null`. */
export function closestDay(place, pointsByDate, options) {
  return rankDays(place, pointsByDate, options)[0] || null
}

/** Les lieux à caser près d'une journée, du plus proche au plus lointain. Rend `[{ idea, distanceM }]`. */
export function ideasNear(ideas, points, maxM = NEAR_IDEA_M) {
  if (!points?.length) return []
  return ideas
    .map((idea) => ({ idea, distanceM: distanceToPoints(idea, points) }))
    .filter((x) => x.distanceM <= maxM)
    .sort((a, b) => a.distanceM - b.distanceM)
}

/** Les derniers repérés en premier. */
export function sortIdeas(ideas) {
  return [...ideas].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.name.localeCompare(b.name))
}

/** Une idée devient une étape (même identifiant : « Annuler » la retrouve). */
export function ideaToStop(idea, time = null) {
  return {
    id: idea.id,
    name: idea.name,
    address: idea.address ?? null,
    lat: idea.lat ?? null,
    lng: idea.lng ?? null,
    mapsUrl: idea.mapsUrl ?? null,
    time: time || null,
    durationMin: null,
    category: idea.category,
    notes: idea.notes || '',
  }
}

/** Une étape repart à caser : son heure ne veut plus rien dire, sa durée non plus. */
export function stopToIdea(stop) {
  return {
    id: stop.id,
    name: stop.name,
    address: stop.address ?? null,
    lat: stop.lat ?? null,
    lng: stop.lng ?? null,
    mapsUrl: stop.mapsUrl ?? null,
    category: stop.category,
    notes: stop.notes || '',
  }
}
