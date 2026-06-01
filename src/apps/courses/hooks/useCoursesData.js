import { useEffect, useState } from 'react'
import { subscribeToItems } from '../services/shoppingItemsService.js'
import { subscribeToCatalog } from '../services/catalogService.js'

export function useCoursesData() {
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [itemsReady, setItemsReady] = useState(false)
  const [catalogReady, setCatalogReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubItems = subscribeToItems(
      (x) => { setItems(x); setItemsReady(true) },
      (err) => setError(err),
    )
    const unsubCatalog = subscribeToCatalog(
      (x) => { setCatalog(x); setCatalogReady(true) },
      (err) => setError(err),
    )
    return () => { unsubItems(); unsubCatalog() }
  }, [])

  return { items, catalog, isLoading: !itemsReady || !catalogReady, error }
}
