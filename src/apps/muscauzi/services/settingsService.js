import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

/**
 * Réglages MuscAuzi d'un profil : `users/{uid}/meta/muscauzi`.
 *
 *   weightRateMin, weightRateMax  la zone cible du rythme de poids, en kg/semaine
 *                                 (null = pas de cible) — cf. utils/weightTrend.js
 *   lightWeekStart                le jour où la semaine allégée a été lancée,
 *                                 clé locale « AAAA-MM-JJ » (null = aucune)
 *                                 — cf. utils/lightWeek.js
 *
 * L'alternance paire/impaire n'est PAS ici : elle vit sur `program/even`,
 * qu'on lit déjà pour afficher la séance (cf. programService).
 *
 * Un document absent vaut « rien de réglé ». Si les règles Firestore n'ont pas
 * encore été publiées, la lecture échoue : on retombe sur ces mêmes défauts,
 * et seule l'écriture signale l'erreur.
 */
export const DEFAULT_SETTINGS = { weightTarget: null, lightWeekStart: null }

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function settingsDoc(uid) { return doc(db, 'users', uid, 'meta', 'muscauzi') }

function normalize(raw) {
  const min = Number(raw?.weightRateMin)
  const max = Number(raw?.weightRateMax)
  const hasTarget = raw?.weightRateMin != null && raw?.weightRateMax != null
    && Number.isFinite(min) && Number.isFinite(max)
  return {
    weightTarget: hasTarget ? { min: Math.min(min, max), max: Math.max(min, max) } : null,
    lightWeekStart: typeof raw?.lightWeekStart === 'string' && DATE_KEY.test(raw.lightWeekStart)
      ? raw.lightWeekStart
      : null,
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

/** Lance la semaine allégée le jour `dateKey`, ou l'arrête avec `null`. */
export function saveLightWeekStart(uid, dateKey, currentUid) {
  return write(uid, { lightWeekStart: dateKey && DATE_KEY.test(dateKey) ? dateKey : null }, currentUid)
}
