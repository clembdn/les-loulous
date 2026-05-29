import { useEffect, useState } from 'react'
import { subscribeToTransactions } from '../services/transactionService.js'
import { subscribeToSettings, DEFAULT_SETTINGS } from '../services/settingsService.js'
import { subscribeToChecklist } from '../services/checklistService.js'
import { subscribeToTimeline } from '../services/timelineService.js'

export function useFinAuziData() {
  const [transactions, setTransactions] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [checklist, setChecklist] = useState([])
  const [timeline, setTimeline] = useState([])
  const [txReady, setTxReady] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const [checklistReady, setChecklistReady] = useState(false)
  const [timelineReady, setTimelineReady] = useState(false)
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
    const unsubChecklist = subscribeToChecklist(
      (items) => { setChecklist(items); setChecklistReady(true) },
      (err) => setError(err),
    )
    const unsubTimeline = subscribeToTimeline(
      (items) => { setTimeline(items); setTimelineReady(true) },
      (err) => setError(err),
    )
    return () => {
      unsubTx()
      unsubSettings()
      unsubChecklist()
      unsubTimeline()
    }
  }, [])

  return {
    transactions,
    settings,
    checklist,
    timeline,
    isLoading: !txReady || !settingsReady,
    isChecklistLoading: !checklistReady,
    isTimelineLoading: !timelineReady,
    error,
  }
}
