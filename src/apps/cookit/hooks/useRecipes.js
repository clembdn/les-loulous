import { useEffect, useState } from 'react'
import { subscribeToRecipes } from '../services/recipesService.js'

export function useRecipes() {
  const [recipes, setRecipes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsub = subscribeToRecipes(
      (x) => { setRecipes(x); setIsLoading(false) },
      (err) => setError(err),
    )
    return () => unsub()
  }, [])

  return { recipes, isLoading, error }
}
