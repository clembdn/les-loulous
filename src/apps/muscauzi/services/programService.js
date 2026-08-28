import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'

// Programme d'un profil, une semaine paire et une semaine impaire.
//
// Un document par parité contenant les sept jours — et non un document par
// jour : ouvrir la séance du jour ne doit coûter qu'une lecture.
//   users/{uid}/program/{parity} → { days: { "1": [ligne], … "7": [] } }
//
// Chaque ligne porte un `instanceId` STABLE d'une semaine à l'autre, généré
// ici (dans l'écran Programme) et jamais au démarrage d'une séance.
const PARITIES = ['even', 'odd']
const DOWS = [1, 2, 3, 4, 5, 6, 7]

function programDoc(uid, parity) {
  return doc(db, 'users', uid, 'program', parity)
}

// Secours pour une ligne sans instanceId (données antérieures à son
// introduction). DÉTERMINISTE — un aléatoire tiré à chaque lecture changerait
// à chaque écho de Firestore et la séance perdrait ses saisies — mais
// NAMESPACÉ par parité ET jour : un index seul valait aussi bien pour le
// vendredi que pour le samedi, et une ligne de chaque jour finissait par
// partager le même `legacy-0`. Les deux exercices affichaient alors les
// MÊMES séries, et enregistrer l'un écrasait l'autre.
function fallbackInstanceId(parity, dayOfWeek, index) {
  return `legacy-${parity}-${dayOfWeek}-${index}`
}

function normalizeLine(raw, index, parity, dayOfWeek) {
  return {
    instanceId: raw?.instanceId || fallbackInstanceId(parity, dayOfWeek, index),
    exerciseId: raw?.exerciseId || '',
    // Nom recopié : supprimer l'exercice du catalogue ne doit pas rendre le
    // programme illisible. L'affichage préfère le nom vivant du catalogue et
    // ne retombe sur celui-ci que si le mouvement n'existe plus.
    name: raw?.name || '',
    order: Number.isFinite(raw?.order) ? raw.order : index,
    sets: Math.max(1, Number(raw?.sets) || 1),
    reps: Math.max(1, Number(raw?.reps) || 1),
  }
}

// Nom à afficher pour une ligne de programme ou de snapshot.
export function resolveLineName(line, exerciseById) {
  return exerciseById?.[line?.exerciseId]?.name || line?.name || 'Exercice supprimé'
}

/**
 * Écarte les lignes dont le mouvement n'existe plus au catalogue.
 *
 * Supprimer un exercice nettoie désormais le programme et les séances (cf.
 * `deleteExerciseCascade`) : plus rien ne devrait devenir orphelin. Ce filtre
 * couvre l'ancien monde — les lignes laissées derrière par les suppressions
 * d'avant, qui s'affichaient « Exercice supprimé » et pointaient dans le vide.
 * La première modification du jour concerné réécrit le document sans elles.
 *
 * `ready` évite de tout faire disparaître pendant le chargement du catalogue.
 */
export function withoutOrphans(lines, exerciseById, ready) {
  if (!ready) return lines
  return lines.filter((l) => exerciseById?.[l?.exerciseId])
}

function normalizeDays(raw, parity) {
  const days = {}
  for (const dow of DOWS) {
    const stored = raw?.[dow] ?? raw?.[String(dow)]
    const list = Array.isArray(stored) ? stored : []
    days[dow] = list
      .map((line, i) => normalizeLine(line, i, parity, dow))
      .filter((l) => l.exerciseId)
      .sort((a, b) => a.order - b.order)
      .map((l, i) => ({ ...l, order: i }))
  }
  return days
}

/**
 * Nom de la séance d'un jour — « Push », « Jambes », « Haut du corps ».
 *
 * Rangé À CÔTÉ des lignes (`dayNames`), pas dedans. Les jours sont stockés
 * comme des tableaux de lignes depuis le début ; les transformer en objets
 * pour y loger un titre aurait obligé à migrer tous les programmes existants,
 * pour une information qui ne concerne pas les lignes.
 *
 * C'est ce nom qui rend deux séances comparables : sans lui, on ne peut que
 * rapprocher une séance de la précédente, quelle qu'elle soit — et comparer un
 * jour de jambes à un jour de pectoraux ne dit rien de rien.
 */
export const MAX_DAY_NAME = 40

