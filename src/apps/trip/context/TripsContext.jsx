import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeToTrips } from '../services/tripsService.js'

// La liste des voyages, écoutée UNE fois pour toute l'app : l'écran d'entrée
// (qui ouvre le voyage en cours), la liste, et l'en-tête d'un voyage lisent le
// même tableau. Ouvrir un voyage ne coûte donc aucune lecture de plus pour
// son titre et ses dates.

const TripsContext = createContext(null)

export function TripsProvider({ children }) {
  const [trips, setTrips] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => subscribeToTrips(
    (list) => { setTrips(list); setIsLoading(false) },
    () => setIsLoading(false),
  ), [])

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
