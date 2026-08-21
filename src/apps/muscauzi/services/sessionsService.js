import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteField, query, where, documentId,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Séances d'un profil : un document par jour, `users/{uid}/sessions/{yyyy-mm-dd}`.
// La clé est une date LOCALE (cf. @/shared/lib/dates.js).
//
// MuscAuzi ne gère qu'UNE séance par utilisateur et par jour. Rouvrir l'appli
// le même jour reprend la séance existante : jamais de fusion, jamais
// d'écrasement, jamais de seconde séance. Le chemin du document suffit à
// garantir la règle.
//
// `entries` est indexée par `instanceId` (l'occurrence dans le programme), et
// non par `exerciseId` : un même mouvement peut figurer deux fois dans la
// séance sans que les deux jeux de séries se recouvrent.
function sessionsCol(uid) { return collection(db, 'users', uid, 'sessions') }
function sessionDoc(uid, dateKey) { return doc(db, 'users', uid, 'sessions', dateKey) }

// Cache de la DERNIÈRE performance, dénormalisé dans UN document : ouvrir la
// séance du jour coûte une seule lecture pour tous les rappels. Ce n'est
// jamais la source des courbes — elles se calculent sur l'historique.
function lastPerfDoc(uid) { return doc(db, 'users', uid, 'meta', 'lastPerf') }

function normalizeSet(raw) {
  return {
    weightKg: Number.isFinite(Number(raw?.weightKg)) ? Number(raw.weightKg) : 0,
    reps: Math.max(0, Math.round(Number(raw?.reps) || 0)),
    // Une série pré-remplie mais jamais validée ne compte dans aucune métrique.
    completed: raw?.completed === true,
  }
}

// `sets` est une MAP indexée par un rang numérique en chaîne ("0", "1", …).
// Les clés ne sont PAS renumérotées après suppression d'une série ajoutée :
// seule la numérotation affichée reste continue.
function normalizeSets(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(key)) continue
    out[key] = normalizeSet(value)
  }
  return out
}

function normalizeEntry(raw) {
  return {
    sets: normalizeSets(raw?.sets),
    skipped: raw?.skipped === true,
  }
}

// Ligne de prescription figée dans la séance. Le NOM y est recopié pour que
// renommer un exercice plus tard ne réécrive pas les libellés du passé.
function normalizeSnapshotLine(raw, index) {
  return {
    instanceId: raw?.instanceId || `legacy-${index}`,
    exerciseId: raw?.exerciseId || '',
    name: raw?.name || '',
    order: Number.isFinite(raw?.order) ? raw.order : index,
    sets: Math.max(1, Number(raw?.sets) || 1),
    reps: Math.max(1, Number(raw?.reps) || 1),
  }
}

export function normalizeSession(id, raw) {
  if (!raw) return null
  const entries = {}
  for (const [instanceId, value] of Object.entries(raw.entries || {})) {
    entries[instanceId] = normalizeEntry(value)
  }
  return {
    id,
    date: id,
    parity: raw.parity === 'even' || raw.parity === 'odd' ? raw.parity : null,
    dayOfWeek: Number(raw.dayOfWeek) || null,
    programSnapshot: (Array.isArray(raw.programSnapshot) ? raw.programSnapshot : [])
      .map(normalizeSnapshotLine)
      .sort((a, b) => a.order - b.order),
    entries,
  }
}

// Séries réellement validées d'une entrée, dans l'ordre des rangs.
export function completedSets(entry) {
  if (!entry || entry.skipped) return []
  return Object.entries(entry.sets || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, s]) => s)
    .filter((s) => s.completed && s.reps > 0)
}

export function hasCompletedWork(session) {
  if (!session) return false
  return Object.values(session.entries || {}).some((e) => completedSets(e).length > 0)
}

// L'occurrence porte-t-elle quelque chose qu'on ne doit pas perdre ?
export function entryHasData(entry) {
  if (!entry) return false
  return entry.skipped || Object.keys(entry.sets || {}).length > 0
}

export function subscribeToSession(uid, dateKey, callback, onError) {
  return onSnapshot(sessionDoc(uid, dateKey), (snap) => {
    callback(snap.exists() ? normalizeSession(dateKey, snap.data()) : null)
  }, (err) => {
    console.error('[MuscAuzi] session error:', err)
    onError?.(err)
  })
}

function sortByDate(sessions) {
  // L'id du document EST la date : un tri lexicographique suffit.
  return sessions.sort((a, b) => a.date.localeCompare(b.date))
}

