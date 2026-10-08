import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useOnline } from '@/shared/lib/useOnline.js'
import { useToday } from '@/shared/lib/useToday.js'
import { useTrips } from '../context/TripsContext.jsx'
import { placeNamesVersion, readPlaceName, requestPlaceNames, subscribePlaceNames } from '../services/placeNames.js'
import { subscribeToVisited } from '../services/worldService.js'
import { prepareWorld, worldVisits } from '../utils/world.js'
import { tripStatus } from '../utils/tripDates.js'
import { nearIpCenter } from '../utils/misplaced.js'

// Les contours (Natural Earth 1:110m, cf. scripts/trip-world.mjs) : livrés
// avec l'app, chargés une fois, à la première carte du monde affichée.
let worldPromise = null
function loadWorld() {
  worldPromise ||= fetch('/trip-map/world.json')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((json) => prepareWorld(json.countries))
    .catch((err) => {
      worldPromise = null
      throw err
    })
  return worldPromise
}

const REGION_NAMES = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['fr'], { type: 'region' })
  : null

/** « Nouvelle-Calédonie », « Japon » : le nom d'un pays d'après son code. */
export function countryName(id) {
  try {
    return REGION_NAMES?.of(id) || id
  } catch {
    return id
  }
}

/**
 * Tout ce que montre la carte du monde : les voyages (leurs lieux résumés),
 * les pays et lieux saisis à la main, et ce qui s'en déduit — terres
 * allumées, halos, pays avec leurs villes et leurs voyages.
 */
export function useWorldVisits() {
  const { trips, isLoading: tripsLoading } = useTrips()
  const today = useToday()
  const online = useOnline()
  const [world, setWorld] = useState(null)
  const [failed, setFailed] = useState(false)
  const [visited, setVisited] = useState({ entries: [], meta: null, ready: false })
  const namesVersion = useSyncExternalStore(subscribePlaceNames, placeNamesVersion)

  useEffect(() => {
    let alive = true
    loadWorld().then((w) => alive && setWorld(w), () => alive && setFailed(true))
    return () => { alive = false }
  }, [])

  useEffect(() => subscribeToVisited(
    (v) => setVisited({ ...v, ready: true }),
    () => setVisited((v) => ({ ...v, ready: true })),
  ), [])

  // Les noms des villes, et leur pays selon Photon (Singapour, outre-mer).
  useEffect(() => {
    if (online) requestPlaceNames(trips.flatMap((t) => t.places || []))
  }, [online, trips])

  const manual = useMemo(() => visited.entries.map((x) => x.entry), [visited.entries])

  const visits = useMemo(() => {
    if (!world) return null
    return worldVisits({
      trips,
      manual,
      world,
      statusOf: (t) => tripStatus(t, today),
      hint: (p) => readPlaceName(p)?.countryCode || null,
    })
  }, [world, trips, manual, today, namesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const countries = useMemo(() => {
    if (!visits) return []
    return [...visits.countries.values()]
      .map((c) => ({
        ...c,
        name: countryName(c.id),
        cities: citiesOf(c),
        // Un lieu à Washington venu d'un lien Google Maps lu par l'ancien
        // résolveur (cf. utils/misplaced.js) : à corriger dans son voyage.
        suspicious: c.trips.filter(({ places }) => places.some(nearIpCenter)).map(({ trip }) => trip),
      }))
      .sort((a, b) => Number(b.visited) - Number(a.visited) || a.name.localeCompare(b.name, 'fr'))
  }, [visits, namesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    world,
    visits,
    countries,
    rawEntries: visited.entries,
    meta: visited.meta,
    isLoading: (!world && !failed) || tripsLoading || !visited.ready,
    failed,
  }
}

function citiesOf(country) {
  const names = new Set()
  for (const { places } of country.trips) {
    for (const p of places) {
      const name = readPlaceName(p)?.city
      if (name) names.add(name)
    }
  }
  for (const item of country.manual) if (item.kind !== 'country') names.add(item.name)
  return [...names]
}
