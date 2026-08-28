/**
 * Ce qu'une série veut dire — la règle, sans Firestore autour.
 *
 * Elle vivait dans `services/sessionsService.js`, qui importe Firebase : aucun
 * test ne pouvait l'atteindre sans monter une application Firebase entière. La
 * règle est pourtant purement arithmétique, et c'est celle dont dépend TOUT le
 * reste — le compte de séries faites, les courbes, l'export, le rappel « la
 * dernière fois ». Elle mérite d'être vérifiable seule.
 *
 * Le service la ré-exporte : aucun appelant n'a changé d'import.
 */

/**
 * Les séries qui comptent : celles où des répétitions ont été faites.
 *
 * Il n'y a pas de drapeau « validée » à maintenir. Un `0` stocké veut dire
 * « rien saisi », jamais « zéro répétition validée » — c'est ce qui permet à un
 * champ vide de rester vide après un aller-retour par Firestore.
 */
export function doneSets(entry) {
  if (!entry || entry.skipped) return []
  return (entry.sets || []).filter((s) => Number(s?.reps) > 0)
}
