import { createContext, useContext, useMemo, useCallback } from 'react'
import { useAppData } from './AppDataContext.jsx'
import { convert, normalizeRate, DEFAULT_EUR_TO_AUD } from '../utils/money.js'

const CurrencyContext = createContext(null)

// Deux façons d'afficher un montant, et il faut les deux :
//
//   formatNative — le montant DANS SA DEVISE, sans conversion. C'est ce
//     qu'on veut sur un écran de compte : le solde du joint est un vrai
//     solde en A$, le convertir en € serait une information fabriquée.
//
//   format — le montant converti dans la devise d'affichage choisie. C'est
//     ce qu'on veut dès qu'on additionne des comptes de devises différentes
//     (patrimoine total, dettes, apports).

function makeFormatter(currency, fractionDigits) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    currencyDisplay: currency === 'AUD' ? 'narrowSymbol' : 'symbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

const FORMATTERS = {
  EUR: { 0: makeFormatter('EUR', 0), 2: makeFormatter('EUR', 2) },
  AUD: { 0: makeFormatter('AUD', 0), 2: makeFormatter('AUD', 2) },
}

function formatAmount(value, currency, decimals) {
  const cur = currency === 'AUD' ? 'AUD' : 'EUR'
  const digits = decimals === 2 ? 2 : 0
  return FORMATTERS[cur][digits].format(Number(value) || 0)
}

export function CurrencyProvider({ children }) {
  const { settings } = useAppData()
  const currency = settings.currency === 'EUR' ? 'EUR' : 'AUD'
  const rate = normalizeRate(settings.eurToAud)

  // Montant déjà exprimé dans `from` → affiché tel quel, sans conversion.
  const formatNative = useCallback(
    (amount, from = 'EUR', options) => formatAmount(amount, from, options?.decimals),
    [],
  )

  // Montant exprimé dans `from` → converti vers la devise d'affichage.
  const formatIn = useCallback(
    (amount, from = 'EUR', options) => formatAmount(convert(amount, from, currency, rate), currency, options?.decimals),
    [currency, rate],
  )

  // Raccourci historique : le montant est en € et doit suivre l'affichage.
  const format = useCallback(
    (amountEUR, options) => formatIn(amountEUR, 'EUR', options),
    [formatIn],
  )

  const value = useMemo(
    () => ({ currency, rate, format, formatIn, formatNative, convert: (a, f, t) => convert(a, f, t, rate) }),
    [currency, rate, format, formatIn, formatNative],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (ctx) return ctx
  // Repli avant le montage du provider (écran de login).
  return {
    currency: 'EUR',
    rate: DEFAULT_EUR_TO_AUD,
    format: (v, o) => formatAmount(v, 'EUR', o?.decimals),
    formatIn: (v, f, o) => formatAmount(v, f, o?.decimals),
    formatNative: (v, f, o) => formatAmount(v, f, o?.decimals),
    convert: (a) => a,
  }
}
