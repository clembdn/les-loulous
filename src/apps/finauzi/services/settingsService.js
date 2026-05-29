import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

const SETTINGS_DOC = doc(db, 'couples/main/settings/main')

export const DEFAULT_SETTINGS = {
  initialCapitalEUR: 10000,
  commonInitialCapitalEUR: 0,
  safetyBufferEUR: 1500,
  budgets: {},
  // Per-user palette choice. Each user picks one of COLOR_PALETTE ids.
  // A color claimed by one uid is locked for the other.
  userColors: {},
  // Display currency settings.
  // Internal data stays in EUR; AUD is shown by converting at this rate.
  currency: 'EUR',
  eurToAud: 1.65,
}

export function subscribeToSettings(callback, onError) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...snap.data() })
    } else {
      callback({ ...DEFAULT_SETTINGS })
    }
  }, (error) => {
    console.error('[FinAuzi] settings error:', error)
    onError?.(error)
    callback({ ...DEFAULT_SETTINGS })
  })
}

export async function getSettings() {
  const snap = await getDoc(SETTINGS_DOC)
  if (snap.exists()) return { ...DEFAULT_SETTINGS, ...snap.data() }
  return { ...DEFAULT_SETTINGS }
}

export async function updateSettings(updates, currentUid) {
  await setDoc(SETTINGS_DOC, {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}
