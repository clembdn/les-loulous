import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useOnline } from '@/shared/lib/useOnline.js'
import { useTripData } from '../context/TripDataContext.jsx'
import { placeNamesVersion, readPlaceName, requestPlaceNames, subscribePlaceNames } from '../services/placeNames.js'
import { routedLegs } from '../utils/legs.js'
import { timelineLegs } from '../utils/route.js'
import { tripCountries, tripRecap } from '../utils/recap.js'
import { countryAt, tripPlaces } from '../utils/world.js'
import { loadWorld } from './useWorldVisits.js'

/**
 * Le récap du voyage ouvert (cf. utils/recap.js) : ses chiffres, de quoi
 * dessiner tout le trajet sur une carte, ses pays et ses villes.
 *
 * Les pays viennent des contours du monde (chargés à la demande) corrigés
 * par Photon, les villes de Photon : comme la carte du monde, mêmes caches.
 * `countries` vaut `null` tant que les contours ne sont pas là (sans eux,
 * les pays connus de Photon seulement).
 */
export function useTripRecap() {
  const online = useOnline()
  const { dayKeys, days, timelines, stays, transports, nights } = useTripData()
  const [world, setWorld] = useState(null)
  const namesVersion = useSyncExternalStore(subscribePlaceNames, placeNamesVersion)

  const recap = useMemo(
    () => tripRecap({ dayKeys, days, timelines, stays, transports, nights }),
    [dayKeys, days, timelines, stays, transports, nights],
  )

  // Tout le voyage d'un trait : les frises des jours bout à bout (leurs clés
  // ne se répètent pas d'un jour à l'autre), et les tracés calculés de chacun.
  const route = useMemo(() => ({
    items: dayKeys.flatMap((date) => timelines[date] || []),
    legs: Object.assign({}, ...dayKeys.map((date) => routedLegs(timelineLegs(timelines[date] || []), days[date]?.legs || []))),
  }), [dayKeys, timelines, days])

  const places = useMemo(() => tripPlaces({ stays, days, dayKeys }), [stays, days, dayKeys])

  // `false` : contours introuvables — les pays viendront de Photon seul.
  useEffect(() => {
    let alive = true
    loadWorld().then((w) => alive && setWorld(w), () => alive && setWorld(false))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (online && places.length) requestPlaceNames(places)
  }, [online, places])

  const countries = useMemo(() => {
    if (world === null) return null
    return tripCountries(
      places,
      (p) => readPlaceName(p)?.countryCode || (world ? countryAt(p, world) : null),
      (p) => readPlaceName(p)?.city || null,
    )
  }, [world, places, namesVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return { recap, route, countries }
}
