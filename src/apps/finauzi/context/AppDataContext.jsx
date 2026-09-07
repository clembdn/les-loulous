import { createContext, useContext } from 'react'
import { useFinAuziData } from '../hooks/useFinAuziData.js'
import { DEFAULT_SETTINGS } from '../services/settingsService.js'

const AppDataContext = createContext(null)

// Source unique — UN jeu d'abonnements Firestore pour toute l'application.
export function AppDataProvider({ children }) {
  const value = useFinAuziData()
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (ctx) return ctx
  // Repli pour ce qui est rendu avant le provider (l'écran de connexion).
  return {
    transactions: [],
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    error: null,
  }
}
