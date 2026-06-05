import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'
import { formatQuantity } from '../utils/quantity.js'

// Inventaire du foyer (frigo / placards). Une entrée = un produit qu'on a (ou qu'on n'a plus).
const PANTRY_PATH = 'couples/main/pantryItems'
function pantryCol() { return collection(db, PANTRY_PATH) }
function pantryDoc(id) { return doc(db, PANTRY_PATH, id) }

export const PANTRY_STATUSES = ['ok', 'low', 'out']
export const DEFAULT_STATUS = 'ok'

function resolveAisle(raw) {
  return AISLE_BY_ID[raw] ? raw : DEFAULT_AISLE
}
function resolveStatus(raw) {
  return PANTRY_STATUSES.includes(raw) ? raw : DEFAULT_STATUS
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    quantityLabel: raw.quantityLabel || null,
    quantity: typeof raw.quantity === 'number' ? raw.quantity : null,
    unit: raw.unit || null,
    aisle: resolveAisle(raw.aisle),
    status: resolveStatus(raw.status),
    note: raw.note || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

export function subscribeToPantry(callback, onError) {
  const q = query(pantryCol(), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] pantry error:', err)
    onError?.(err)
  })
}

export async function addPantryItem(input, currentUid) {
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
    status: resolveStatus(input.status),
    note: input.note ? String(input.note).trim() : null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  const ref = await addDoc(pantryCol(), data)
  return ref.id
}

export async function updatePantryItem(id, updates, currentUid) {
  const payload = { ...updates, updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.aisle != null) payload.aisle = resolveAisle(updates.aisle)
  if (updates.status != null) payload.status = resolveStatus(updates.status)
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
  await updateDoc(pantryDoc(id), payload)
}

export async function setPantryStatus(item, status, currentUid) {
  await updateDoc(pantryDoc(item.id), {
    status: resolveStatus(status),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function deletePantryItem(id) {
  await deleteDoc(pantryDoc(id))
}
