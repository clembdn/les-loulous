import { useCallback, useEffect, useState } from 'react'
import { fetchEurToAud, getCachedEurToAud } from '../services/exchangeRateService.js'

// Le taux du jour pour un formulaire : disponible immédiatement (dernière
// valeur connue), rafraîchi en arrière-plan. `fetchEurToAud` ne rejette
// jamais — hors ligne, on garde simplement la valeur en cache avec
// `isStale: true`, et le formulaire reste utilisable.
export function useExchangeRate(fallbackRate) {
  const [state, setState] = useState(() => ({
    rate: getCachedEurToAud(fallbackRate),
    date: null,
    source: 'cache',
    isStale: false,
    isFallback: false,
    isLoading: true,
  }))

  const refresh = useCallback((options) => {
    setState((prev) => ({ ...prev, isLoading: true }))
    return fetchEurToAud(options).then((result) => {
      setState({ ...result, isLoading: false })
      return result
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchEurToAud().then((result) => {
      if (!cancelled) setState({ ...result, isLoading: false })
    })
    return () => { cancelled = true }
  }, [])

  return { ...state, refresh }
}