// Historique complet — alimente les courbes de progression.
export function subscribeToSessions(uid, callback, onError) {
  return onSnapshot(sessionsCol(uid), (snap) => {
    callback(sortByDate(snap.docs.map((d) => normalizeSession(d.id, d.data())).filter(Boolean)))
  }, (err) => {
    console.error('[MuscAuzi] sessions error:', err)
    onError?.(err)
  })
}

// Fenêtre bornée par id de document — possible seulement parce que la clé de
// date est strictement `yyyy-mm-dd` local. Sert au calendrier de régularité.
export function subscribeToSessionRange(uid, startKey, endKey, callback, onError) {
  const q = query(
    sessionsCol(uid),
    where(documentId(), '>=', startKey),
    where(documentId(), '<=', endKey),
  )
  return onSnapshot(q, (snap) => {
    callback(sortByDate(snap.docs.map((d) => normalizeSession(d.id, d.data())).filter(Boolean)))
  }, (err) => {
    console.error('[MuscAuzi] session range error:', err)
    onError?.(err)
  })
}

export function subscribeToLastPerf(uid, callback, onError) {
  return onSnapshot(lastPerfDoc(uid), (snap) => {
    const data = snap.exists() ? snap.data() : null
    callback({
      byInstance: data?.byInstance || {},
      byExercise: data?.byExercise || {},
    })
  }, (err) => {
    console.error('[MuscAuzi] lastPerf error:', err)
    onError?.(err)
    callback({ byInstance: {}, byExercise: {} })
  })
}

/**
 * Écrit une entrée d'exercice dans la séance du jour.
 *
 * `meta` ({ parity, dayOfWeek, programSnapshot }) n'est transmis QUE si la
 * séance n'existe pas encore : le snapshot est figé à la création et n'est
 * réécrit que par un changement explicite de séance. Modifier son programme
 * dans les réglages ne réécrit jamais l'historique.
 *
 * Aucun `await` côté UI : le cache Firestore encaisse l'écriture et la
 * synchronise au retour du réseau — la salle capte mal.
 */
export function upsertEntry(uid, dateKey, target, entry, currentUid, meta) {
  const { instanceId, exerciseId } = target
  const now = new Date().toISOString()
  const clean = normalizeEntry(entry)

  const payload = {
    entries: { [instanceId]: clean },
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
  setDoc(sessionDoc(uid, dateKey), payload, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] upsertEntry failed:', err)
  })

  // Le cache ne retient que du travail réellement validé.
  const done = completedSets(clean)
  if (done.length === 0) return
  const perf = { date: dateKey, sets: done.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) }
  const cache = { byInstance: { [instanceId]: perf }, updatedAt: now }
  if (exerciseId) cache.byExercise = { [exerciseId]: perf }
  setDoc(lastPerfDoc(uid), cache, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] lastPerf write failed:', err)
  })
}

// Retire une occurrence de la séance (annule un « non fait » ou une saisie).
export function clearEntry(uid, dateKey, instanceId, currentUid) {
  setDoc(sessionDoc(uid, dateKey), {
    entries: { [instanceId]: deleteField() },
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] clearEntry failed:', err)
  })
}

/**
 * Re-photographie la séance du JOUR sans rien effacer.
 *
 * Changer de jour ou de parité ne doit JAMAIS coûter le travail déjà fait. Les
 * `entries` sont laissées intactes ; c'est l'appelant qui construit le nouveau
 * `programSnapshot` en gardant les lignes qui portent des données (cf.
 * `mergeSnapshot`). Chaque entrée conserve donc sa ligne de prescription :
 * rien n'est orphelin, et revenir au jour précédent réaffiche tout.
 *
 * Les séances passées ne sont jamais touchées.
 */
export function updateSessionPlan(uid, dateKey, meta, currentUid) {
  updateDoc(sessionDoc(uid, dateKey), {
    parity: meta.parity,
    dayOfWeek: meta.dayOfWeek,
    programSnapshot: meta.programSnapshot,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }).catch((err) => {
    console.error('[MuscAuzi] updateSessionPlan failed:', err)
  })
}

/**
 * Prescription de la nouvelle séance + tout ce qui a déjà été saisi aujourd'hui.
 *
 * Les lignes de l'ancien jour qui portent des séries sont conservées à la
 * suite : sans elles, les entrées correspondantes deviendraient invisibles et
 * disparaîtraient des courbes, qui parcourent le snapshot.
 */
export function mergeSnapshot(session, nextLines) {
  if (!session) return nextLines.map((l, i) => ({ ...l, order: i }))
  const nextIds = new Set(nextLines.map((l) => l.instanceId))
  const preserved = session.programSnapshot.filter(
    (l) => !nextIds.has(l.instanceId) && entryHasData(session.entries?.[l.instanceId]),
  )
  return [...nextLines, ...preserved].map((l, i) => ({ ...l, order: i }))
}
