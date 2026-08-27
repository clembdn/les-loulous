import { useEffect, useState } from 'react'
import { subscribeToPantry } from '../services/pantryService.js'

export function usePantry() {
  const [pantry, setPantry] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsub = subscribeToPantry(
      (x) => { setPantry(x); setIsLoading(false) },
      (err) => { setError(err); setIsLoading(false) },
    )
    return () => unsub()
  }, [])

  return { pantry, isLoading, error }
}
