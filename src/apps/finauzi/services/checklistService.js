import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AUTHORIZED_UIDS } from '@/shared/config/people.js'
import { CHECKLIST_SUGGESTIONS } from '../config/checklistSuggestions.js'

const CHECKLIST_PATH = 'couples/main/checklist'

function checklistCollection() {
  return collection(db, CHECKLIST_PATH)
}

function checklistDoc(id) {
  return doc(db, CHECKLIST_PATH, id)
}

function normalize(raw) {
  const status = ['todo', 'in-progress', 'done'].includes(raw.status) ? raw.status : 'todo'
  const section = ['before', 'arrival', 'luggage'].includes(raw.section) ? raw.section : 'before'
  return {
    id: raw.id,
    label: raw.label || '',
    section,
    status,
    order: Number(raw.order) || 0,
    notes: raw.notes || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
    completedAt: raw.completedAt || null,
    completedBy: AUTHORIZED_UIDS.includes(raw.completedBy) ? raw.completedBy : null,
  }
}

export function subscribeToChecklist(callback, onError) {
  const q = query(checklistCollection(), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[FinAuzi] checklist error:', err)
    onError?.(err)
  })
}

export async function createChecklistItem({ label, section }, currentUid) {
  const now = new Date().toISOString()
  const data = {
    label: String(label || '').trim(),
    section: ['before', 'arrival', 'luggage'].includes(section) ? section : 'before',
    status: 'todo',
    // Date.now() avoids races when both users add simultaneously.
    order: Date.now(),
    notes: null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
    completedAt: null,
    completedBy: null,
  }
  const ref = await addDoc(checklistCollection(), data)
  return ref.id
}

export async function updateChecklistItem(id, updates, currentUid) {
  const now = new Date().toISOString()
  const payload = {
    ...updates,
    updatedAt: now,
    updatedBy: currentUid,
  }
  if (updates.status === 'done') {
    payload.completedAt = now
    payload.completedBy = currentUid
  }
  if (updates.status && updates.status !== 'done') {
    payload.completedAt = null
    payload.completedBy = null
  }
  await updateDoc(checklistDoc(id), payload)
}

export async function deleteChecklistItem(id) {
  await deleteDoc(checklistDoc(id))
}

// One-shot seed of the suggestions. Uses a batch write so it lands atomically.
export async function seedChecklistSuggestions(currentUid) {
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  CHECKLIST_SUGGESTIONS.forEach((sugg, i) => {
    const ref = doc(checklistCollection())
    batch.set(ref, {
      label: sugg.label,
      section: sugg.section,
      status: 'todo',
      order: (i + 1) * 1000,
      notes: null,
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
      completedAt: null,
      completedBy: null,
    })
  })
  await batch.commit()
}
