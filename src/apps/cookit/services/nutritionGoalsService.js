import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Objectifs nutritionnels, par personne.
// Un seul document : users/{uid}/meta/nutritionGoals

function goalsDoc(uid) { return doc(db, `users/${uid}/meta`, 'nutritionGoals') }

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

export function normalizeGoals(raw) {
  return {
    kcal: num(raw?.kcal),
    proteins: num(raw?.proteins),
    carbs: num(raw?.carbs),
    fat: num(raw?.fat),
    mode: raw?.mode === 'computed' ? 'computed' : 'manual',
    profile: raw?.profile
      ? {
        heightCm: num(raw.profile.heightCm),
        birthYear: num(raw.profile.birthYear),
        sex: raw.profile.sex === 'f' ? 'f' : 'h',
        activity: Number(raw.profile.activity) || 1.375,
        aim: ['perte', 'maintien', 'prise'].includes(raw.profile.aim) ? raw.profile.aim : 'maintien',
      }
      : null,
  }
}

export function subscribeToGoals(uid, callback, onError) {
  return onSnapshot(goalsDoc(uid), (snap) => {
    callback(snap.exists() ? normalizeGoals(snap.data()) : null)
  }, (err) => {
    console.error('[Cook’It] goals error:', err)
    onError?.(err)
  })
}

export function saveGoals(uid, goals) {
  const now = new Date().toISOString()
  return setDoc(goalsDoc(uid), {
    ...normalizeGoals(goals),
    createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid,
  }).catch((err) => console.error('[Cook’It] saveGoals error:', err))
}
