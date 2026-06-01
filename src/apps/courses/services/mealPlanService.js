import {
  collection, doc, onSnapshot, getDoc, setDoc, updateDoc, query, where, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

const PATH = 'couples/main/mealPlan'
function col() { return collection(db, PATH) }
function dayDoc(id) { return doc(db, PATH, id) }

function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Un plat : recette liée (recipeId) ou repas libre (title seul), étiqueté « pour qui ».
function normalizeMeal(raw) {
  return {
    id: raw?.id || genId(),
    recipeId: raw?.recipeId || null,
    title: String(raw?.title || '').trim(),
    who: raw?.who || 'both',
  }
}

function normalizeDay(raw) {
  return {
    id: raw.id,
    date: raw.date || raw.id,
    midi: Array.isArray(raw.midi) ? raw.midi.map(normalizeMeal) : [],
    soir: Array.isArray(raw.soir) ? raw.soir.map(normalizeMeal) : [],
  }
}

// Abonnement temps réel sur une semaine (range sur `date`, borné à 7 docs).
export function subscribeToWeek(startId, endId, callback, onError) {
  const q = query(col(), where('date', '>=', startId), where('date', '<=', endId), orderBy('date', 'asc'))
  return onSnapshot(q, (snap) => {
    const map = {}
    snap.docs.forEach((d) => { map[d.id] = normalizeDay({ id: d.id, ...d.data() }) })
    callback(map)
  }, (err) => {
    console.error('[Courses] mealPlan error:', err)
    onError?.(err)
  })
}

export async function addMeal(dateId, slot, meal, currentUid) {
  const ref = dayDoc(dateId)
  const now = new Date().toISOString()
  const entry = normalizeMeal(meal)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const data = snap.data()
    const cur = Array.isArray(data[slot]) ? data[slot] : []
    await updateDoc(ref, { [slot]: [...cur, entry], updatedAt: now, updatedBy: currentUid })
  } else {
    await setDoc(ref, {
      date: dateId,
      midi: slot === 'midi' ? [entry] : [],
      soir: slot === 'soir' ? [entry] : [],
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  }
  return entry.id
}

export async function removeMeal(dateId, slot, mealId, currentUid) {
  const ref = dayDoc(dateId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const cur = Array.isArray(data[slot]) ? data[slot] : []
  await updateDoc(ref, {
    [slot]: cur.filter((m) => m.id !== mealId),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}
