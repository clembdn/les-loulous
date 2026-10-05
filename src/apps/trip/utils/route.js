// Le parcours d'une journée, lu dans sa frise : ce que dessine la mini-carte,
// et les distances qu'on affiche entre deux étapes.
// Module pur, testé sous `node --test`.

import { hasCoords, haversineM } from './geo.js'

// Où se trouve un élément de la frise. Un trajet réservé n'a pas UN lieu mais
// deux : il est traité à part.
function locationOf(item) {
  if (item.type === 'stop') return item.stop
  if (item.type === 'checkin' || item.type === 'checkout') return item.stay
  return null
}

/**
 * Les points de la journée, dans l'ordre de la frise :
 *  · `stop` — une étape localisée, avec son numéro ;
 *  · `stay` — un hébergement qu'on quitte ou qu'on rejoint ;
 *  · `transport` — le départ et/ou l'arrivée d'un trajet réservé.
 * `segments` relie deux points consécutifs ; `booked` marque le tronçon d'un
 * trajet réservé, dessiné en pointillés — on ne trace pas la route d'un TGV.
 *
 * `home` est l'hébergement du soir quand il n'apparaît pas déjà dans la
 * journée (deuxième nuit au même endroit) : un repère, pas une étape.
 */
export function dayRoute(items, { home = null } = {}) {
  const points = []
  for (const item of items) {
    if (item.type === 'transport') {
      const t = item.transport
      if (item.phase !== 'arrival' && hasCoords(t.from)) {
        points.push({ key: `${item.key}:from`, lat: t.from.lat, lng: t.from.lng, kind: 'transport', mode: t.mode, transportId: t.id, name: t.from.name })
      }
      if (item.phase !== 'departure' && hasCoords(t.to)) {
        points.push({ key: `${item.key}:to`, lat: t.to.lat, lng: t.to.lng, kind: 'transport', mode: t.mode, transportId: t.id, name: t.to.name })
      }
      continue
    }
    const at = locationOf(item)
    if (!hasCoords(at)) continue
    if (item.type === 'stop') {
      points.push({ key: item.key, lat: at.lat, lng: at.lng, kind: 'stop', number: item.number, name: at.name })
    } else {
      points.push({ key: item.key, lat: at.lat, lng: at.lng, kind: 'stay', stayId: item.stay.id, name: at.name })
    }
  }

  const segments = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    segments.push({ from: i - 1, to: i, booked: !!a.transportId && a.transportId === b.transportId })
  }

  const homePoint = home && hasCoords(home) && !points.some((p) => p.stayId === home.id)
    ? { key: `home-${home.id}`, lat: home.lat, lng: home.lng, kind: 'home', stayId: home.id, name: home.name }
    : null

  return { points, segments, home: homePoint }
}

/**
 * Les distances à afficher DANS la frise, entre deux éléments consécutifs
 * localisés — sauf autour d'un trajet réservé, qui est lui-même le
 * déplacement. Rend `{ [clé du premier élément]: { distanceM, from, to } }`.
 */
export function timelineLegs(items) {
  const legs = {}
  for (let i = 1; i < items.length; i++) {
    const from = locationOf(items[i - 1])
    const to = locationOf(items[i])
    if (!hasCoords(from) || !hasCoords(to)) continue
    const distanceM = haversineM(from, to)
    // Deux fois le même endroit (on rend la chambre, on la reprend le soir) :
    // pas de « 0 m » à afficher.
    if (distanceM < 30) continue
    legs[items[i - 1].key] = { distanceM, from, to }
  }
  return legs
}
