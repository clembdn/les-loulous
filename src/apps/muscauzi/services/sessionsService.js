import { collection, doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Séances d'un profil : un document par jour, `users/{uid}/sessions/{yyyy-mm-dd}`.
//
// `entries` est une MAP indexée par exerciceId (et non un tableau) : valider une
// série ne réécrit alors que son propre champ, sans lire-modifier-écrire tout
// le document. L'ordre d'affichage vient de `programSnapshot`, pas des entrées.
function sessionsCol(uid) { return collection(db, 'users', uid, 'sessions') }
function sessionDoc(uid, dateId) { return doc(db, 'users', uid, 'sessions', dateId) }

// Dernière perf par exercice, dénormalisée dans UN document : ouvrir la séance
// du jour coûte une seule lecture pour tous les rappels « dernière fois ».
function lastPerfDoc(uid) { return doc(db, 'users', uid, 'meta', 'lastPerf') }

function normalizeSet(raw) {
  return {
    weight: Number.isFinite(Number(raw?.weight)) ? Number(raw.weight) : 0,
    reps: Math.max(0, Math.round(Number(raw?.reps) || 0)),
  }
}

function normalizeEntry(raw) {
  return {
    sets: Array.isArray(raw?.sets) ? raw.sets.map(normalizeSet) : [],
    skipped: raw?.skipped === true,
  }
}

export function normalizeSession(id, raw) {
  if (!raw) return null
  const entries = {}
  for (const [exerciseId, value] of Object.entries(raw.entries || {})) {
    entries[exerciseId] = normalizeEntry(value)
  }
  return {
    id,
    date: id,
    parity: raw.parity === 'even' || raw.parity === 'odd' ? raw.parity : null,
    dayOfWeek: Number(raw.dayOfWeek) || null,
    programSnapshot: Array.isArray(raw.programSnapshot) ? raw.programSnapshot : [],
    entries,
  }
}

export function subscribeToSession(uid, dateId, callback, onError) {
  return onSnapshot(sessionDoc(uid, dateId), (snap) => {
    callback(snap.exists() ? normalizeSession(dateId, snap.data()) : null)
  }, (err) => {
    console.error('[MuscAuzi] session error:', err)
    onError?.(err)
  })
}

// Historique complet — alimente les courbes de progression.
export function subscribeToSessions(uid, callback, onError) {
  return onSnapshot(sessionsCol(uid), (snap) => {
    // L'id du document EST la date : un tri lexicographique suffit, et évite
    // d'imposer un index ou un champ de tri dédié.
    callback(snap.docs
      .map((d) => normalizeSession(d.id, d.data()))
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date)))
  }, (err) => {
    console.error('[MuscAuzi] sessions error:', err)
    onError?.(err)
  })
}

export function subscribeToLastPerf(uid, callback, onError) {
  return onSnapshot(lastPerfDoc(uid), (snap) => {
    callback(snap.exists() ? (snap.data()?.perfs || {}) : {})
  }, (err) => {
    console.error('[MuscAuzi] lastPerf error:', err)
    onError?.(err)
    callback({})
  })
}

/**
 * Écrit une entrée d'exercice dans la séance du jour.
 *
 * `meta` ({ parity, dayOfWeek, programSnapshot }) n'est passé QUE si la séance
 * n'existe pas encore : le snapshot du programme est figé à la création et ne
 * doit jamais être réécrit ensuite — modifier son programme dans les réglages
 * ne réécrit pas l'historique.
 *
 * Aucun `await` côté UI : le cache Firestore encaisse l'écriture et la
 * synchronise au retour du réseau (la salle capte mal).
 */
export function upsertEntry(uid, dateId, exerciseId, entry, currentUid, meta) {
  const now = new Date().toISOString()
  const clean = normalizeEntry(entry)
  const payload = {
    entries: { [exerciseId]: clean },
    updatedAt: now,
    updatedBy: currentUid,
  }
  if (meta) {
    payload.parity = meta.parity
    payload.dayOfWeek = meta.dayOfWeek
    payload.programSnapshot = meta.programSnapshot
    payload.createdAt = now
    payload.createdBy = currentUid
  }
  setDoc(sessionDoc(uid, dateId), payload, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] upsertEntry failed:', err)
  })

  // La dernière perf ne retient que les séances réellement faites.
  const hasWork = !clean.skipped && clean.sets.some((s) => s.reps > 0)
  if (hasWork) {
    setDoc(lastPerfDoc(uid), {
      perfs: { [exerciseId]: { date: dateId, sets: clean.sets } },
      updatedAt: now,
    }, { merge: true }).catch((err) => {
      console.error('[MuscAuzi] lastPerf write failed:', err)
    })
  }
}

// Retire un exercice de la séance (annule un « non fait » ou une saisie).
export function clearEntry(uid, dateId, exerciseId, currentUid) {
  setDoc(sessionDoc(uid, dateId), {
    entries: { [exerciseId]: deleteField() },
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] clearEntry failed:', err)
  })
}

/**
 * Re-photographie la prescription de la séance du JOUR.
 *
 * Déclenché uniquement quand on force manuellement la parité ou le jour depuis
 * l'écran de séance : c'est une correction de la séance en cours, pas une
 * réécriture d'historique — les séances passées ne sont jamais touchées.
 */
export function updateSessionPlan(uid, dateId, meta, currentUid) {
  setDoc(sessionDoc(uid, dateId), {
    parity: meta.parity,
    dayOfWeek: meta.dayOfWeek,
    programSnapshot: meta.programSnapshot,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] updateSessionPlan failed:', err)
  })
}
