import { hasWork } from './sets.js'

/**
 * Rattacher les entrées d'une séance aux lignes du programme ACTUEL.
 *
 * ── Le problème ─────────────────────────────────────────────────────────────
 *
 * Une entrée de séance est rangée sous l'`instanceId` de sa ligne de
 * programme. Réécrire le programme (le programme v2, une copie de semaine, un
 * remplacement de ligne) fabrique des identifiants neufs : les séances déjà
 * faites pointent alors vers des lignes qui n'existent plus. Rouvertes, elles
 * affichaient tout en « hors programme » — et les lignes du jour, vides, comme
 * si rien n'avait été fait.
 *
 * ── La règle ────────────────────────────────────────────────────────────────
 *
 * Une ligne du programme qui n'a pas de travail sous son propre identifiant
 * ADOPTE la première entrée orpheline du même exercice : elle s'affiche avec
 * ses séries, et c'est sous l'identifiant de cette entrée que les corrections
 * s'écrivent — une seule entrée, jamais deux copies du même exercice.
 *
 * Seules les entrées issues d'une ANCIENNE ligne de programme sont adoptables.
 * Un exercice ajouté à la volée pendant la séance (rang ≥ 1000, cf.
 * `SessionView`) reste hors programme : l'adopter le ferait changer de place
 * dans la liste en pleine saisie, et l'écran sauterait à un autre exercice.
 *
 * Rien n'est réécrit dans Firestore : c'est une lecture. Pur, testé.
 */
export const ADDED_ORDER = 1000

/**
 * @param {Array} prescribed  lignes du programme du jour ({ instanceId, exerciseId, … })
 * @param {Array} entries     entrées normalisées de la séance
 * @returns {{ lines, orphans, savedIds }}
 *   `lines`    : les lignes, l'identifiant d'une entrée adoptée à la place du leur ;
 *   `orphans`  : les entrées restées hors programme, dans l'ordre de la séance ;
 *   `savedIds` : tous les identifiants d'entrées portant du travail hors du
 *                programme (adoptées comprises) — un ajout local déjà
 *                enregistré ne doit pas réapparaître vide.
 */
export function attachEntries(prescribed, entries) {
  const list = entries || []
  const byId = new Map(list.map((e) => [e.instanceId, e]))
  const known = new Set(prescribed.map((l) => l.instanceId))
  const orphans = list
    .filter((e) => !known.has(e.instanceId) && hasWork(e))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const adopted = new Set()
  const lines = prescribed.map((line) => {
    if (hasWork(byId.get(line.instanceId))) return line
    const match = orphans.find((e) => !adopted.has(e.instanceId)
      && e.exerciseId === line.exerciseId
      && (e.order ?? 0) < ADDED_ORDER)
    if (!match) return line
    adopted.add(match.instanceId)
    return { ...line, instanceId: match.instanceId }
  })

  return {
    lines,
    orphans: orphans.filter((e) => !adopted.has(e.instanceId)),
    savedIds: new Set(orphans.map((e) => e.instanceId)),
  }
}
