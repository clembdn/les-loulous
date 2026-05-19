// FinAuzi — Transaction Service
// All Firestore CRUD for the shared couple transaction collection.
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import {
  ALLOCATION_TYPES,
  TRANSACTION_KINDS,
  FUND_SOURCES,
  isValidTransactionAllocation,
  normalizeTransactionAllocation,
} from '../utils/transactionAllocation.js'

const TRANSACTIONS_PATH = 'couples/main/transactions'

function txCollection() {
  return collection(db, TRANSACTIONS_PATH)
}

function txDoc(id) {
  return doc(db, TRANSACTIONS_PATH, id)
}

function normalizeTransactionRecord(txData, fallbackPersonUid) {
  const allocation = normalizeTransactionAllocation(txData, fallbackPersonUid)
  return {
    ...txData,
    allocationType: allocation.allocationType,
    splits: allocation.splits,
    personUid: allocation.allocationType === ALLOCATION_TYPES.SINGLE
      ? allocation.splits[0].personUid
      : null,
    // Ensure new fields have defaults for backward compat
    transactionKind: txData.transactionKind || TRANSACTION_KINDS.STANDARD,
    impactCompteCommun: txData.impactCompteCommun !== false,
    fundSource: txData.fundSource || FUND_SOURCES.COMMON,
  }
}

function getPreparedAllocation(txInput, fallbackPersonUid) {
  const allocation = normalizeTransactionAllocation(txInput, fallbackPersonUid)
  if (!isValidTransactionAllocation(allocation.allocationType, allocation.splits)) {
    throw new Error('Transaction allocation is invalid')
  }
  return allocation
}

/**
 * Subscribe to all transactions in real time.
 * @param {(txs: Array) => void} callback
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe function
 */
export function subscribeToTransactions(callback, onError, fallbackPersonUid) {
  const q = query(txCollection(), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const txs = snapshot.docs.map((d) => normalizeTransactionRecord({
      id: d.id,
      ...d.data(),
    }, fallbackPersonUid))
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
export async function createTransaction(txInput, currentUid, fallbackPersonUid) {
  const now = new Date().toISOString()
  const allocation = getPreparedAllocation(txInput, fallbackPersonUid || currentUid)
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
    allocationType: allocation.allocationType,
    splits: allocation.splits,
    personUid: allocation.allocationType === ALLOCATION_TYPES.SINGLE ? allocation.splits[0].personUid : null,
    // New fields
    transactionKind: txInput.transactionKind || TRANSACTION_KINDS.STANDARD,
    impactCompteCommun: txInput.impactCompteCommun !== false,
    fundSource: txInput.fundSource || FUND_SOURCES.COMMON,
    paidByUid: txInput.paidByUid || null,
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
export async function updateTransaction(transactionId, updates, currentUid, fallbackPersonUid) {
  const now = new Date().toISOString()
  const hasAllocationPayload = updates.allocationType != null || updates.splits != null || updates.personUid != null
  const allocationUpdates = hasAllocationPayload
    ? getPreparedAllocation(updates, fallbackPersonUid || currentUid)
    : null

  await updateDoc(txDoc(transactionId), {
    ...updates,
    ...(allocationUpdates ? {
      allocationType: allocationUpdates.allocationType,
      splits: allocationUpdates.splits,
      personUid: allocationUpdates.allocationType === ALLOCATION_TYPES.SINGLE
        ? allocationUpdates.splits[0].personUid
        : null,
    } : {}),
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
export async function toggleTransactionActive(transaction, currentUid, fallbackPersonUid) {
  const allocation = getPreparedAllocation(transaction, fallbackPersonUid || currentUid)
  await updateTransaction(transaction.id, {
    isActive: !transaction.isActive,
    allocationType: allocation.allocationType,
    splits: allocation.splits,
    personUid: allocation.allocationType === ALLOCATION_TYPES.SINGLE
      ? allocation.splits[0].personUid
      : null,
  }, currentUid, fallbackPersonUid)
}
