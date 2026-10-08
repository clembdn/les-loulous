import { useCallback } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { useTripUI } from '../context/TripUIContext.jsx'
import { saveDay } from '../services/daysService.js'
import { withLegMode } from '../utils/legs.js'

/**
 * Changer le mode d'un trajet (à pied, vélo, voiture) : rangé dans le jour,
 * il sera recalculé par le voyage ouvert (cf. useRouteFiller). `null` pour un
 * invité, qui ne modifie rien.
 */
export function useLegMode(date) {
  const { currentUid } = useAuth()
  const { readOnly } = useTripUI()
  const { tripId, days } = useTripData()
  const change = useCallback((leg, mode) => {
    if (mode === leg.mode) return
    const day = days[date]
    saveDay(tripId, date, { legs: withLegMode(day?.legs || [], leg, mode) }, day, currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
  }, [tripId, date, days, currentUid])
  return readOnly ? null : change
}
