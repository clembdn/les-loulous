import { useEffect, useMemo, useState } from 'react'
import { subscribeToTransactions } from '../services/transactionService.js'
import { subscribeToSettings, DEFAULT_SETTINGS } from '../services/settingsService.js'

export function useFinAuziData() {
  const [transactions, setTransactions] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [txReady, setTxReady] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubTx = subscribeToTransactions(
      (txs) => { setTransactions(txs); setTxReady(true) },
      (err) => setError(err),
    )
    const unsubSettings = subscribeToSettings(
      (s) => { setSettings(s); setSettingsReady(true) },
      (err) => setError(err),
    )
    return () => {
      unsubTx()
      unsubSettings()
    }
  }, [])

  // Mémoïsé, parce que cet objet EST la valeur du contexte.
  //
  // Sans ça, chaque rendu du provider en fabriquait un neuf, et tout ce qui lit
  // `useAppData()` se re-rendait — y compris quand les transactions et les
  // réglages étaient rigoureusement les mêmes. `MuscDataContext` le faisait
  // déjà de son côté ; FinAuzi ne le faisait pas.
  return useMemo(() => ({
    transactions,
    settings,
    isLoading: !txReady || !settingsReady,
    error,
  }), [transactions, settings, txReady, settingsReady, error])
}
