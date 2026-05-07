// FinAuzi — Core data hook
// Connects to Firestore for transactions & settings, computes all derived forecast data.
// Used by both desktop and mobile views.

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { AUTHORIZED_UIDS } from '../config/people.js'
import { subscribeToTransactions, createTransaction, updateTransaction, deleteTransaction, toggleTransactionActive } from '../services/transactionService.js'
import { subscribeToSettings, updateSettings } from '../services/settingsService.js'
import {
  getForecastData,
  getMonthlyNetCashflow,
  getRunway,
  getLowestBalance,
  getFinalProjectedCapital,
  getHealthStatus,
  getPersonBreakdown,
} from '../utils/cashflow.js'

const DEFAULT_INITIAL_CAPITAL = 10000
const DEFAULT_SAFETY_BUFFER = 1500

export function useAustraliaData() {
  const currency = useCurrency()
  const { format } = currency
  const { currentUser } = useAuth()
  const uid = currentUser?.uid

  // Firestore-backed state
  const [transactions, setTransactions] = useState([])
  const [settings, setSettings] = useState({
    initialCapitalEUR: DEFAULT_INITIAL_CAPITAL,
    safetyBufferEUR: DEFAULT_SAFETY_BUFFER,
  })
  const [isLoadingTx, setIsLoadingTx] = useState(true)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // UI state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)

  // ─── Real-time listeners ───
  useEffect(() => {
    const unsub = subscribeToTransactions(
      (txs) => {
        setTransactions(txs)
        setIsLoadingTx(false)
      },
      () => {
        setIsLoadingTx(false)
      }
    )
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToSettings((s) => {
      setSettings(s)
      setIsLoadingSettings(false)
    })
    return unsub
  }, [])

  const isLoading = isLoadingTx || isLoadingSettings

  // ─── Transaction CRUD (Firestore) ───
  const handleSave = useCallback(async (tx) => {
    try {
      if (tx.id && transactions.some(t => t.id === tx.id)) {
        // Update existing
        const { id, ...updates } = tx
        await updateTransaction(id, updates, uid)
      } else {
        // Create new
        await createTransaction(tx, uid)
      }
    } catch (err) {
      console.error('[FinAuzi] Failed to save transaction:', err)
    }
    setModalOpen(false)
    setEditingTx(null)
  }, [uid, transactions])

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteTransaction(id)
    } catch (err) {
      console.error('[FinAuzi] Failed to delete transaction:', err)
    }
    setModalOpen(false)
    setEditingTx(null)
  }, [])

  const handleTogglePause = useCallback(async (id) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    try {
      await toggleTransactionActive(id, tx.isActive, uid)
    } catch (err) {
      console.error('[FinAuzi] Failed to toggle pause:', err)
    }
  }, [transactions, uid])

  const openCreateModal = useCallback(() => {
    setEditingTx(null)
    setModalOpen(true)
  }, [])

  const openEditModal = useCallback((tx) => {
    setEditingTx(tx)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingTx(null)
  }, [])

  const setSafetyBuffer = useCallback(async (v) => {
    try {
      await updateSettings({ safetyBufferEUR: v }, uid)
    } catch (err) {
      console.error('[FinAuzi] Failed to update safety buffer:', err)
    }
  }, [uid])

  const setInitialCapital = useCallback(async (v) => {
    try {
      await updateSettings({ initialCapitalEUR: v }, uid)
    } catch (err) {
      console.error('[FinAuzi] Failed to update initial capital:', err)
    }
  }, [uid])

  // ─── Normalized settings for backward compat ───
  const normalizedSettings = useMemo(() => ({
    safetyBuffer: settings.safetyBufferEUR ?? DEFAULT_SAFETY_BUFFER,
    initialCapital: settings.initialCapitalEUR ?? DEFAULT_INITIAL_CAPITAL,
  }), [settings])

  // ─── Derived Data ───
  const recurringTxs = useMemo(
    () => transactions.filter(t => t.recurrence === 'monthly').sort((a, b) => {
      if (a.type !== b.type) return a.type === 'income' ? -1 : 1
      return (a.title || '').localeCompare(b.title || '')
    }),
    [transactions]
  )

  const oneOffTxs = useMemo(
    () => transactions.filter(t => t.recurrence === 'one-off').sort((a, b) => {
      return new Date(a.date) - new Date(b.date)
    }),
    [transactions]
  )

  const forecastData = useMemo(
    () => getForecastData(transactions, normalizedSettings.initialCapital),
    [transactions, normalizedSettings.initialCapital]
  )

  const monthlyCashflow = useMemo(
    () => getMonthlyNetCashflow(transactions),
    [transactions]
  )

  const runway = useMemo(() => getRunway(forecastData), [forecastData])
  const lowestBalance = useMemo(() => getLowestBalance(forecastData), [forecastData])
  const finalCapital = useMemo(() => getFinalProjectedCapital(forecastData), [forecastData])
  const healthStatus = useMemo(
    () => getHealthStatus(forecastData, normalizedSettings.safetyBuffer),
    [forecastData, normalizedSettings.safetyBuffer]
  )

  // Person-based breakdown
  const personBreakdown = useMemo(
    () => getPersonBreakdown(transactions, AUTHORIZED_UIDS),
    [transactions]
  )

  // ─── Status helpers ───
  const getCashflowStatus = () => {
    if (monthlyCashflow.netCashflow > 0) return 'green'
    if (monthlyCashflow.netCashflow < 0) return 'red'
    return 'neutral'
  }

  const getFinalCapitalStatus = () => {
    if (finalCapital > normalizedSettings.safetyBuffer) return 'green'
    if (finalCapital > 0) return 'orange'
    return 'red'
  }

  const getRunwayLabel = () => {
    if (runway === null) return '12+ mois'
    if (runway <= 2) return 'Critique'
    return `${runway} mois`
  }

  const getRunwayStatus = () => {
    if (runway === null) return 'green'
    if (runway <= 2) return 'red'
    if (runway <= 5) return 'orange'
    return 'green'
  }

  const getLowestStatus = () => {
    if (lowestBalance.amount > normalizedSettings.safetyBuffer) return 'green'
    if (lowestBalance.amount > 0) return 'orange'
    return 'red'
  }

  return {
    // Currency
    currency,
    format,

    // Auth
    currentUser,

    // Loading
    isLoading,

    // Raw state
    transactions,
    settings: normalizedSettings,
    modalOpen,
    editingTx,

    // CRUD
    handleSave,
    handleDelete,
    handleTogglePause,
    openCreateModal,
    openEditModal,
    closeModal,
    setSafetyBuffer,
    setInitialCapital,

    // Derived
    recurringTxs,
    oneOffTxs,
    forecastData,
    monthlyCashflow,
    runway,
    lowestBalance,
    finalCapital,
    healthStatus,
    personBreakdown,

    // Status helpers
    getCashflowStatus,
    getFinalCapitalStatus,
    getRunwayLabel,
    getRunwayStatus,
    getLowestStatus,
  }
}
