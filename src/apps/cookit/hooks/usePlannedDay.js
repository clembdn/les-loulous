import { useEffect, useState } from 'react'
import { subscribeToDay } from '../services/mealPlanService.js'

// Le planning d'UNE journée, tel que le journal en a besoin.
// Le plan est un document partagé du couple : le lire ne demande aucun droit
// particulier, contrairement au journal de l'autre personne.
export function usePlannedDay(dateId) {
  const [day, setDay] = useState(null)

  useEffect(() => {
    if (!dateId) return undefined
    return subscribeToDay(dateId, setDay, () => setDay(null))
  }, [dateId])

  return day
}
