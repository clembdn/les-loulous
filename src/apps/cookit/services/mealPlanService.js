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

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

// Nutrition FIGÉE au moment de la planification, par personne :
//   { <uid>: { kcal, proteins, carbs, fat } }
// Figée pour la même raison que dans le journal — corriger la recette la semaine
// prochaine ne doit pas réécrire ce qui a été mangé aujourd'hui.
//
// Elle vit dans le document mealPlan, qui est PARTAGÉ. C'est ce qui permet à
// chacun de lire sa propre part sans que l'autre ait à lui écrire quoi que ce
// soit : les règles Firestore interdisent d'écrire dans le journal du conjoint.
function normalizeNutrition(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = {}
  for (const [uid, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue
    out[uid] = { kcal: num(v.kcal), proteins: num(v.proteins), carbs: num(v.carbs), fat: num(v.fat) }
  }
  return Object.keys(out).length ? out : null
}

// Un plat : recette liée (recipeId) ou repas libre (title seul), étiqueté « pour qui ».
function normalizeMeal(raw) {
  const portions = Number(raw?.portions)
  return {
    id: raw?.id || genId(),
    recipeId: raw?.recipeId || null,
    title: String(raw?.title || '').trim(),
    who: raw?.who || 'both',
    portions: Number.isFinite(portions) && portions > 0 ? portions : 1,
    nutrition: normalizeNutrition(raw?.nutrition),
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
    console.error('[Cook’It] mealPlan error:', err)
    onError?.(err)
  })
}

// Abonnement à UNE journée — c'est ce dont le journal a besoin.
export function subscribeToDay(dateId, callback, onError) {
  return onSnapshot(dayDoc(dateId), (snap) => {
    callback(snap.exists()
      ? normalizeDay({ id: snap.id, ...snap.data() })
      : { id: dateId, date: dateId, midi: [], soir: [] })
  }, (err) => {
    console.error('[Cook’It] mealPlan day error:', err)
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
