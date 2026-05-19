import { useEffect, useState } from 'react'
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

  return {
    transactions,
    settings,
    isLoading: !txReady || !settingsReady,
    error,
  }
}
