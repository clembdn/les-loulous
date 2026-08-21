import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { DEFAULT_TYPE, EXERCISE_TYPE_BY_ID } from '../config/exercises.js'

// Catalogue d'exercices PERSONNEL : `users/{uid}/exercises/{id}`.
//
// Il était commun aux deux profils à l'origine. C'était une erreur : supprimer
// un exercice depuis un compte le supprimait aussi chez l'autre, et laissait
// son programme pointer dans le vide. Chacun a désormais son catalogue, comme
// il a déjà ses séances, son programme et ses pesées.
function exercisesCol(uid) { return collection(db, 'users', uid, 'exercises') }
function exerciseDoc(uid, id) { return doc(db, 'users', uid, 'exercises', id) }

function resolveType(raw) {
  return EXERCISE_TYPE_BY_ID[raw] ? raw : DEFAULT_TYPE
}

function normalize(raw) {
  const type = resolveType(raw.type)
  return {
    id: raw.id,
    name: raw.name || '',
    type,
    // Un exercice au poids du corps porte le flag ; le type l'implique.
    bodyweight: raw.bodyweight === true || type === 'bodyweight',
  }
}

export function subscribeToExercises(uid, callback, onError) {
  return onSnapshot(query(exercisesCol(uid), orderBy('name', 'asc')), (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[MuscAuzi] exercises error:', err)
    onError?.(err)
  })
}

export function addExercise(uid, input, currentUid) {
  const now = new Date().toISOString()
  const type = resolveType(input.type)
  return addDoc(exercisesCol(uid), {
    name: String(input.name || '').trim(),
    type,
    bodyweight: input.bodyweight === true || type === 'bodyweight',
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

export function updateExercise(uid, id, updates, currentUid) {
  const payload = { updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.type != null) payload.type = resolveType(updates.type)
  if ('bodyweight' in updates || updates.type != null) {
    const type = payload.type || resolveType(updates.type)
    payload.bodyweight = updates.bodyweight === true || type === 'bodyweight'
  }
  return updateDoc(exerciseDoc(uid, id), payload)
}

export function deleteExercise(uid, id) {
  return deleteDoc(exerciseDoc(uid, id))
}
