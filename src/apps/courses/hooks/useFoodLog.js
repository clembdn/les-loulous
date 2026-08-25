import { useEffect, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { subscribeToDay } from '../services/foodLogService.js'

// Journal du jour affiché, pour l'utilisateur connecté.
export function useFoodLog(dateId) {
  const { currentUid } = useAuth()
  const [day, setDay] = useState({ id: dateId, date: dateId, entries: [] })
  const [isReady, setReady] = useState(false)

  useEffect(() => {
    if (!currentUid || !dateId) return undefined
    setReady(false)
    return subscribeToDay(
      currentUid, dateId,
      (d) => { setDay(d); setReady(true) },
      () => setReady(true),
    )
  }, [currentUid, dateId])

  return { day, entries: day.entries, isLoading: !isReady }
}
