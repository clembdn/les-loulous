import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  getDocs, writeBatch, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'

const ITEMS_PATH = 'couples/main/shoppingItems'
function itemsCol() { return collection(db, ITEMS_PATH) }
function itemDoc(id) { return doc(db, ITEMS_PATH, id) }

function resolveAisle(raw) {
  return AISLE_BY_ID[raw] ? raw : DEFAULT_AISLE
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    quantityLabel: raw.quantityLabel || null,
    aisle: resolveAisle(raw.aisle),
    checked: raw.checked === true,
    checkedBy: raw.checkedBy || null,
    checkedAt: raw.checkedAt || null,
    note: raw.note || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

export function subscribeToItems(callback, onError) {
  const q = query(itemsCol(), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] items error:', err)
    onError?.(err)
  })
}

export async function addItem(input, currentUid) {
  const now = new Date().toISOString()
  const data = {
    name: String(input.name || '').trim(),
    quantityLabel: input.quantityLabel ? String(input.quantityLabel).trim() : null,
    aisle: resolveAisle(input.aisle),
    checked: false,
    checkedBy: null,
    checkedAt: null,
    note: input.note ? String(input.note).trim() : null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  const ref = await addDoc(itemsCol(), data)
  return ref.id
}

export async function updateItem(id, updates, currentUid) {
  const payload = { ...updates, updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.aisle != null) payload.aisle = resolveAisle(updates.aisle)
  if ('quantityLabel' in updates) {
    payload.quantityLabel = updates.quantityLabel ? String(updates.quantityLabel).trim() : null
  }
  await updateDoc(itemDoc(id), payload)
}

export async function setItemChecked(item, checked, currentUid) {
  const now = new Date().toISOString()
  await updateDoc(itemDoc(item.id), {
    checked,
    checkedBy: checked ? currentUid : null,
    checkedAt: checked ? now : null,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

export async function deleteItem(id) {
  await deleteDoc(itemDoc(id))
}

async function deleteWhere(predicate) {
  const snap = await getDocs(itemsCol())
  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    if (predicate({ id: d.id, ...d.data() })) batch.delete(d.ref)
  })
  await batch.commit()
}

// Supprime les articles cochés (fin de courses).
export function clearChecked() {
  return deleteWhere((it) => it.checked === true)
}

// Supprime tous les articles (le catalogue persiste).
export function clearAll() {
  return deleteWhere(() => true)
}
