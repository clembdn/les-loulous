// Les lieux placés à Washington par l'ancien résolveur de liens Google Maps.
//
// Avant le correctif du 2026-10-06 (commit 6498050), un lien partagé depuis
// l'app Android, qui ne porte pas de coordonnées, était placé au centre de la
// carte que Google calcule d'après l'IP du serveur (Vercel, région iad1) :
// toujours le même point, 38.9072, -77.0369. Ces lieux gardent leur lien :
// le relire avec le résolveur actuel les remet à leur place.
//
// Module pur, testé sous `node --test`.

import { haversineM } from './geo.js'

export const IP_CENTER = { lat: 38.9072, lng: -77.0369 }

/** Un lieu placé par le bug : au point exact (à 200 m près), avec un lien à relire. */
export function isMisplaced(place) {
  return !!place?.mapsUrl
    && Number.isFinite(place.lat) && Number.isFinite(place.lng)
    && haversineM(place, IP_CENTER) < 200
}

/** Un lieu résumé de la carte du monde (case de 0,1°) qui contient ce point. */
export function nearIpCenter(place) {
  return Number.isFinite(place?.lat) && haversineM(place, IP_CENTER) < 15000
}

/**
 * Tout ce qui est mal placé dans un voyage : étapes (par jour), hébergements,
 * départs et arrivées de trajets. Rend `[{ kind, id, date?, end?, place }]`.
 */
export function misplacedIn({ days, stays, transports }) {
  const out = []
  for (const [date, day] of Object.entries(days)) {
    for (const stop of day.stops || []) if (isMisplaced(stop)) out.push({ kind: 'stop', id: stop.id, date, place: stop })
  }
  for (const stay of stays) if (isMisplaced(stay)) out.push({ kind: 'stay', id: stay.id, place: stay })
  for (const t of transports) {
    for (const end of ['from', 'to']) if (isMisplaced(t[end])) out.push({ kind: 'transport', id: t.id, end, place: t[end] })
  }
  return out
}
