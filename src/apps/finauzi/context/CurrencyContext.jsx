import { createContext, useContext, useMemo, useCallback } from 'react'
import { useAppData } from './AppDataContext.jsx'

const CurrencyContext = createContext(null)

const EUR_FORMATTER = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const AUD_FORMATTER = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

export function CurrencyProvider({ children }) {
  const { settings } = useAppData()
  const currency = settings.currency === 'AUD' ? 'AUD' : 'EUR'
  const rate = Number(settings.eurToAud) || 1.65

  const format = useCallback((amountEUR) => {
    const v = Number(amountEUR) || 0
    if (currency === 'AUD') return AUD_FORMATTER.format(v * rate)
    return EUR_FORMATTER.format(v)
  }, [currency, rate])

  const value = useMemo(() => ({ currency, rate, format }), [currency, rate, format])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    // Fallback before provider mounts.
    return {
      currency: 'EUR',
      rate: 1.65,
      format: (v) => EUR_FORMATTER.format(Number(v) || 0),
    }
  }
  return ctx
}
