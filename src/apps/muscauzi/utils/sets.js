/**
 * Ce qu'une série et une séance veulent dire — les règles, sans Firestore.
 *
 * Elles vivaient dans `services/sessionsService.js`, qui importe Firebase :
 * aucun test ne pouvait les atteindre sans monter une application Firebase
 * entière. Elles sont pourtant purement arithmétiques, et ce sont elles dont
 * dépend TOUT le reste — le compte de séries faites, les courbes, l'export, le
 * rappel « la dernière fois », les pastilles d'avancement.
 *
 * `doneSets` était déjà passée ici, mais le service la ré-exportait « pour ne
 * rien changer aux appelants » : la moitié du code l'importait d'un côté,
 * l'autre moitié de l'autre, et `utils/metrics.js` tirait Firebase dans un
 * module de calcul pur — le seul `utils/` de MuscAuzi sans test, faute de
 * pouvoir en écrire un. Il n'y a plus qu'un chemin d'import.
 */

/** Une série d'échauffement — marquée à la main, jamais devinée. */
export function isWarmup(set) {
  return set?.warmup === true
}

/**
 * Toutes les séries faites, échauffements COMPRIS.
 *
 * Il n'y a pas de drapeau « validée » à maintenir. Un `0` stocké veut dire
 * « rien saisi », jamais « zéro répétition validée » — c'est ce qui permet à un
 * champ vide de rester vide après un aller-retour par Firestore.
 *
 * Ne sert qu'à ce qui doit tout montrer : l'export, l'affichage d'une séance.
 * Tout calcul passe par `doneSets`.
 */
export function loggedSets(entry) {
  if (!entry || entry.skipped) return []
  return (entry.sets || []).filter((s) => Number(s?.reps) > 0)
}

/**
 * Les séries qui COMPTENT : faites, et pas d'échauffement.
 *
 * C'est le filtre que tout le reste traverse — séries faites, volumes, records,
 * « dernière fois », barre d'XP, bilan. Écarter les échauffements ici les sort
 * de tous ces calculs d'un coup, au lieu de devoir y penser dans chacun.
 *
 * Les séries enregistrées avant que le drapeau n'existe n'en portent pas : ce
 * sont des séries de travail, ce qu'elles étaient.
 */
export function doneSets(entry) {
  return loggedSets(entry).filter((s) => !isWarmup(s))
}

/** L'entrée porte-t-elle quelque chose qu'on ne doit pas perdre de vue ? */
export function hasWork(entry) {
  if (!entry) return false
  return entry.skipped || (entry.sets || []).length > 0
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
 *
 * Cette fonction existait déjà, documentée, et n'était appelée par personne :
 * les cinq écrans qui en avaient besoin recopiaient chacun
 * `skipped || doneSets(entry).length >= line.prescribedSets`. Ils s'accordaient
 * par chance ; c'est la règle, pas la coïncidence, qui doit être partagée.
 */
export function isEntryComplete(entry, prescribedSets) {
  if (!entry) return false
  if (entry.skipped) return true
  const required = Math.max(1, Number(prescribedSets) || entry.prescribedSets || 1)
  return doneSets(entry).length >= required
}

/** Une séance a-t-elle reçu au moins une série qui compte ? */
export function hasCompletedWork(session) {
  if (!session) return false
  return Object.values(session.entries || {}).some((e) => doneSets(e).length > 0)
}

/** Les entrées d'une séance, dans l'ordre où elles ont été faites. */
export function sessionLineup(session) {
  return Object.values(session?.entries || {}).sort((a, b) => a.order - b.order)
}
