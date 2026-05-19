import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'

const CHECKLIST_PATH = 'couples/main/checklist'

function checklistCollection() {
  return collection(db, CHECKLIST_PATH)
}

function checklistDoc(id) {
  return doc(db, CHECKLIST_PATH, id)
}

export function subscribeToChecklist(callback, onError) {
  const q = query(checklistCollection(), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))
    callback(items)
  }, (error) => {
    console.error('[FinAuzi] Firestore checklist error:', error)
    if (onError) onError(error)
  })
}

export async function createChecklistItem(itemInput, currentUid) {
  const now = new Date().toISOString()
  const data = {
    title: itemInput.title || '',
    description: itemInput.description || '',
    section: itemInput.section || 'Avant le départ',
    status: itemInput.status || 'todo',
    priority: itemInput.priority || 'normal',
    dueDate: itemInput.dueDate || null,
    concerns: itemInput.concerns || 'common',
    plannedCost: itemInput.plannedCost ? Number(itemInput.plannedCost) : null,
    actualCost: itemInput.actualCost ? Number(itemInput.actualCost) : null,
    currency: itemInput.currency || 'EUR',
    transactionId: itemInput.transactionId || null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  
  if (itemInput.id) {
    await setDoc(doc(db, CHECKLIST_PATH, itemInput.id), data)
    return itemInput.id
  }
  
  const ref = await addDoc(checklistCollection(), data)
  return ref.id
}

export async function updateChecklistItem(itemId, updates, currentUid) {
  const now = new Date().toISOString()
  const cleanUpdates = { ...updates }
  delete cleanUpdates.id
  
  await updateDoc(checklistDoc(itemId), {
    ...cleanUpdates,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

export async function deleteChecklistItem(itemId) {
  await deleteDoc(checklistDoc(itemId))
}
