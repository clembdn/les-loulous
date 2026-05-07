// FinAuzi — Settings Service
// Shared couple settings stored in Firestore.
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

const SETTINGS_DOC = doc(db, 'couples/main/settings/main')

export const DEFAULT_SETTINGS = {
  initialCapitalEUR: 10000,
  safetyBufferEUR: 1500,
  selectedCurrency: 'EUR',
}

/**
 * Subscribe to settings in real time.
 * @param {(settings: Object) => void} callback
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function subscribeToSettings(callback, onError) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...snap.data() })
    } else {
      callback({ ...DEFAULT_SETTINGS })
    }
  }, (error) => {
    console.error('[FinAuzi] Firestore settings error:', error)
    if (onError) onError(error)
    callback({ ...DEFAULT_SETTINGS })
  })
}

/**
 * Get settings once (non-realtime).
 */
export async function getSettings() {
  const snap = await getDoc(SETTINGS_DOC)
  if (snap.exists()) return { ...DEFAULT_SETTINGS, ...snap.data() }
  return { ...DEFAULT_SETTINGS }
}

/**
 * Update settings.
 */
export async function updateSettings(updates, currentUid) {
  const now = new Date().toISOString()
  await setDoc(SETTINGS_DOC, {
    ...updates,
    updatedAt: now,
    updatedBy: currentUid,
  }, { merge: true })
}
