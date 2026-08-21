import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Programme d'un profil, une semaine paire et une semaine impaire.
//
// Un document par parité, contenant les sept jours — et non un document par
// jour : ouvrir la séance du jour ne doit coûter qu'une lecture, et le
// programme entier tient largement dans un document.
//   users/{uid}/program/{parity} → { days: { "1": [prescription], … "7": [] } }
const PARITIES = ['even', 'odd']
const DOWS = [1, 2, 3, 4, 5, 6, 7]

function programDoc(uid, parity) {
  return doc(db, 'users', uid, 'program', parity)
}

export function isParity(value) {
  return PARITIES.includes(value)
}

// Une ligne de prescription : quel exercice, combien de séries, combien de reps.
function normalizeLine(raw, index) {
  return {
    exerciseId: raw?.exerciseId || '',
    order: Number.isFinite(raw?.order) ? raw.order : index,
    sets: Math.max(1, Number(raw?.sets) || 1),
    reps: Math.max(1, Number(raw?.reps) || 1),
  }
}

function normalizeDays(raw) {
  const days = {}
  for (const dow of DOWS) {
    const list = Array.isArray(raw?.[dow]) ? raw[dow] : Array.isArray(raw?.[String(dow)]) ? raw[String(dow)] : []
    days[dow] = list
      .map(normalizeLine)
      .filter((l) => l.exerciseId)
      .sort((a, b) => a.order - b.order)
      .map((l, i) => ({ ...l, order: i }))
  }
  return days
}

export function emptyProgram() {
  return normalizeDays(null)
}

export function subscribeToProgram(uid, parity, callback, onError) {
  return onSnapshot(programDoc(uid, parity), (snap) => {
    callback(normalizeDays(snap.exists() ? snap.data()?.days : null))
  }, (err) => {
    console.error('[MuscAuzi] program error:', err)
    onError?.(err)
    callback(emptyProgram())
  })
}

// Réécrit la prescription d'un jour. Les séances déjà enregistrées ne bougent
// pas : elles portent leur propre `programSnapshot`.
export function saveProgramDay(uid, parity, dayOfWeek, lines, currentUid) {
  const cleaned = lines
    .map(normalizeLine)
    .filter((l) => l.exerciseId)
    .map((l, i) => ({ ...l, order: i }))
  return setDoc(programDoc(uid, parity), {
    days: { [dayOfWeek]: cleaned },
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}

export { PARITIES, DOWS }
