// Le récap d'un voyage terminé : ce qu'on a parcouru, vu, traversé.
//
// Les kilomètres sont ceux que l'app connaît, sans inventer :
//  · entre les lieux d'une même journée (la frise), par la route quand le
//    trajet a été calculé (OpenRouteService), à vol d'oiseau sinon — la part
//    estimée est rendue à part, pour la dire ;
//  · les trajets réservés (train, avion, bus, ferry), à vol d'oiseau : on ne
//    trace pas la route d'un avion. Une location de voiture n'est pas un
//    trajet (on la prend à une agence, on la rend à une autre) : les
//    kilomètres en voiture sont dans les journées.
//
// Module pur, testé sous `node --test`.

import { formatDistance, hasCoords, haversineM } from './geo.js'
import { routedLegs } from './legs.js'
import { timelineLegs } from './route.js'

// L'ordre d'affichage des façons de se déplacer.
export const RECAP_MODES = ['walk', 'bike', 'car', 'train', 'bus', 'ferry', 'flight', 'other']

const emptyModes = () => Object.fromEntries(RECAP_MODES.map((m) => [m, 0]))

/**
 * Les distances d'une journée : `{ byMode, totalM, estimatedM }` pour ses
 * trajets entre lieux (pas les trajets réservés, comptés une fois pour tout
 * le voyage). `stored` : les trajets rangés dans le jour (`days[date].legs`).
 */
export function dayDistances(items, stored = []) {
  const byMode = emptyModes()
  let totalM = 0
  let estimatedM = 0
  for (const leg of Object.values(routedLegs(timelineLegs(items), stored))) {
    const routed = leg.route?.status === 'ok' && Number.isFinite(leg.route.distanceM)
    const m = routed ? leg.route.distanceM : leg.distanceM
    byMode[leg.mode] += m
    totalM += m
    if (!routed) estimatedM += m
  }
  return { byMode, totalM, estimatedM }
}

/**
 * Tout le récap. `timelines` : la frise de chaque jour (`buildDayTimeline`).
 * Rend :
 *  · `distance` : `{ byMode, totalM, estimatedM }`, trajets réservés compris
 *    (toujours estimés : vol d'oiseau) ;
 *  · `perDay` : `[{ date, title, stops, distanceM }]` ;
 *  · `stops`, `located` (étapes localisées), `stays`, `nights`.
 */
export function tripRecap({ dayKeys, days, timelines, stays, transports, nights }) {
  const byMode = emptyModes()
  let totalM = 0
  let estimatedM = 0
  let stops = 0
  let located = 0

  const perDay = dayKeys.map((date) => {
    const list = days[date]?.stops || []
    stops += list.length
    located += list.filter(hasCoords).length
    const d = dayDistances(timelines[date] || [], days[date]?.legs || [])
    for (const m of RECAP_MODES) byMode[m] += d.byMode[m]
    totalM += d.totalM
    estimatedM += d.estimatedM
    return { date, title: days[date]?.title || null, stops: list.length, distanceM: d.totalM }
  })

  for (const t of transports) {
    if (t.mode === 'car' || !hasCoords(t.from) || !hasCoords(t.to)) continue
    const m = haversineM(t.from, t.to)
    const mode = RECAP_MODES.includes(t.mode) ? t.mode : 'other'
    byMode[mode] += m
    totalM += m
    estimatedM += m
  }

  return {
    distance: { byMode, totalM, estimatedM },
    perDay,
    stops,
    located,
    stays: stays.length,
    nights: nights.filter((n) => n.stays.length > 0).length,
  }
}

/**
 * Les pays et villes d'un voyage, d'après ses lieux (`tripPlaces` de
 * utils/world.js, les plus fréquentés d'abord). `countryOf(lieu)` et
 * `cityOf(lieu)` : codes et noms connus (contours, Photon), ou `null`.
 * Rend `[{ id, cities: [nom] }]`, les pays dans l'ordre où le voyage y passe
 * le plus, les villes sans doublon.
 */
export function tripCountries(places, countryOf, cityOf) {
  const byId = new Map()
  for (const place of places) {
    const id = countryOf(place)
    if (!id) continue
    if (!byId.has(id)) byId.set(id, { id, cities: [], n: 0 })
    const entry = byId.get(id)
    entry.n += 1
    const city = cityOf(place)
    if (city && !entry.cities.includes(city)) entry.cities.push(city)
  }
  return [...byId.values()].sort((a, b) => b.n - a.n).map(({ id, cities }) => ({ id, cities }))
}

const KM = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** « 850 m », « 4,2 km », « 1 734 km » : comme `formatDistance`, milliers séparés. */
export function formatKm(meters) {
  if (!Number.isFinite(meters)) return ''
  if (meters < 9950) return formatDistance(meters)
  return `${KM.format(Math.round(meters / 1000))} km`
}

/** Le drapeau d'un code pays ISO à deux lettres (« PT » → 🇵🇹), ou ''. */
export function flagOf(code) {
  if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65))
}
