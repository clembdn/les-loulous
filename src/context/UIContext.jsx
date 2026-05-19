import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const openForm = useCallback((tx = null) => {
    setEditingTx(tx)
    setFormOpen(true)
  }, [])
  const closeForm = useCallback(() => {
    setFormOpen(false)
    setEditingTx(null)
  }, [])

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const value = useMemo(
    () => ({
      formOpen,
      editingTx,
      openForm,
      closeForm,
      settingsOpen,
      openSettings,
      closeSettings,
    }),
    [formOpen, editingTx, openForm, closeForm, settingsOpen, openSettings, closeSettings],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}
