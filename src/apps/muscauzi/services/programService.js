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

export function emptyProgram() {
  return normalizeDays(null, 'even')
}

export function subscribeToProgram(uid, parity, callback, onError) {
  return onSnapshot(programDoc(uid, parity), (snap) => {
    callback(normalizeDays(snap.exists() ? snap.data()?.days : null, parity))
  }, (err) => {
    console.error('[MuscAuzi] program error:', err)
    onError?.(err)
    callback(emptyProgram())
  })
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

export { PARITIES, DOWS }
