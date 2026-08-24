import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, deleteField,
  getDoc, getDocs, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { DEFAULT_TYPE, EXERCISE_TYPE_BY_ID } from '../config/exercises.js'
import { normalizeSession } from './sessionsService.js'
import { PARITIES } from './programService.js'

// Catalogue d'exercices PERSONNEL : `users/{uid}/exercises/{id}`.
//
// Il était commun aux deux profils à l'origine. C'était une erreur : supprimer
// un exercice depuis un compte le supprimait aussi chez l'autre, et laissait
// son programme pointer dans le vide. Chacun a désormais son catalogue, comme
// il a déjà ses séances, son programme et ses pesées.
function exercisesCol(uid) { return collection(db, 'users', uid, 'exercises') }
function exerciseDoc(uid, id) { return doc(db, 'users', uid, 'exercises', id) }
function programDoc(uid, parity) { return doc(db, 'users', uid, 'program', parity) }
function sessionsCol(uid) { return collection(db, 'users', uid, 'sessions') }
function sessionDoc(uid, dateKey) { return doc(db, 'users', uid, 'sessions', dateKey) }
function noteDoc(uid, exerciseId) { return doc(db, 'users', uid, 'exerciseNotes', exerciseId) }
function lastPerfDoc(uid) { return doc(db, 'users', uid, 'meta', 'lastPerf') }


function resolveType(raw) {
  return EXERCISE_TYPE_BY_ID[raw] ? raw : DEFAULT_TYPE
}

// Le TYPE porte tout : « compter en reps » découle de « poids du corps »
// (cf. `isBodyweight`). Aucun champ `bodyweight` n'est stocké ni dérivé ici —
// il dupliquait le type et pouvait le contredire. Les anciens documents en
// portent encore un : il est simplement ignoré.
function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    type: resolveType(raw.type),
  }
}

export function subscribeToExercises(uid, callback, onError) {
  return onSnapshot(query(exercisesCol(uid), orderBy('name', 'asc')), (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[MuscAuzi] exercises error:', err)
    onError?.(err)
  })
}

