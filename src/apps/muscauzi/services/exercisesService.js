import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteField,
  getDoc, getDocs, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { DEFAULT_TYPE, EXERCISE_TYPE_BY_ID } from '../config/exercises.js'
import { OTHER_GROUP, groupForName, isMuscleGroup } from '../config/exerciseLibrary.js'
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


// Firestore plafonne un lot à 500 opérations ; on garde de la marge.
const BATCH_LIMIT = 400

function resolveType(raw) {
  return EXERCISE_TYPE_BY_ID[raw] ? raw : DEFAULT_TYPE
}

// Le TYPE porte tout : « compter en reps » découle de « poids du corps »
// (cf. `isBodyweight`). Aucun champ `bodyweight` n'est stocké ni dérivé ici —
// il dupliquait le type et pouvait le contredire. Les anciens documents en
// portent encore un : il est simplement ignoré.
/**
 * Le groupe musculaire, avec un repli sur la bibliothèque.
 *
 * Les exercices importés avant que ce champ n'existe n'en portent pas — mais
 * ils portent le nom exact de la bibliothèque, qui le connaît. On le retrouve à
 * la lecture plutôt que de réécrire tout le catalogue : aucune migration, et
 * l'axe « par groupe musculaire » fonctionne dès le premier chargement.
 */
function resolveGroup(raw) {
  if (isMuscleGroup(raw?.group)) return raw.group
  return groupForName(raw?.name) || OTHER_GROUP
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    type: resolveType(raw.type),
    group: resolveGroup(raw),
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
    group: isMuscleGroup(input.group) ? input.group : OTHER_GROUP,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

/**
 * Ajoute plusieurs exercices d'un coup — l'import depuis la bibliothèque.
 *
 * Un seul lot plutôt qu'une écriture par exercice : cocher quinze mouvements
 * ne doit pas produire quinze allers-retours, ni pouvoir s'arrêter à mi-chemin
 * en laissant un catalogue à moitié rempli.
 *
 * Les identifiants sont tirés côté client (`doc()` sans chemin), parce qu'un
 * lot ne peut pas utiliser `addDoc`.
 */
export function addExercises(uid, drafts, currentUid) {
  if (!drafts || drafts.length === 0) return Promise.resolve()
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  for (const draft of drafts.slice(0, BATCH_LIMIT)) {
    batch.set(doc(exercisesCol(uid)), {
      name: String(draft.name || '').trim(),
      type: resolveType(draft.type),
      // La bibliothèque connaît le groupe de chacun de ses mouvements : il est
      // enfin gardé au lieu d'être affiché puis jeté.
      group: isMuscleGroup(draft.group) ? draft.group : (groupForName(draft.name) || OTHER_GROUP),
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  }
  return batch.commit()
}

export function updateExercise(uid, id, updates, currentUid) {
  const payload = { updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.type != null) payload.type = resolveType(updates.type)
  if (updates.group != null) payload.group = isMuscleGroup(updates.group) ? updates.group : OTHER_GROUP
  return updateDoc(exerciseDoc(uid, id), payload)
}

/**
 * Ce qu'emporterait la suppression d'un exercice, sans rien écrire.
 *
 * Tout est lu ICI, une seule fois : le résultat sert d'abord à annoncer les
 * dégâts dans la confirmation, puis à les appliquer. Pas de seconde lecture
 * entre les deux.
 *
 * ── Pourquoi relire les séances que le contexte tient déjà ──────────────────
 *
 * `MuscDataContext` a l'historique complet en mémoire, et s'en servir ferait
 * l'économie d'une lecture de collection. Il ne le peut pas : le nettoyage des
 * vieux documents a besoin de `programSnapshot`, un champ BRUT que
 * `normalizeSession` ne recopie pas dans les séances du contexte. Passer par le
 * contexte laisserait ces lignes derrière, à nommer un exercice disparu.
 *
 * Le coût se paie une fois, sur un geste rare et délibéré — pas à l'ouverture
 * d'un écran.
 */
export async function collectExerciseImpact(uid, exerciseId) {
  const [noteSnap, sessionsSnap, ...programSnaps] = await Promise.all([
    getDoc(noteDoc(uid, exerciseId)),
    getDocs(sessionsCol(uid)),
    ...PARITIES.map((p) => getDoc(programDoc(uid, p))),
  ])

  // Les occurrences (`instanceId`) du mouvement, où qu'elles apparaissent :
  // ce sont elles qui rattachent une entrée de séance à une ligne de programme
  // retirée, quand l'entrée est trop vieille pour porter son `exerciseId`.
  // Interne à cette lecture — plus rien ne les consomme au-dehors.
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
  }
}

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
 * fantômes affichées « Exercice supprimé » et une séance du jour reliée à rien.
 * Une suppression retire donc, d'un bloc : les lignes de programme (les deux
 * parités, les sept jours), les entrées correspondantes dans les séances et la
 * note de réglages.
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

  // Le cache `meta/lastPerf` n'est plus nettoyé : il n'est plus ni écrit ni lu
  // depuis que « la dernière fois » se calcule dans `utils/previous.js` (cf.
  // l'en-tête de `sessionsService.js`). Cette écriture était la dernière du
  // dépôt à le viser, sans condition — donc une écriture facturée à chaque
  // suppression d'exercice, et la RECRÉATION du document chez qui n'en avait
  // jamais eu, `set` + `merge` créant ce qui n'existe pas.
  //
  // Les documents déjà là sont laissés en place : ils ne coûtent rien et rien
  // ne les relit.

  if (data.hasNote) ops.push((b) => b.delete(noteDoc(uid, exerciseId)))
  ops.push((b) => b.delete(exerciseDoc(uid, exerciseId)))

  await commitInChunks(ops)
}