function normalizeNames(raw) {
  const names = {}
  for (const dow of DOWS) {
    const value = raw?.[dow] ?? raw?.[String(dow)]
    const text = typeof value === 'string' ? value.trim().slice(0, MAX_DAY_NAME) : ''
    if (text) names[dow] = text
  }
  return names
}

export function emptyProgram() {
  return { days: normalizeDays(null, 'even'), names: {} }
}

export function subscribeToProgram(uid, parity, callback, onError) {
  return onSnapshot(programDoc(uid, parity), (snap) => {
    const data = snap.exists() ? snap.data() : null
    callback({
      days: normalizeDays(data?.days, parity),
      names: normalizeNames(data?.dayNames),
    })
  }, (err) => {
    console.error('[MuscAuzi] program error:', err)
    onError?.(err)
    callback(emptyProgram())
  })
}

// Renommer un jour ne touche pas ses lignes, et inversement : deux écritures
// distinctes sur deux champs distincts, jamais un document réécrit en entier.
export function saveProgramDayName(uid, parity, dayOfWeek, name, currentUid) {
  const trimmed = String(name || '').trim().slice(0, MAX_DAY_NAME)
  return setDoc(programDoc(uid, parity), {
    dayNames: { [dayOfWeek]: trimmed },
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}

/**
 * Réécrit la prescription d'un jour.
 *
 * Les `instanceId` déjà présents dans `lines` sont conservés tels quels :
 * réordonner, changer les séries/reps ou déplacer une occurrence ne doit pas
 * en générer un nouveau. À l'inverse, l'appelant fabrique un nouvel
 * `instanceId` pour un ajout, une duplication ou un remplacement — y compris
 * quand on supprime puis rajoute le même mouvement, sinon la nouvelle
 * occurrence hériterait du pré-remplissage de l'ancienne.
 *
 * Les séances déjà enregistrées ne bougent pas : chaque entrée a figé le nom
 * de l'exercice et la prescription du jour où elle a été saisie.
 */
export function saveProgramDay(uid, parity, dayOfWeek, lines, currentUid) {
  const cleaned = lines
    .map((line, i) => normalizeLine(line, i, parity, dayOfWeek))
    .filter((l) => l.exerciseId)
    .map((l, i) => ({ ...l, order: i }))
  return setDoc(programDoc(uid, parity), {
    days: { [dayOfWeek]: cleaned },
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}

/**
 * Réécrit PLUSIEURS jours d'un coup — la copie d'une semaine entière.
 *
 * Sept appels à `saveProgramDay` auraient fait sept écritures sur le même
 * document, donc sept allers-retours et sept échos du cache : la liste aurait
 * clignoté jour après jour sous les yeux. Ici, un seul `setDoc`.
 *
 * `days` est une map partielle { dayOfWeek: [ligne] } : les jours absents ne
 * sont pas touchés. Un jour présent mais vide efface bien la prescription de ce
 * jour-là — c'est ce qu'on attend d'une copie depuis une semaine où il est au
 * repos.
 */
export function saveProgramWeek(uid, parity, days, currentUid) {
  const cleaned = {}
  for (const [dow, lines] of Object.entries(days || {})) {
    cleaned[dow] = (lines || [])
      .map((line, i) => normalizeLine(line, i, parity, Number(dow)))
      .filter((l) => l.exerciseId)
      .map((l, i) => ({ ...l, order: i }))
  }
  return setDoc(programDoc(uid, parity), {
    days: cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  }, { merge: true })
}

/**
 * Recopie des lignes vers un autre jour ou une autre parité.
 *
 * Chaque ligne reçoit un `instanceId` NEUF. C'est une occurrence distincte :
 * le lundi de la semaine paire et celui de la semaine impaire sont deux cases
 * différentes du programme, même quand elles contiennent la même chose.
 *
 * Sans conséquence sur l'historique : le rappel « la dernière fois » et les
 * courbes suivent l'`exerciseId`, c'est-à-dire le mouvement, pas l'occurrence.
 */
export function copyLines(lines, newInstanceId) {
  return (lines || []).map((line, i) => ({
    instanceId: newInstanceId(),
    exerciseId: line.exerciseId,
    name: line.name || '',
    order: i,
    sets: line.sets,
    reps: line.reps,
  }))
}

export { PARITIES, DOWS }