export function addExercise(uid, input, currentUid) {
  const now = new Date().toISOString()
  const type = resolveType(input.type)
  return addDoc(exercisesCol(uid), {
    name: String(input.name || '').trim(),
    type,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

export function updateExercise(uid, id, updates, currentUid) {
  const payload = { updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.type != null) payload.type = resolveType(updates.type)
  return updateDoc(exerciseDoc(uid, id), payload)
}

/**
 * Ce qu'emporterait la suppression d'un exercice, sans rien écrire.
 *
 * Tout est lu ICI, une seule fois : le résultat sert d'abord à annoncer les
 * dégâts dans la confirmation, puis à les appliquer. Pas de seconde lecture
 * entre les deux.
 */
export async function collectExerciseImpact(uid, exerciseId) {
  const [noteSnap, sessionsSnap, ...programSnaps] = await Promise.all([
    getDoc(noteDoc(uid, exerciseId)),
    getDocs(sessionsCol(uid)),
    ...PARITIES.map((p) => getDoc(programDoc(uid, p))),
  ])

  // Les occurrences (`instanceId`) du mouvement, où qu'elles apparaissent :
  // ce sont elles qui indexent les entrées de séance et le cache lastPerf.
  const instanceIds = new Set()

  const programs = []
  PARITIES.forEach((parity, i) => {
    const snap = programSnaps[i]
    if (!snap.exists()) return
    const days = snap.data()?.days || {}
    const nextDays = {}
    let removed = 0
    for (const [dow, stored] of Object.entries(days)) {
      const lines = Array.isArray(stored) ? stored : []
      const kept = lines.filter((l) => l?.exerciseId !== exerciseId)
      if (kept.length === lines.length) continue
      for (const l of lines) {
        if (l?.exerciseId === exerciseId && l?.instanceId) instanceIds.add(l.instanceId)
      }
      removed += lines.length - kept.length
      nextDays[dow] = kept.map((l, index) => ({ ...l, order: index }))
    }
    if (removed > 0) programs.push({ parity, days: nextDays, removed })
  })

  // Chaque entrée de séance porte son `exerciseId` : plus besoin de passer par
  // une copie du programme pour savoir ce qu'elle contenait. `normalizeSession`
  // récupère au passage les séances écrites avant ce changement.
  const sessions = []
  for (const d of sessionsSnap.docs) {
    const data = d.data() || {}
    const entries = Object.values(normalizeSession(d.id, data)?.entries || {})
    const entryIds = entries
      .filter((e) => e.exerciseId === exerciseId || instanceIds.has(e.instanceId))
      .map((e) => e.instanceId)

    // Vieux documents : leur `programSnapshot` doit perdre les mêmes lignes,
    // sinon il continuerait de nommer un exercice qui n'existe plus.
    const legacy = Array.isArray(data.programSnapshot) ? data.programSnapshot : null
    const kept = legacy ? legacy.filter((l) => l?.exerciseId !== exerciseId) : null
    const snapshotChanged = legacy !== null && kept.length !== legacy.length

    if (entryIds.length === 0 && !snapshotChanged) continue
    for (const id of entryIds) instanceIds.add(id)
    sessions.push({ id: d.id, entryIds, programSnapshot: snapshotChanged ? kept : null })
  }

  return {
    exerciseId,
    programCount: programs.reduce((acc, p) => acc + p.removed, 0),
    sessionCount: sessions.length,
    hasNote: noteSnap.exists(),
    programs,
    sessions,
    instanceIds: [...instanceIds],
  }
}

// Firestore plafonne un lot à 500 opérations ; on garde de la marge.
const BATCH_LIMIT = 400

async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch)
    // eslint-disable-next-line no-await-in-loop
    await batch.commit()
  }
}

/**
 * Supprime un exercice ET tout ce qui n'a plus de sens sans lui.
 *
 * Laisser le catalogue seul se vider produisait des lignes de programme
 * fantômes affichées « Exercice supprimé », une séance du jour reliée à rien,
 * et un cache lastPerf qui pré-remplissait des champs orphelins. Une
 * suppression retire donc, d'un bloc : les lignes de programme (les deux
 * parités, les sept jours), les entrées correspondantes dans les séances, la
 * note de réglages et le cache de dernière perf.
 *
 * L'appelant confirme d'abord — cf. `collectExerciseImpact`.
 */
export async function deleteExerciseCascade(uid, exerciseId, impact, currentUid) {
  const data = impact || await collectExerciseImpact(uid, exerciseId)
  const now = new Date().toISOString()
  const ops = []

  for (const { parity, days } of data.programs) {
    ops.push((b) => b.set(programDoc(uid, parity), {
      days, updatedAt: now, updatedBy: currentUid,
    }, { merge: true }))
  }

  for (const session of data.sessions) {
    const entries = {}
    for (const id of session.entryIds) entries[id] = deleteField()
    const payload = { entries, updatedAt: now, updatedBy: currentUid }
    if (session.programSnapshot) payload.programSnapshot = session.programSnapshot
    ops.push((b) => b.set(sessionDoc(uid, session.id), payload, { merge: true }))
  }

  // Le cache de dernière perf est nettoyé sans condition : c'est lui qui
  // pré-remplirait sinon les champs d'une occurrence qui n'existe plus.
  const byInstance = {}
  for (const id of data.instanceIds) byInstance[id] = deleteField()
  ops.push((b) => b.set(lastPerfDoc(uid), {
    byInstance,
    byExercise: { [exerciseId]: deleteField() },
    updatedAt: now,
  }, { merge: true }))

  if (data.hasNote) ops.push((b) => b.delete(noteDoc(uid, exerciseId)))
  ops.push((b) => b.delete(exerciseDoc(uid, exerciseId)))

  await commitInChunks(ops)
}
