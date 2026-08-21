import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { normalizeSession } from './sessionsService.js'

// Transfert de données entre profils, par presse-papier.
//
// On passe par du texte plutôt que par une écriture directe d'un compte vers
// l'autre : les règles Firestore interdisent (à raison) d'écrire chez le
// voisin, et un export lisible sert aussi de sauvegarde. C'est donc :
// exporter depuis le mauvais compte, se connecter au bon, coller.
export const TRANSFER_FORMAT = 'muscauzi-transfer'
export const TRANSFER_VERSION = 1

const PARITIES = ['even', 'odd']

function exercisesCol(uid) { return collection(db, 'users', uid, 'exercises') }
function programDoc(uid, parity) { return doc(db, 'users', uid, 'program', parity) }
function notesCol(uid) { return collection(db, 'users', uid, 'exerciseNotes') }
function sessionsCol(uid) { return collection(db, 'users', uid, 'sessions') }
function weightsCol(uid) { return collection(db, 'users', uid, 'weights') }

/** Rassemble tout ce qu'un profil possède, en lectures ponctuelles. */
export async function buildExport(uid) {
  const [catalogSnap, notesSnap, sessionsSnap, weightsSnap, ...programSnaps] = await Promise.all([
    getDocs(exercisesCol(uid)),
    getDocs(notesCol(uid)),
    getDocs(sessionsCol(uid)),
    getDocs(weightsCol(uid)),
    ...PARITIES.map((p) => getDoc(programDoc(uid, p))),
  ])

  const program = {}
  PARITIES.forEach((parity, i) => {
    program[parity] = programSnaps[i].exists() ? (programSnaps[i].data()?.days || {}) : {}
  })

  const sessions = sessionsSnap.docs
    .map((d) => normalizeSession(d.id, d.data()))
    .filter(Boolean)

  // On n'embarque que les mouvements réellement référencés : le texte doit
  // rester assez court pour passer par le presse-papier.
  const referenced = new Set()
  for (const parity of PARITIES) {
    for (const lines of Object.values(program[parity])) {
      for (const l of lines || []) if (l?.exerciseId) referenced.add(l.exerciseId)
    }
  }
  for (const s of sessions) {
    for (const l of s.programSnapshot) if (l.exerciseId) referenced.add(l.exerciseId)
  }
  const notes = {}
  for (const d of notesSnap.docs) {
    const text = d.data()?.text
    if (typeof text === 'string' && text.trim()) { notes[d.id] = text; referenced.add(d.id) }
  }

  const exercises = catalogSnap.docs
    .filter((d) => referenced.has(d.id))
    .map((d) => ({
      id: d.id,
      name: d.data()?.name || '',
      type: d.data()?.type || 'barbell',
      bodyweight: d.data()?.bodyweight === true,
    }))

  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: uid,
    exercises,
    program,
    notes,
    sessions: sessions.map((s) => ({
      date: s.date, parity: s.parity, dayOfWeek: s.dayOfWeek,
      programSnapshot: s.programSnapshot, entries: s.entries,
    })),
    weights: weightsSnap.docs
      .map((d) => ({ date: d.id, value: Number(d.data()?.value) }))
      .filter((w) => Number.isFinite(w.value)),
  }
}

/** Valide un texte collé et en tire un résumé, sans rien écrire. */
export function parseTransfer(text) {
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    return { error: 'Ce texte n’est pas un export valide.' }
  }
  if (payload?.format !== TRANSFER_FORMAT) {
    return { error: 'Ce texte ne vient pas de MuscAuzi.' }
  }
  if (Number(payload.version) > TRANSFER_VERSION) {
    return { error: 'Export créé par une version plus récente de l’app.' }
  }
  const programDays = PARITIES.reduce((acc, p) => acc + Object.values(payload.program?.[p] || {})
    .filter((lines) => (lines || []).length > 0).length, 0)
  return {
    payload,
    summary: {
      exercises: (payload.exercises || []).length,
      programDays,
      notes: Object.keys(payload.notes || {}).length,
      sessions: (payload.sessions || []).length,
      weights: (payload.weights || []).length,
    },
  }
}

async function commit(ops) {
  // Firestore plafonne un lot à 500 écritures.
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    for (const apply of ops.slice(i, i + 450)) apply(batch)
    await batch.commit()
  }
}

/**
 * Écrit l'export dans le profil courant.
 *
 * Règle de sûreté : on n'écrase JAMAIS une séance ou une pesée déjà présente
 * sur le compte cible. Le programme, lui, est bien remplacé — c'est l'objet
 * même du transfert, et l'écran le dit avant de lancer.
 */
