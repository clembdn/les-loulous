// Identifiant d'occurrence d'un exercice dans un programme.
//
// `exerciseId` porte l'identité du MOUVEMENT (catalogue commun aux deux
// profils) ; `instanceId` porte l'identité de l'OCCURRENCE dans le programme
// personnel. Sans lui, un exercice présent deux fois dans la même séance
// écrirait deux fois sur la même clé d'`entries`.
export function newInstanceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Contexte non sécurisé (rare) : suffisant pour distinguer des occurrences
  // créées à la main dans un programme personnel.
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
