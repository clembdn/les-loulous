import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { TIMELINE_SUGGESTIONS } from '../config/timelineSuggestions.js'

const TIMELINE_PATH = 'couples/main/timeline'

function timelineCollection() {
  return collection(db, TIMELINE_PATH)
}

function timelineDoc(id) {
  return doc(db, TIMELINE_PATH, id)
}

function normalize(raw) {
  return {
    id: raw.id,
    label: raw.label || '',
    date: raw.date || '',
    description: raw.description || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

export function subscribeToTimeline(callback, onError) {
  const q = query(timelineCollection(), orderBy('date', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[FinAuzi] timeline error:', err)
    onError?.(err)
  })
}

export async function createTimelineItem({ label, date, description }, currentUid) {
  const now = new Date().toISOString()
  const data = {
    label: String(label || '').trim(),
    date: String(date || '').slice(0, 10),
    description: description ? String(description).trim() : null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  const ref = await addDoc(timelineCollection(), data)
  return ref.id
}

export async function updateTimelineItem(id, updates, currentUid) {
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }
  if (updates.label != null) payload.label = String(updates.label).trim()
  if (updates.description !== undefined) {
    payload.description = updates.description ? String(updates.description).trim() : null
  }
  if (updates.date != null) payload.date = String(updates.date).slice(0, 10)
  await updateDoc(timelineDoc(id), payload)
}

export async function deleteTimelineItem(id) {
  await deleteDoc(timelineDoc(id))
}

export async function seedTimelineSuggestions(currentUid) {
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  TIMELINE_SUGGESTIONS.forEach((sugg) => {
    const ref = doc(timelineCollection())
    batch.set(ref, {
      label: sugg.label,
      date: sugg.date,
      description: sugg.description || null,
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  })
  await batch.commit()
}
