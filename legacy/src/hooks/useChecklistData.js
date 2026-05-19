import { useState, useEffect, useCallback } from 'react'
import { subscribeToChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem } from '../services/checklistService.js'
import { useAuth } from '../context/AuthContext.jsx'

export function useChecklistData() {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setItems([])
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)
    const unsub = subscribeToChecklist(
      (data) => {
        setItems(data)
        setIsLoading(false)
      },
      () => {
        setIsLoading(false)
      }
    )
    return unsub
  }, [uid])

  const handleSaveItem = useCallback(async (item) => {
    if (!uid) return false
    try {
      if (item.id && items.some(i => i.id === item.id)) {
        await updateChecklistItem(item.id, item, uid)
      } else {
        await createChecklistItem(item, uid)
      }
      return true
    } catch (err) {
      console.error('[FinAuzi] Failed to save checklist item:', err)
      return false
    }
  }, [uid, items])

  const handleDeleteItem = useCallback(async (id) => {
    try {
      await deleteChecklistItem(id)
      return true
    } catch (err) {
      console.error('[FinAuzi] Failed to delete checklist item:', err)
      return false
    }
  }, [])

  const handleChangeStatus = useCallback(async (id, newStatus) => {
    if (!uid) return false
    try {
      await updateChecklistItem(id, { status: newStatus }, uid)
      return true
    } catch (err) {
      console.error('[FinAuzi] Failed to update checklist status:', err)
      return false
    }
  }, [uid])

  return {
    items,
    isLoading,
    handleSaveItem,
    handleDeleteItem,
    handleChangeStatus
  }
}
