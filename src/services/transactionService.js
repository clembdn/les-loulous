// FinAuzi — Transaction Service
// All Firestore CRUD for the shared couple transaction collection.
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'

const TRANSACTIONS_PATH = 'couples/main/transactions'

function txCollection() {
  return collection(db, TRANSACTIONS_PATH)
}

function txDoc(id) {
  return doc(db, TRANSACTIONS_PATH, id)
}

/**
 * Subscribe to all transactions in real time.
 * @param {(txs: Array) => void} callback
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe function
 */
export function subscribeToTransactions(callback, onError) {
  const q = query(txCollection(), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(txs)
  }, (error) => {
    console.error('[FinAuzi] Firestore transactions error:', error)
    if (onError) onError(error)
  })
}

/**
 * Create a new transaction.
 * @param {Object} txInput — transaction fields (without id)
 * @param {string} currentUid — the logged-in user's UID
 */
export async function createTransaction(txInput, currentUid) {
  const now = new Date().toISOString()
  const data = {
    title: txInput.title,
    amountEUR: Number(txInput.amountEUR),
    type: txInput.type,
    recurrence: txInput.recurrence,
    category: txInput.category,
    date: txInput.date,
    endDate: txInput.endDate || null,
    notes: txInput.notes || null,
    isActive: txInput.isActive ?? true,
    personUid: txInput.personUid,
    createdAt: txInput.createdAt || now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  // If we have a deterministic id (e.g. from migration), use setDoc
  if (txInput.id) {
    await setDoc(doc(db, TRANSACTIONS_PATH, txInput.id), data)
    return txInput.id
  }
  const ref = await addDoc(txCollection(), data)
  return ref.id
}

/**
 * Update an existing transaction.
 */
export async function updateTransaction(transactionId, updates, currentUid) {
  const now = new Date().toISOString()
  await updateDoc(txDoc(transactionId), {
    ...updates,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

/**
 * Delete a transaction.
 */
export async function deleteTransaction(transactionId) {
  await deleteDoc(txDoc(transactionId))
}

/**
 * Toggle the isActive flag on a transaction.
 */
export async function toggleTransactionActive(transactionId, currentIsActive, currentUid) {
  await updateTransaction(transactionId, { isActive: !currentIsActive }, currentUid)
}
