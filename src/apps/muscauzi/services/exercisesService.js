import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { DEFAULT_TYPE, EXERCISE_TYPE_BY_ID } from '../config/exercises.js'

// Catalogue d'exercices — COMMUN aux deux profils (seul l'historique est cloisonné).
const PATH = 'exercises'
const col = () => collection(db, PATH)
const ref = (id) => doc(db, PATH, id)

function resolveType(raw) {
  return EXERCISE_TYPE_BY_ID[raw] ? raw : DEFAULT_TYPE
}

function normalize(raw) {
  const type = resolveType(raw.type)
  return {
    id: raw.id,
    name: raw.name || '',
    type,
    // Un exercice au poids du corps porte le flag ; le type `bodyweight` l'implique.
    bodyweight: raw.bodyweight === true || type === 'bodyweight',
  }
}

export function subscribeToExercises(callback, onError) {
  return onSnapshot(query(col(), orderBy('name', 'asc')), (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[MuscAuzi] exercises error:', err)
    onError?.(err)
  })
}

export function addExercise(input, currentUid) {
  const now = new Date().toISOString()
  const type = resolveType(input.type)
  return addDoc(col(), {
    name: String(input.name || '').trim(),
    type,
    bodyweight: input.bodyweight === true || type === 'bodyweight',
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

export function updateExercise(id, updates, currentUid) {
  const payload = { updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.type != null) payload.type = resolveType(updates.type)
  if ('bodyweight' in updates || updates.type != null) {
    const type = payload.type || resolveType(updates.type)
    payload.bodyweight = updates.bodyweight === true || type === 'bodyweight'
  }
  return updateDoc(ref(id), payload)
}

export function deleteExercise(id) {
  return deleteDoc(ref(id))
}
