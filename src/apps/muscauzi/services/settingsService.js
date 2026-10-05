import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

/**
 * Réglages MuscAuzi d'un profil : `users/{uid}/meta/muscauzi`.
 *
 *   weightRateMin, weightRateMax  la zone cible du rythme de poids, en kg/semaine
 *                                 (null = pas de cible) — cf. utils/weightTrend.js
 *
 * L'alternance paire/impaire n'est PAS ici : elle vit sur `program/even`,
 * qu'on lit déjà pour afficher la séance (cf. programService).
 *
 * Un document absent vaut « rien de réglé ». Si les règles Firestore n'ont pas
 * encore été publiées, la lecture échoue : on retombe sur ces mêmes défauts,
 * et seule l'écriture signale l'erreur.
 */
export const DEFAULT_SETTINGS = { weightTarget: null }

function settingsDoc(uid) { return doc(db, 'users', uid, 'meta', 'muscauzi') }

function normalize(raw) {
  const min = Number(raw?.weightRateMin)
  const max = Number(raw?.weightRateMax)
  const hasTarget = raw?.weightRateMin != null && raw?.weightRateMax != null
    && Number.isFinite(min) && Number.isFinite(max)
  return {
    weightTarget: hasTarget ? { min: Math.min(min, max), max: Math.max(min, max) } : null,
  }
}

export function subscribeToSettings(uid, callback, onError) {
  return onSnapshot(settingsDoc(uid), (snap) => {
    callback(normalize(snap.exists() ? snap.data() : null))
  }, (err) => {
    console.error('[MuscAuzi] settings error:', err)
    onError?.(err)
    callback(DEFAULT_SETTINGS)
  })
}

function write(uid, payload, currentUid) {
  return setDoc(settingsDoc(uid), {
    ...payload,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}

/** `target` = { min, max } en kg/semaine, ou null pour retirer la cible. */
export function saveWeightTarget(uid, target, currentUid) {
  return write(uid, {
    weightRateMin: target ? Math.round(target.min * 100) / 100 : null,
    weightRateMax: target ? Math.round(target.max * 100) / 100 : null,
  }, currentUid)
}
