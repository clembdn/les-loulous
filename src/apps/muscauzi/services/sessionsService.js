import {
  collection, doc, onSnapshot, setDoc, deleteField,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { normalizeRange } from '../utils/repRange.js'

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
 *     prescribedSets,                 ← ce qui était prescrit ce jour-là…
 *     prescribedRepsMin, prescribedRepsMax, prescribedReps (= max),
 *     sets: [{ rank, weightKg, reps, warmup? }],
 *     skipped,
 *   }
 *
 * La fourchette de reps est arrivée après coup : une entrée qui ne la porte
 * pas garde des bornes nulles à la lecture, et `entryRange` (utils/repRange.js)
 * se rabat sur le programme actuel, puis sur `prescribedReps`.
 * `prescribedReps` reste écrit pour les versions de l'appli pas encore à jour.
 *
 * `warmup` n'est écrit que s'il est vrai. Une série sans drapeau est une série
 * de travail — ce qu'étaient toutes celles d'avant.
 *
 * ── Plus de cache « dernière performance » ──────────────────────────────────
 *
 * Un document `meta/lastPerf` dénormalisait la dernière série de chaque
 * occurrence, pour n'avoir qu'une lecture à faire en ouvrant la séance. Il
 * était réécrit à CHAQUE série enregistrée, y compris celles du jour : le
 * rappel « dernière fois : 60 kg × 8 » se changeait en la série qu'on venait
 * de taper, dès qu'on la validait. Le repère disparaissait exactement au
 * moment où l'on s'en servait.
 *
 * Il n'est plus ni écrit ni lu. « La dernière fois » se calcule dans
 * `utils/previous.js`, sur la fenêtre de séances récentes déjà ouverte par le
 * contexte, et strictement AVANT la date affichée. Le document existant est
 * laissé en place : il ne coûte rien et ne sert plus à rien.
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

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function toCount(value) {
  return Math.max(0, Math.round(toNumber(value)))
}

function normalizeSet(raw, fallbackRank) {
  const set = {
    rank: Number.isFinite(Number(raw?.rank)) ? Math.max(0, Math.round(Number(raw.rank))) : fallbackRank,
    weightKg: toNumber(raw?.weightKg),
    reps: toCount(raw?.reps),
  }
  if (raw?.warmup === true) set.warmup = true
  return set
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
  // Une entrée d'avant les fourchettes n'en reçoit PAS ici : ses bornes restent
  // nulles, et c'est `entryRange` (utils/repRange.js) qui décide du repli — la
  // ligne de programme actuelle du même exercice, à défaut l'ancien nombre fixe.
  // Les remplir d'office avec ce nombre fixe effacerait la différence entre
  // « prescrit 10 » et « prescrit 6–10, avant que l'appli ne sache le dire ».
  const ownRange = raw?.prescribedRepsMin != null || raw?.prescribedRepsMax != null
  const range = normalizeRange(
    raw?.prescribedRepsMin,
    raw?.prescribedRepsMax,
    toCount(raw?.prescribedReps) || toCount(fallback?.reps),
  )
  return {
    instanceId,
    exerciseId: raw?.exerciseId || fallback?.exerciseId || '',
    name: raw?.name || fallback?.name || '',
    order: Number.isFinite(Number(raw?.order)) ? Number(raw.order) : (fallback?.order ?? 0),
    prescribedSets: Math.max(1, toCount(raw?.prescribedSets) || toCount(fallback?.sets) || 1),
    prescribedReps: range.max,
    prescribedRepsMin: ownRange ? range.min : null,
    prescribedRepsMax: ownRange ? range.max : null,
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
    // Nom RECOPIÉ le jour même, comme le sont déjà le libellé et la
    // prescription de chaque entrée. Renommer « Push » en « Haut du corps »
    // dans le programme ne doit pas réécrire six mois d'historique, ni faire
    // basculer d'anciennes séances dans une autre famille de comparaison.
    name: typeof raw.name === 'string' ? raw.name : '',
    // Séance faite pendant une semaine allégée : la barre d'XP l'ignore
    // (cf. utils/lightWeek.js). Absent des séances d'avant : elles comptent.
    lightWeek: raw.lightWeek === true,
    entries,
  }
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

// Il a existé ici deux autres écoutes : une sur le document du jour, une sur
// une fenêtre bornée par id de document. Toutes deux sont parties avec le
// passage à l'historique complet tenu par `context/MuscDataContext.jsx` : la
// séance du jour s'y trouve déjà, et le calendrier de régularité découpe sa
// fenêtre dans le même tableau. Rouvrir un `onSnapshot` pour des données déjà
// en mémoire, c'est un canal de plus et une occasion de plus de voir deux
// écrans afficher deux versions de la même journée.

/**
 * Écrit une entrée dans la séance d'une date.
 *
 * `plan` ({ parity, dayOfWeek, name, lightWeek }) décrit la séance affichée au
 * moment de la saisie. Il est réécrit à chaque fois — c'est une métadonnée,
 * plus une copie dont dépend l'affichage. `lightWeek` n'est écrit que vrai ;
 * faux, il est effacé : arrêter la semaine allégée en cours de séance rend la
 * séance à la barre d'XP.
 *
 * Aucun `await` côté UI : le cache Firestore encaisse l'écriture et la
 * synchronise au retour du réseau — la salle capte mal.
 */
export function saveEntry(uid, dateKey, entry, plan, currentUid) {
  const now = new Date().toISOString()
  const range = normalizeRange(entry.prescribedRepsMin, entry.prescribedRepsMax, entry.prescribedReps)
  const clean = {
    exerciseId: entry.exerciseId || '',
    name: entry.name || '',
    order: Number(entry.order) || 0,
    prescribedSets: Math.max(1, toCount(entry.prescribedSets) || 1),
    prescribedReps: range.max,
    prescribedRepsMin: range.min,
    prescribedRepsMax: range.max,
    sets: normalizeSets(entry.sets),
    skipped: entry.skipped === true,
  }

  setDoc(sessionDoc(uid, dateKey), {
    parity: plan.parity,
    dayOfWeek: plan.dayOfWeek,
    name: plan.name || '',
    lightWeek: plan.lightWeek === true ? true : deleteField(),
    entries: { [entry.instanceId]: clean },
    updatedAt: now,
    updatedBy: currentUid,
  }, { merge: true }).catch((err) => {
    console.error('[MuscAuzi] saveEntry failed:', err)
  })

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
