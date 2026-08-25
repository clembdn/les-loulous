import { useEffect, useMemo, useState } from 'react'
import { subscribeToFoods } from '../services/foodsService.js'

export function useFoods() {
  const [foods, setFoods] = useState([])
  const [isReady, setReady] = useState(false)

  useEffect(() => subscribeToFoods(
    (x) => { setFoods(x); setReady(true) },
    () => setReady(true),
  ), [])

  // Index id → aliment, consommé par sumIngredients().
  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])

  return { foods, foodById, isLoading: !isReady }
}
