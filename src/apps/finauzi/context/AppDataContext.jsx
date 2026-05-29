import { createContext, useContext } from 'react'
import { useFinAuziData } from '../hooks/useFinAuziData.js'
import { DEFAULT_SETTINGS } from '../services/settingsService.js'

const AppDataContext = createContext(null)

// Single source of truth — one set of Firestore subscriptions for the whole app.
export function AppDataProvider({ children }) {
  const value = useFinAuziData()
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (ctx) return ctx
  // Fallback for code paths rendered before the provider (e.g. Login screen).
  return {
    transactions: [],
    settings: DEFAULT_SETTINGS,
    checklist: [],
    timeline: [],
    isLoading: true,
    isChecklistLoading: true,
    isTimelineLoading: true,
    error: null,
  }
}
