import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import {
  subscribeToLists, createList, renameList, setListStatus, deleteList,
} from '../services/shoppingListsService.js'
import { assignLegacyItems } from '../services/shoppingItemsService.js'

const STORAGE_KEY = 'courses.activeListId'

function readStored() {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
function writeStored(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function useShoppingLists() {
  const { currentUid } = useAuth()
  const [lists, setLists] = useState([])
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState(() => readStored())
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    const unsub = subscribeToLists(
      (x) => { setLists(x); setReady(true) },
      () => setReady(true),
    )
    return unsub
  }, [])

  // Listes triées createdAt desc (cf. service). La plus ancienne = liste « défaut »
  // qui accueille les articles legacy créés avant l'introduction des listes.
  const activeLists = useMemo(() => lists.filter((l) => l.status === 'active'), [lists])
  const archivedLists = useMemo(() => lists.filter((l) => l.status === 'archived'), [lists])
  const defaultListId = lists.length ? lists[lists.length - 1].id : null

  // Bootstrap : aucune liste → en créer une (date du jour) et y rattacher les
  // articles existants sans listId. Une seule fois.
  useEffect(() => {
    if (!ready || !currentUid || bootstrappedRef.current) return
    if (lists.length === 0) {
      bootstrappedRef.current = true
      const id = createList({}, currentUid)
      assignLegacyItems(id, currentUid).catch((err) => console.error('[Courses] migrate items:', err))
      setSelectedId(id)
      writeStored(id)
    }
  }, [ready, currentUid, lists.length])

  // Liste active = sélection stockée si toujours active, sinon la plus récente active.
  const activeListId = useMemo(() => {
    if (selectedId && activeLists.some((l) => l.id === selectedId)) return selectedId
    return activeLists[0]?.id || null
  }, [selectedId, activeLists])

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) || null,
    [lists, activeListId],
  )

  function selectList(id) {
    setSelectedId(id)
    writeStored(id)
  }

  function handleCreate(name) {
    const id = createList({ name }, currentUid)
    selectList(id)
    return id
  }
  function handleRename(id, name) {
    renameList(id, name, currentUid).catch((err) => console.error('[Courses] renameList:', err))
  }
  function handleArchive(id) {
    setListStatus(id, 'archived', currentUid).catch((err) => console.error('[Courses] archiveList:', err))
  }
  function handleUnarchive(id) {
    setListStatus(id, 'active', currentUid).catch((err) => console.error('[Courses] unarchiveList:', err))
    selectList(id)
  }
  function handleDelete(id) {
    deleteList(id).catch((err) => console.error('[Courses] deleteList:', err))
  }

  return {
    lists,
    activeLists,
    archivedLists,
    activeListId,
    activeList,
    defaultListId,
    isLoading: !ready,
    selectList,
    createList: handleCreate,
    renameList: handleRename,
    archiveList: handleArchive,
    unarchiveList: handleUnarchive,
    deleteList: handleDelete,
  }
}

// Vrai si l'article appartient à la liste active (les articles legacy sans
// listId sont rattachés à la liste « défaut »).
export function itemBelongsToList(item, activeListId, defaultListId) {
  if (item.listId) return item.listId === activeListId
  return activeListId === defaultListId
}
