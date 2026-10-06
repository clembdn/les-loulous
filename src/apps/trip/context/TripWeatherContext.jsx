import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useDebounced } from '@/shared/lib/useDebounced.js'
import { useOnline } from '@/shared/lib/useOnline.js'
import { useToday } from '@/shared/lib/useToday.js'
import { useTripData } from './TripDataContext.jsx'
import { readWeather, refreshWeather, subscribeWeather, weatherVersion } from '../services/weatherService.js'
import { tonightStay } from '../utils/nights.js'
import { hasCoords } from '../utils/geo.js'
import { weatherPlaces } from '../utils/weather.js'

/**
 * La météo du voyage ouvert, pour tous ses écrans.
 *
 * Les lieux de chaque jour à venir (étapes, trajets, hébergement du soir)
 * sont rassemblés ICI, et demandés en une fois : une requête de prévisions
 * pour toutes les villes du voyage, plutôt qu'une par écran ou par journée.
 * Les écrans lisent le cache (`weatherOf`, `dayWeather`) : instantané, et
 * disponible hors-ligne.
 */
const TripWeatherContext = createContext(null)

const NONE = []

export function TripWeatherProvider({ children }) {
  const today = useToday()
  const online = useOnline()
  const { dayKeys, timelines, stays } = useTripData()
  // Se redessiner quand le cache se complète.
  const version = useSyncExternalStore(subscribeWeather, weatherVersion)

  const placesByDate = useMemo(() => {
    const out = {}
    for (const date of dayKeys) {
      if (date >= today) out[date] = weatherPlaces(timelines[date] || NONE, tonightStay(date, stays))
    }
    return out
  }, [dayKeys, timelines, stays, today])

  const requests = useMemo(
    () => Object.entries(placesByDate).flatMap(([date, places]) => places.all.map((p) => ({ date, ...p }))),
    [placesByDate],
  )
  // Une étape glissée d'un jour à l'autre ne relance pas une requête à chaque
  // étape du geste : on attend que le voyage soit posé.
  const settled = useDebounced(requests, 800)

  useEffect(() => {
    if (online && settled.length) refreshWeather(settled, today)
  }, [settled, today, online])

  const value = useMemo(() => ({
    /** La météo d'un lieu ce jour-là (prévision, sinon normale), ou `null`. */
    weatherOf: (date, place) => (date >= today && hasCoords(place) ? readWeather(date, place) : null),
    /** Le ou les deux lieux qui résument la journée, avec leur météo connue. */
    dayWeather: (date) => (placesByDate[date]?.anchors || NONE)
      .map((place) => readWeather(date, place))
      .filter(Boolean),
    version,
  }), [placesByDate, today, version])

  return <TripWeatherContext.Provider value={value}>{children}</TripWeatherContext.Provider>
}

export function useTripWeather() {
  const ctx = useContext(TripWeatherContext)
  if (!ctx) throw new Error('useTripWeather doit être utilisé sous <TripWeatherProvider>')
  return ctx
}
