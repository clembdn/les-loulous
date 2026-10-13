import { useEffect, useSyncExternalStore } from 'react'
import { useOnline } from '@/shared/lib/useOnline.js'
import { getRates, refreshRates, subscribeRates } from '../services/fxService.js'

/**
 * Les taux du jour pour l'équivalent en euros (`null` tant qu'on n'en a
 * jamais eu). Rafraîchis au retour du réseau ; une seule requête pour tous
 * les écrans.
 */
export function useEurRates() {
  const online = useOnline()
  const rates = useSyncExternalStore(subscribeRates, getRates)
  useEffect(() => {
    if (online) refreshRates()
  }, [online])
  return rates
}
