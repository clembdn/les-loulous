import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AUTHORIZED_UIDS, CLEMENT_UID } from '@/shared/config/people.js'
import { isValidCategoryId, getDefaultCategoryId } from '../config/categories.js'

function resolveCategory(raw, type) {
  if (isValidCategoryId(raw)) return raw
  return getDefaultCategoryId(type)
}

function resolveAccount(raw) {
  return raw === 'common' ? 'common' : 'personal'
}

const TX_PATH = 'couples/main/transactions'

function txCollection() {
  return collection(db, TX_PATH)
}

function txDoc(id) {
  return doc(db, TX_PATH, id)
}

function resolvePersonUid(raw) {
  if (AUTHORIZED_UIDS.includes(raw?.personUid)) return raw.personUid
  if (Array.isArray(raw?.splits) && raw.splits.length > 0) {
    const first = raw.splits.find((s) => AUTHORIZED_UIDS.includes(s?.personUid))
    if (first) return first.personUid
  }
  if (AUTHORIZED_UIDS.includes(raw?.createdBy)) return raw.createdBy
  return CLEMENT_UID
}

function normalize(raw) {
  const type = raw.type === 'income' ? 'income' : 'expense'
  return {
    id: raw.id,
    title: raw.title || '',
    amountEUR: Number(raw.amountEUR) || 0,
    type,
    recurrence: raw.recurrence === 'monthly' || raw.recurrence === 'weekly' ? raw.recurrence : 'one-off',
    date: raw.date,
    endDate: raw.endDate || null,
    personUid: resolvePersonUid(raw),
    category: resolveCategory(raw.category, type),
    account: resolveAccount(raw.account),
    notes: raw.notes || null,
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

export function subscribeToTransactions(callback, onError) {
  const q = query(txCollection(), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[FinAuzi] transactions error:', err)
    onError?.(err)
  })
}

export async function createTransaction(input, currentUid) {
  const now = new Date().toISOString()
  const personUid = AUTHORIZED_UIDS.includes(input.personUid) ? input.personUid : currentUid
  const type = input.type === 'income' ? 'income' : 'expense'
  const data = {
    title: String(input.title || '').trim(),
    amountEUR: Number(input.amountEUR),
    type,
    recurrence: ['monthly', 'weekly', 'one-off'].includes(input.recurrence) ? input.recurrence : 'one-off',
    date: input.date,
    endDate: input.endDate || null,
    personUid,
    category: resolveCategory(input.category, type),
    account: resolveAccount(input.account),
    notes: input.notes || null,
    isActive: input.isActive !== false,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  const ref = await addDoc(txCollection(), data)
  return ref.id
}

export async function updateTransaction(id, updates, currentUid) {
  const payload = { ...updates, updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.amountEUR != null) payload.amountEUR = Number(updates.amountEUR)
  if (updates.category != null && updates.type != null) {
    payload.category = resolveCategory(updates.category, updates.type)
  }
  if (updates.account != null) payload.account = resolveAccount(updates.account)
  await updateDoc(txDoc(id), payload)
}

export async function deleteTransaction(id) {
  await deleteDoc(txDoc(id))
}

export async function toggleTransactionActive(tx, currentUid) {
  await updateTransaction(tx.id, { isActive: !tx.isActive }, currentUid)
}
