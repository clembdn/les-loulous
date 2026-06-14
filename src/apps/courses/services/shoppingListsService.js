import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  getDocs, writeBatch, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

const LISTS_PATH = 'couples/main/shoppingLists'
const ITEMS_PATH = 'couples/main/shoppingItems'
function listsCol() { return collection(db, LISTS_PATH) }
function listDoc(id) { return doc(db, LISTS_PATH, id) }
function itemsCol() { return collection(db, ITEMS_PATH) }

// Nom par défaut d'une nouvelle liste : la date du jour (ex. « 14 juin 2026 »).
export function defaultListName(date = new Date()) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    status: raw.status === 'archived' ? 'archived' : 'active',
    archivedAt: raw.archivedAt || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

export function subscribeToLists(callback, onError) {
  const q = query(listsCol(), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] lists error:', err)
    onError?.(err)
  })
}

// Crée une liste. Écriture fire-and-forget (offline-first) : l'id est dérivé
// côté client donc renvoyé synchronement, l'UI peut basculer dessus aussitôt.
export function createList({ name } = {}, currentUid) {
  const now = new Date().toISOString()
  const ref = doc(listsCol())
  setDoc(ref, {
    name: (name ? String(name).trim() : '') || defaultListName(),
    status: 'active',
    archivedAt: null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }).catch((err) => console.error('[Courses] createList error:', err))
  return ref.id
}

export async function renameList(id, name, currentUid) {
  await updateDoc(listDoc(id), {
    name: String(name || '').trim() || defaultListName(),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function setListStatus(id, status, currentUid) {
  const archived = status === 'archived'
  await updateDoc(listDoc(id), {
    status: archived ? 'archived' : 'active',
    archivedAt: archived ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

// Supprime la liste + tous ses articles (la traçabilité passe par l'archivage,
// la suppression est définitive).
export async function deleteList(id) {
  const snap = await getDocs(itemsCol())
  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    if (d.data().listId === id) batch.delete(d.ref)
  })
  batch.delete(listDoc(id))
  await batch.commit()
}
