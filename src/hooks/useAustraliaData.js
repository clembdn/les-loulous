// FinAuzi — Core data hook
// Connects to Firestore for transactions & settings, computes all derived forecast data.
// Used by both desktop and mobile views.

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPersonUidForAuthUser } from '../config/people.js'
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
  getCompteCommunBalance,
  getCapitalProjet,
  getForecastDataWithScenarios,
} from '../utils/cashflow.js'

const DEFAULT_INITIAL_CAPITAL = 10000
const DEFAULT_SAFETY_BUFFER = 1500

export function useAustraliaData() {
  const currency = useCurrency()
  const { format } = currency
  const { currentUser } = useAuth()
  const uid = currentUser?.uid
  const defaultPersonUid = useMemo(() => getPersonUidForAuthUser(currentUser), [currentUser])

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
    if (!uid) {
      setTransactions([])
      setIsLoadingTx(false)
      return undefined
    }

    setIsLoadingTx(true)
    const unsub = subscribeToTransactions(
      (txs) => {
        setTransactions(txs)
        setIsLoadingTx(false)
      },
      () => {
        setIsLoadingTx(false)
      },
      defaultPersonUid
    )
    return unsub
  }, [uid, defaultPersonUid])

  useEffect(() => {
    if (!uid) {
      setSettings({
        initialCapitalEUR: DEFAULT_INITIAL_CAPITAL,
        safetyBufferEUR: DEFAULT_SAFETY_BUFFER,
      })
      setIsLoadingSettings(false)
      return undefined
    }

    setIsLoadingSettings(true)
    const unsub = subscribeToSettings(
      (s) => {
        setSettings(s)
        setIsLoadingSettings(false)
      },
      () => {
        setIsLoadingSettings(false)
      }
    )
    return unsub
  }, [uid])

  const isLoading = isLoadingTx || isLoadingSettings

  // ─── Transaction CRUD (Firestore) ───
  const handleSave = useCallback(async (tx) => {
    if (!uid) {
      console.error('[FinAuzi] Cannot save transaction without an authenticated user.')
      return false
    }

    try {
      if (tx.id && transactions.some(t => t.id === tx.id)) {
        // Update existing
        const { id, ...updates } = tx
        await updateTransaction(id, updates, uid, defaultPersonUid)
      } else {
        // Create new
        await createTransaction(tx, uid, defaultPersonUid)
      }
      setModalOpen(false)
      setEditingTx(null)
      return true
    } catch (err) {
      console.error('[FinAuzi] Failed to save transaction:', {
        code: err?.code,
        message: err?.message,
        name: err?.name,
        uid,
        transactionId: tx?.id ?? null,
        allocationType: tx?.allocationType ?? null,
        splits: tx?.splits ?? null,
      }, err)
      return false
    }
  }, [uid, transactions, defaultPersonUid])

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteTransaction(id)
      setModalOpen(false)
      setEditingTx(null)
      return true
    } catch (err) {
      console.error('[FinAuzi] Failed to delete transaction:', {
        code: err?.code,
        message: err?.message,
        name: err?.name,
        uid,
        transactionId: id,
      }, err)
      return false
    }
  }, [uid])

  const handleTogglePause = useCallback(async (id) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    try {
      await toggleTransactionActive(tx, uid, defaultPersonUid)
    } catch (err) {
      console.error('[FinAuzi] Failed to toggle pause:', err)
    }
  }, [transactions, uid, defaultPersonUid])

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

  const setPersonColors = useCallback(async (personColors) => {
    try {
      await updateSettings({ personColors }, uid)
    } catch (err) {
      console.error('[FinAuzi] Failed to update person colors:', err)
    }
  }, [uid])

  // ─── Normalized settings for backward compat ───
  const normalizedSettings = useMemo(() => ({
    safetyBuffer: settings.safetyBufferEUR ?? DEFAULT_SAFETY_BUFFER,
    initialCapital: settings.initialCapitalEUR ?? DEFAULT_INITIAL_CAPITAL,
    personColors: settings.personColors || {},
  }), [settings])

  // ─── Derived Data ───
  const recurringTxs = useMemo(
    () => transactions.filter(t => t.recurrence === 'monthly' || t.recurrence === 'weekly').sort((a, b) => {
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

  // Compte Commun & Capital Projet
  const compteCommunBalance = useMemo(
    () => getCompteCommunBalance(transactions, normalizedSettings.initialCapital),
    [transactions, normalizedSettings.initialCapital]
  )

  const capitalProjet = useMemo(
    () => getCapitalProjet(transactions, normalizedSettings.initialCapital),
    [transactions, normalizedSettings.initialCapital]
  )

  // Scenarios
  const scenarioData = useMemo(
    () => getForecastDataWithScenarios(transactions, normalizedSettings.initialCapital),
    [transactions, normalizedSettings.initialCapital]
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
    defaultPersonUid,

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
    setPersonColors,

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
    compteCommunBalance,
    capitalProjet,
    scenarioData,

    // Status helpers
    getCashflowStatus,
    getFinalCapitalStatus,
    getRunwayLabel,
    getRunwayStatus,
    getLowestStatus,
  }
}