export async function applyImport(uid, payload, currentUid) {
  const [catalogSnap, sessionsSnap, weightsSnap, notesSnap] = await Promise.all([
    getDocs(exercisesCol(uid)),
    getDocs(sessionsCol(uid)),
    getDocs(weightsCol(uid)),
    getDocs(notesCol(uid)),
  ])
  const existingExercises = new Set(catalogSnap.docs.map((d) => d.id))
  const existingSessions = new Set(sessionsSnap.docs.map((d) => d.id))
  const existingWeights = new Set(weightsSnap.docs.map((d) => d.id))
  const existingNotes = new Set(notesSnap.docs.map((d) => d.id))

  const now = new Date().toISOString()
  const meta = { updatedAt: now, updatedBy: currentUid }
  const ops = []
  const applied = { exercises: 0, programDays: 0, notes: 0, sessions: 0, weights: 0 }
  const skipped = { sessions: 0, weights: 0, notes: 0 }

  for (const ex of payload.exercises || []) {
    // Un nom vide serait refusé par les règles et ferait échouer tout le lot.
    if (!ex?.id || !String(ex.name || '').trim() || existingExercises.has(ex.id)) continue
    applied.exercises++
    ops.push((b) => b.set(doc(db, 'users', uid, 'exercises', ex.id), {
      name: ex.name, type: ex.type, bodyweight: ex.bodyweight === true,
      createdAt: now, createdBy: currentUid, ...meta,
    }))
  }

  for (const parity of PARITIES) {
    const days = payload.program?.[parity]
    if (!days) continue
    applied.programDays += Object.values(days).filter((l) => (l || []).length > 0).length
    ops.push((b) => b.set(programDoc(uid, parity), { days, ...meta }, { merge: true }))
  }

  for (const [exerciseId, text] of Object.entries(payload.notes || {})) {
    if (existingNotes.has(exerciseId)) { skipped.notes++; continue }
    applied.notes++
    ops.push((b) => b.set(doc(db, 'users', uid, 'exerciseNotes', exerciseId), { text, ...meta }))
  }

  for (const s of payload.sessions || []) {
    if (!s?.date || existingSessions.has(s.date)) { skipped.sessions++; continue }
    // Les règles Firestore exigent une parité et un jour valides : une séance
    // incomplète serait rejetée et ferait échouer tout le lot.
    const validPlan = (s.parity === 'even' || s.parity === 'odd')
      && Number.isInteger(s.dayOfWeek) && s.dayOfWeek >= 1 && s.dayOfWeek <= 7
    if (!validPlan) { skipped.sessions++; continue }
    applied.sessions++
    ops.push((b) => b.set(doc(db, 'users', uid, 'sessions', s.date), {
      parity: s.parity, dayOfWeek: s.dayOfWeek,
      programSnapshot: s.programSnapshot || [], entries: s.entries || {},
      createdAt: now, createdBy: currentUid, ...meta,
    }))
  }

  for (const w of payload.weights || []) {
    if (!w?.date || existingWeights.has(w.date)) { skipped.weights++; continue }
    applied.weights++
    ops.push((b) => b.set(doc(db, 'users', uid, 'weights', w.date), { value: Number(w.value), ...meta }))
  }

  await commit(ops)
  return { applied, skipped }
}


/**
 * Reconstruit le catalogue personnel à partir de ce que le profil possède
 * encore : les noms recopiés dans le programme et dans les `programSnapshot`
 * des séances passées.
 *
 * Filet de sécurité pour les catalogues vidés à l'époque où ils étaient
 * communs aux deux comptes : le programme garde ses exerciceId, ses séries et
 * son ordre, seuls les mouvements ont disparu. Ceux dont aucun nom n'est
 * retrouvable sont recréés sous un libellé provisoire, à renommer.
 */
export async function rebuildCatalogue(uid, currentUid) {
  const [catalogSnap, sessionsSnap, ...programSnaps] = await Promise.all([
    getDocs(exercisesCol(uid)),
    getDocs(sessionsCol(uid)),
    ...PARITIES.map((p) => getDoc(programDoc(uid, p))),
  ])

  const existing = new Set(catalogSnap.docs.map((d) => d.id))
  const names = new Map()   // exerciseId → nom retrouvé
  const referenced = new Set()

  const note = (line) => {
    if (!line?.exerciseId) return
    referenced.add(line.exerciseId)
    if (line.name && !names.has(line.exerciseId)) names.set(line.exerciseId, line.name)
  }

  for (const snap of programSnaps) {
    if (!snap.exists()) continue
    for (const lines of Object.values(snap.data()?.days || {})) {
      for (const l of lines || []) note(l)
    }
  }
  // Les séances sont parcourues ensuite : leur snapshot porte toujours un nom.
  for (const d of sessionsSnap.docs) {
    for (const l of normalizeSession(d.id, d.data())?.programSnapshot || []) note(l)
  }

  const now = new Date().toISOString()
  const missing = [...referenced].filter((id) => !existing.has(id))
  const ops = missing.map((id) => (b) => b.set(doc(db, 'users', uid, 'exercises', id), {
    name: names.get(id) || `Exercice ${id.slice(0, 4)}`,
    type: 'barbell',
    bodyweight: false,
    createdAt: now, createdBy: currentUid, updatedAt: now, updatedBy: currentUid,
  }))
  await commit(ops)

  return {
    recreated: missing.length,
    named: missing.filter((id) => names.has(id)).length,
    unnamed: missing.filter((id) => !names.has(id)).length,
  }
}
