import { useEffect, useMemo } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useTripConfirmed, useTripData } from '../context/TripDataContext.jsx'
import { saveTripPlaces } from '../services/tripsService.js'
import { samePlaces, tripPlaces } from '../utils/world.js'

// Laisser retomber une rafale de modifications.
const DELAY_MS = 2000

/**
 * Tient à jour le résumé des lieux du voyage ouvert (`trip.places`), lu par
 * la carte du monde de « Mes voyages ». Écrit seulement s'il a changé, et
 * seulement sur des données confirmées par le serveur (cf. TripSharesContext).
 */
export function useTripPlaces() {
  const { currentUid } = useAuth()
  const { trip, stays, days, dayKeys, isLoading } = useTripData()
  const isConfirmed = useTripConfirmed()
  const places = useMemo(() => tripPlaces({ stays, days, dayKeys }), [stays, days, dayKeys])
  const stale = !isLoading && isConfirmed && !samePlaces(trip.places, places)

  useEffect(() => {
    if (!stale) return undefined
    const timer = setTimeout(() => {
      saveTripPlaces(trip, places, currentUid).catch((err) => console.warn('[Trip] lieux non résumés :', err))
    }, DELAY_MS)
    return () => clearTimeout(timer)
  }, [stale, trip, places, currentUid])
}

/** Monté dans un voyage ouvert par le couple (jamais pour un invité). */
export function TripPlacesWriter() {
  useTripPlaces()
  return null
}
