import { useEffect, useState } from 'react'
import { subscribeToWeek } from '../services/mealPlanService.js'

// dayMap : { 'YYYY-MM-DD': { id, date, midi:[], soir:[] } } pour la semaine demandée.
export function useWeekPlan(startId, endId) {
  const [dayMap, setDayMap] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const unsub = subscribeToWeek(startId, endId, (map) => {
      setDayMap(map)
      setIsLoading(false)
    })
    return () => unsub()
  }, [startId, endId])

  return { dayMap, isLoading }
}
