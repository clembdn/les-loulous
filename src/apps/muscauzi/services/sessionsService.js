import {
  collection, doc, onSnapshot, setDoc, deleteField, query, where, documentId,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

/**
 * Séances : un document par jour et par profil, `users/{uid}/sessions/{date}`.
 * La clé est une date LOCALE (cf. @/shared/lib/dates.js).
 *
 * ── Le document ne contient QUE ce qui a été fait. ───────────────────────────
 *
 * Il portait aussi une copie figée du programme du jour (`programSnapshot`),
 * re-fusionnée à chaque changement de jour ou de parité. Cette copie ne faisait
 * que grossir : changer de jour y ajoutait la prescription du nouveau jour sans
 * jamais retirer l'ancienne, si bien qu'un même exercice finissait affiché deux
 * fois — et pour tous les jours, puisque la copie figée l'emportait ensuite sur
 * le programme réel. Elle est supprimée.
 *
 * La prescription se lit désormais EN DIRECT dans le programme. Chaque entrée
 * emporte en revanche son propre libellé et sa propre prescription : renommer
 * un exercice ou passer de 4×8 à 5×5 ne réécrit pas ce qui est déjà enregistré.
 *
 *   entries[instanceId] = {
 *     exerciseId, name, order,        ← identité figée au moment de la saisie
 *     prescribedSets, prescribedReps, ← ce qui était prescrit ce jour-là
 *     sets: [{ rank, weightKg, reps }],
 *     skipped,
 *   }
 *
 * `sets` est un TABLEAU, jamais une map. Firestore fusionne les maps clé par
 * clé : effacer une série d'une map laissait son ancienne clé dans le document,
 * qui revenait à l'affichage. Un tableau est remplacé en bloc.
 *
 * Les valeurs stockées sont des nombres ; un 0 vaut « rien saisi » et se
 * réaffiche comme un champ vide. Une série ne compte que si `reps > 0` — il n'y
 * a pas de drapeau « validée » à maintenir en plus.
 */
function sessionsCol(uid) { return collection(db, 'users', uid, 'sessions') }
function sessionDoc(uid, dateKey) { return doc(db, 'users', uid, 'sessions', dateKey) }

// Cache de la DERNIÈRE performance, dénormalisé dans UN document : ouvrir la
// séance du jour coûte une seule lecture pour tous les rappels. Ce n'est jamais
// la source des courbes — elles se calculent sur l'historique.
function lastPerfDoc(uid) { return doc(db, 'users', uid, 'meta', 'lastPerf') }

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function toCount(value) {
  return Math.max(0, Math.round(toNumber(value)))
}

function normalizeSet(raw, fallbackRank) {
  return {
    rank: Number.isFinite(Number(raw?.rank)) ? Math.max(0, Math.round(Number(raw.rank))) : fallbackRank,
    weightKg: toNumber(raw?.weightKg),
    reps: toCount(raw?.reps),
  }
}

// Accepte le tableau actuel comme l'ancienne map indexée par rang : les
// documents écrits avant ce nettoyage restent lisibles.
function normalizeSets(raw) {
  const list = Array.isArray(raw)
    ? raw.map((s, i) => normalizeSet(s, i))
    : Object.entries(raw || {})
      .filter(([key]) => /^\d+$/.test(key))
      .map(([key, s]) => normalizeSet({ ...s, rank: Number(key) }, Number(key)))

  // Un rang par série : en cas de doublon, la dernière écriture gagne.
  const byRank = new Map()
  for (const s of list) {
    if (s.weightKg === 0 && s.reps === 0) continue
    byRank.set(s.rank, s)
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank)
}

function normalizeEntry(instanceId, raw, fallback) {
  return {
    instanceId,
    exerciseId: raw?.exerciseId || fallback?.exerciseId || '',
    name: raw?.name || fallback?.name || '',
    order: Number.isFinite(Number(raw?.order)) ? Number(raw.order) : (fallback?.order ?? 0),
    prescribedSets: Math.max(1, toCount(raw?.prescribedSets) || toCount(fallback?.sets) || 1),
    prescribedReps: Math.max(1, toCount(raw?.prescribedReps) || toCount(fallback?.reps) || 1),
    sets: normalizeSets(raw?.sets),
    skipped: raw?.skipped === true,
  }
}

export function normalizeSession(id, raw) {
  if (!raw) return null

  // Les séances écrites avant ce nettoyage n'ont pas d'identité dans leurs
  // entrées : elle se retrouve dans l'ancien `programSnapshot`, qui n'est plus
  // écrit mais reste lu ici pour ne pas perdre l'historique.
  const legacy = {}
  if (Array.isArray(raw.programSnapshot)) {
    raw.programSnapshot.forEach((line, i) => {
      if (line?.instanceId) legacy[line.instanceId] = { ...line, order: line.order ?? i }
    })
  }

  const entries = {}
  for (const [instanceId, value] of Object.entries(raw.entries || {})) {
    entries[instanceId] = normalizeEntry(instanceId, value, legacy[instanceId])
  }

  return {
    id,
    date: id,
    parity: raw.parity === 'even' || raw.parity === 'odd' ? raw.parity : null,
    dayOfWeek: Number(raw.dayOfWeek) || null,
    entries,
  }
}

/** Les séries qui comptent : celles où des répétitions ont été faites. */
export function doneSets(entry) {
  if (!entry || entry.skipped) return []
  return entry.sets.filter((s) => s.reps > 0)
}

/** L'entrée porte-t-elle quelque chose qu'on ne doit pas perdre de vue ? */
export function hasWork(entry) {
  if (!entry) return false
  return entry.skipped || entry.sets.length > 0
}

/**
 * L'occurrence est-elle bouclée ?
 *
 * `prescribedSets` est la prescription VIVANTE, celle du programme d'aujourd'hui
 * — pas celle figée dans l'entrée. Les deux divergent dès qu'on passe un
 * exercice de 4×8 à 5×8 : l'entrée enregistrée dit toujours 4, et sans ce
 * paramètre la pastille affichait « terminé » pendant que le libellé juste à
 * côté annonçait « 4/5 ». La prescription figée ne sert qu'à relire
 * l'historique, jamais à juger la séance du jour.
 */
export function isEntryComplete(entry, prescribedSets) {
  if (!entry) return false
  if (entry.skipped) return true
  const required = Math.max(1, Number(prescribedSets) || entry.prescribedSets || 1)
  return doneSets(entry).length >= required
}

export function hasCompletedWork(session) {
  if (!session) return false
  return Object.values(session.entries || {}).some((e) => doneSets(e).length > 0)
}

/** Les entrées d'une séance, dans l'ordre où elles ont été faites. */
export function sessionLineup(session) {
  return Object.values(session?.entries || {}).sort((a, b) => a.order - b.order)
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

function isAtLeastAsRecent(dateKey, previous) {
  return !previous?.date || dateKey >= previous.date
}

/**
 * Rafraîchit le cache de dernière perf — jamais avec une séance plus ancienne
 * que ce qu'il contient déjà, sinon rattraper la séance d'hier ferait reculer
 * les rappels de toute l'appli.
 */
function refreshLastPerf(uid, dateKey, entry, done, lastPerf) {
  const perf = { date: dateKey, sets: done.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) }
  const payload = {}
  if (isAtLeastAsRecent(dateKey, lastPerf?.byInstance?.[entry.instanceId])) {
    payload.byInstance = { [entry.instanceId]: perf }
  }
  if (entry.exerciseId && isAtLeastAsRecent(dateKey, lastPerf?.byExercise?.[entry.exerciseId])) {
    payload.byExercise = { [entry.exerciseId]: perf }
  }
  if (Object.keys(payload).length === 0) return
  setDoc(lastPerfDoc(uid), { ...payload, updatedAt: new Date().toISOString() }, { merge: true })
    .catch((err) => console.error('[MuscAuzi] lastPerf write failed:', err))
}

/**
 * Écrit une entrée dans la séance d'une date.
 *
 * `plan` ({ parity, dayOfWeek }) décrit la séance affichée au moment de la
 * saisie. Il est réécrit à chaque fois — c'est une métadonnée, plus une copie
 * dont dépend l'affichage.
 *
 * Aucun `await` côté UI : le cache Firestore encaisse l'écriture et la
 * synchronise au retour du réseau — la salle capte mal.
 */
export function saveEntry(uid, dateKey, entry, plan, currentUid, lastPerf) {
  const now = new Date().toISOString()
  const clean = {
    exerciseId: entry.exerciseId || '',
    name: entry.name || '',
    order: Number(entry.order) || 0,
    prescribedSets: Math.max(1, toCount(entry.prescribedSets) || 1),
    prescribedReps: Math.max(1, toCount(entry.prescribedReps) || 1),
    sets: normalizeSets(entry.sets),
    skipped: entry.skipped === true,
  }

  setDoc(sessionDoc(uid, dateKey), {
    parity: plan.parity,
    dayOfWeek: plan.dayOfWeek,
    entries: { [entry.instanceId]: clean },
    updatedAt: now,
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] saveEntry failed:', err)
  })

  // Le cache ne retient que du travail réel. S'il n'y en a plus, on le laisse
  // tel quel : rendre le rappel précédent demanderait de relire l'historique.
  const done = clean.sets.filter((s) => s.reps > 0)
  if (done.length > 0) refreshLastPerf(uid, dateKey, { ...clean, instanceId: entry.instanceId }, done, lastPerf)
}

/** Retire une occurrence de la séance (annule un « non fait » ou une saisie). */
export function clearEntry(uid, dateKey, instanceId, currentUid) {
  setDoc(sessionDoc(uid, dateKey), {
    entries: { [instanceId]: deleteField() },
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] clearEntry failed:', err)
  })
}
