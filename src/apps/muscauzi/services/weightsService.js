import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { toLocalDateKey } from '@/shared/lib/dates.js'

// Pesées d'un profil : `users/{uid}/weights/{yyyy-mm-dd}`, une par jour.
// L'id étant la date, se peser deux fois le même jour écrase — c'est voulu.
function weightsCol(uid) { return collection(db, 'users', uid, 'weights') }
function weightDoc(uid, dateId) { return doc(db, 'users', uid, 'weights', dateId) }

export function subscribeToWeights(uid, callback, onError) {
  return onSnapshot(weightsCol(uid), (snap) => {
    // L'id du document EST la date : tri lexicographique côté client.
    callback(snap.docs
      .map((d) => ({ date: d.id, value: Number(d.data()?.value) }))
      .filter((w) => Number.isFinite(w.value))
      .sort((a, b) => a.date.localeCompare(b.date)))
  }, (err) => {
    console.error('[MuscAuzi] weights error:', err)
    onError?.(err)
  })
}

// La date est toujours celle du jour : on se pèse au moment où on saisit.
export function recordWeight(uid, value, currentUid) {
  const dateId = toLocalDateKey(new Date())
  setDoc(weightDoc(uid, dateId), {
    value: Number(value),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] recordWeight failed:', err)
  })
  return dateId
}
