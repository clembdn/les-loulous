import { collection, doc, onSnapshot, getDoc, setDoc, updateDoc, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Journal alimentaire, un document par jour et PAR PERSONNE (comme les séances
// MuscAuzi) : Clément et Lise n'ont ni les mêmes repas ni les mêmes objectifs.
//
// Les macros sont figées dans l'entrée au moment de l'ajout, jamais recalculées
// depuis la recette ou l'aliment : corriger une fiche aujourd'hui ne doit pas
// réécrire ce qu'on a mangé la semaine dernière.

function path(uid) { return `users/${uid}/foodLog` }
function col(uid) { return collection(db, path(uid)) }
function dayDoc(uid, dateId) { return doc(db, path(uid), dateId) }

export const SLOTS = [
  { id: 'matin', label: 'Matin' },
  { id: 'midi', label: 'Midi' },
  { id: 'soir', label: 'Soir' },
  { id: 'snack', label: 'En-cas' },
]

const SLOT_IDS = SLOTS.map((s) => s.id)

function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

function normalizeEntry(raw) {
  return {
    id: raw?.id || genId(),
    slot: SLOT_IDS.includes(raw?.slot) ? raw.slot : 'midi',
    kind: raw?.kind === 'recipe' ? 'recipe' : 'food',
    refId: raw?.refId || null,
    label: String(raw?.label || '').trim(),
    amount: num(raw?.amount),
    amountUnit: raw?.amountUnit === 'portion' ? 'portion' : 'g',
    kcal: num(raw?.kcal),
    proteins: num(raw?.proteins),
    carbs: num(raw?.carbs),
    fat: num(raw?.fat),
  }
}

function normalizeDay(raw) {
  return {
    id: raw.id,
    date: raw.date || raw.id,
    entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry) : [],
  }
}

export function subscribeToDay(uid, dateId, callback, onError) {
  return onSnapshot(dayDoc(uid, dateId), (snap) => {
    callback(snap.exists() ? normalizeDay({ id: snap.id, ...snap.data() }) : { id: dateId, date: dateId, entries: [] })
  }, (err) => {
    console.error('[Cook’It] foodLog error:', err)
    onError?.(err)
  })
}

// Plage de jours (semaine / mois) pour les statistiques.
export function subscribeToRange(uid, startId, endId, callback, onError) {
  const q = query(col(uid), where('date', '>=', startId), where('date', '<=', endId), orderBy('date', 'asc'))
  return onSnapshot(q, (snap) => {
    const map = {}
    snap.docs.forEach((d) => { map[d.id] = normalizeDay({ id: d.id, ...d.data() }) })
    callback(map)
  }, (err) => {
    console.error('[Cook’It] foodLog range error:', err)
    onError?.(err)
  })
}

// Écriture fire-and-forget : hors ligne la promesse ne se résout jamais, l'UI
// ne doit surtout pas l'attendre (le cache Firestore affiche déjà le résultat).
async function writeEntries(uid, dateId, mutate) {
  const ref = dayDoc(uid, dateId)
  const now = new Date().toISOString()
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const cur = Array.isArray(snap.data().entries) ? snap.data().entries : []
    await updateDoc(ref, { entries: mutate(cur), updatedAt: now, updatedBy: uid })
  } else {
    await setDoc(ref, {
      date: dateId,
      entries: mutate([]),
      createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid,
    })
  }
}

export function addEntry(uid, dateId, entry) {
  const e = normalizeEntry(entry)
  return writeEntries(uid, dateId, (cur) => [...cur, e]).catch((err) => {
    console.error('[Cook’It] addEntry error:', err)
  })
}

export function removeEntry(uid, dateId, entryId) {
  return writeEntries(uid, dateId, (cur) => cur.filter((e) => e.id !== entryId)).catch((err) => {
    console.error('[Cook’It] removeEntry error:', err)
  })
}
