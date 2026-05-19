import { createContext, useContext, useMemo, useState } from 'react'

const CurrencyContext = createContext(null)

export const CURRENCY_RATES = {
  EUR: { symbol: '€', code: 'EUR', rate: 1, locale: 'fr-FR' },
  AUD: { symbol: 'A$', code: 'AUD', rate: 1.64, locale: 'en-AU' },
}

function formatNumber(amount, locale, fractionDigits) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}

function formatCompact(amount, locale) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState('EUR')

  const value = useMemo(() => {
    const config = CURRENCY_RATES[code]
    const convert = (eur) => eur * config.rate
    const format = (eur, opts = {}) => {
      const amount = convert(eur)
      const fractionDigits = opts.fractionDigits ?? 0
      if (opts.compact && Math.abs(amount) >= 1000) {
        return `${config.symbol}${formatCompact(amount, config.locale)}`
      }
      return `${config.symbol}${formatNumber(amount, config.locale, fractionDigits)}`
    }
    return {
      code,
      symbol: config.symbol,
      rate: config.rate,
      setCode,
      convert,
      format,
    }
  }, [code])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
