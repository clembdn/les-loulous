import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useOnline } from '@/shared/lib/useOnline.js'
import { useToday } from '@/shared/lib/useToday.js'
import { subscribeToTrips, summarizeTrip } from '../services/tripsService.js'
import { prewarmTrips } from '../services/offlineService.js'

// La liste des voyages, écoutée UNE fois pour toute l'app : l'écran d'entrée
// (qui ouvre le voyage en cours), la liste, et l'en-tête d'un voyage lisent le
// même tableau. Ouvrir un voyage ne coûte donc aucune lecture de plus pour
// son titre et ses dates.

const TripsContext = createContext(null)

// Laisser l'écran s'afficher avant de relire les voyages à emporter.
const PREWARM_DELAY_MS = 2000

export function TripsProvider({ children }) {
  const [trips, setTrips] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const online = useOnline()
  const today = useToday()
  const { currentUid } = useAuth()
  const summarized = useRef(new Set())

  useEffect(() => subscribeToTrips(
    (list) => { setTrips(list); setIsLoading(false) },
    () => setIsLoading(false),
  ), [])

  // Les voyages en cours ou tout proches sont relus en entier à l'ouverture
  // (et au retour du réseau) : partis sans rouvrir l'app, on les a quand même.
  useEffect(() => {
    if (isLoading || !online) return undefined
    const timer = setTimeout(() => prewarmTrips(trips, today), PREWARM_DELAY_MS)
    return () => clearTimeout(timer)
  }, [trips, isLoading, online, today])

  // Les voyages jamais résumés pour la carte du monde (créés avant elle, et
  // pas rouverts depuis) : lus une fois, un par un, en ligne.
  useEffect(() => {
    if (isLoading || !online) return undefined
    const todo = trips.filter((t) => t.places === null && !summarized.current.has(t.id))
    if (!todo.length) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      for (const trip of todo) {
        if (cancelled) return
        summarized.current.add(trip.id)
        await summarizeTrip(trip, currentUid).catch((err) => console.warn('[Trip] résumé impossible :', err))
      }
    }, PREWARM_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trips, isLoading, online, currentUid])

  const value = useMemo(() => ({
    trips,
    tripById: Object.fromEntries(trips.map((t) => [t.id, t])),
    isLoading,
  }), [trips, isLoading])

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
}

export function useTrips() {
  const ctx = useContext(TripsContext)
  if (!ctx) throw new Error('useTrips doit être utilisé sous <TripsProvider>')
  return ctx
}
