import { useMemo } from 'react'
import { useTripData } from '../context/TripDataContext.jsx'
import { tonightStay } from '../utils/nights.js'
import { timelineLegs } from '../utils/route.js'
import { routedLegs } from '../utils/legs.js'
import { dayRouteUrl } from '../utils/mapsUrl.js'
import { hasCoords } from '../utils/geo.js'

const NO_ITEMS = []

/**
 * Tout ce qu'affiche une journée, quel que soit l'écran (téléphone, éditeur
 * desktop, Aujourd'hui) : sa frise, les trajets entre ses lieux (calculés
 * quand ils le sont, à vol d'oiseau sinon), l'hébergement du soir, le lien
 * vers le parcours complet dans Google Maps.
 */
export function useDayView(date) {
  const { days, dayKeys, timelines, stays, colorIndexByStay, attachmentsByParent } = useTripData()
  const day = days[date] || null
  const items = timelines[date] || NO_ITEMS

  return useMemo(() => {
    const tonight = tonightStay(date, stays)
    const stopsWithCoords = items
      .filter((it) => it.type === 'stop' && hasCoords(it.stop))
      .map((it) => it.stop)
    // Où l'on est ce jour-là, pour orienter la recherche de lieux : la
    // dernière étape localisée, sinon l'hébergement du soir.
    const lastStop = stopsWithCoords[stopsWithCoords.length - 1]
    const nearPlace = lastStop || (hasCoords(tonight) ? tonight : null)
    return {
      day,
      items,
      legs: routedLegs(timelineLegs(items), day?.legs),
      stopCount: items.filter((it) => it.type === 'stop').length,
      tonight,
      tonightColor: tonight ? colorIndexByStay[tonight.id] : 0,
      tonightAttachments: tonight ? attachmentsByParent[tonight.id] || [] : [],
      isLastDay: date === dayKeys[dayKeys.length - 1],
      dayNumber: dayKeys.indexOf(date) + 1,
      routeUrl: dayRouteUrl(stopsWithCoords),
      near: nearPlace ? { lat: nearPlace.lat, lng: nearPlace.lng } : null,
    }
  }, [date, day, items, stays, colorIndexByStay, attachmentsByParent, dayKeys])
}
