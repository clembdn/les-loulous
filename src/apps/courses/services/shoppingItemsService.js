import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  getDocs, writeBatch, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'
import { formatQuantity } from '../utils/quantity.js'

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
    quantity: typeof raw.quantity === 'number' ? raw.quantity : null,
    unit: raw.unit || null,
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
  const quantity = typeof input.quantity === 'number' ? input.quantity : null
  const unit = input.unit || null
  const structured = quantity != null || unit != null
  const quantityLabel = structured
    ? (formatQuantity(quantity, unit) || null)
    : (input.quantityLabel ? String(input.quantityLabel).trim() : null)
  const data = {
    name: String(input.name || '').trim(),
    quantityLabel,
    quantity,
    unit,
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
  if ('quantity' in updates || 'unit' in updates) {
    const quantity = typeof updates.quantity === 'number' ? updates.quantity : null
    const unit = updates.unit || null
    payload.quantity = quantity
    payload.unit = unit
    payload.quantityLabel = formatQuantity(quantity, unit) || null
  } else if ('quantityLabel' in updates) {
    payload.quantityLabel = updates.quantityLabel ? String(updates.quantityLabel).trim() : null
  }
  if ('note' in updates) {
    payload.note = updates.note ? String(updates.note).trim() : null
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

// Recrée des articles supprimés (annulation d'un vidage). Le restaurateur devient
// createdBy/updatedBy (les règles exigent createdBy == auth.uid à la création).
export async function restoreItems(items, currentUid) {
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  items.forEach((it) => {
    const ref = doc(itemsCol())
    batch.set(ref, {
      name: String(it.name || '').trim(),
      quantityLabel: it.quantityLabel || null,
      quantity: typeof it.quantity === 'number' ? it.quantity : null,
      unit: it.unit || null,
      aisle: resolveAisle(it.aisle),
      checked: it.checked === true,
      checkedBy: it.checkedBy || null,
      checkedAt: it.checkedAt || null,
      note: it.note || null,
      createdAt: it.createdAt || now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  })
  await batch.commit()
}
