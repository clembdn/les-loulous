import { useEffect, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { subscribeToGoals } from '../services/nutritionGoalsService.js'

export function useNutritionGoals() {
  const { currentUid } = useAuth()
  const [goals, setGoals] = useState(null)
  const [isReady, setReady] = useState(false)

  useEffect(() => {
    if (!currentUid) return undefined
    return subscribeToGoals(
      currentUid,
      (g) => { setGoals(g); setReady(true) },
      () => setReady(true),
    )
  }, [currentUid])

  return { goals, isLoading: !isReady }
}
