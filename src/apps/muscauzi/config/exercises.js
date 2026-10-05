import { Dumbbell, Cog, PersonStanding, Layers } from 'lucide-react'

// Types d'exercice. `hint` n'existe que là où la saisie est réellement
// ambiguë — dire « charge affichée sur la machine » n'apprend rien à personne
// et ne fait qu'ajouter du bruit sous les champs.
//
// `incrementKg` : le pas de charge par défaut — de combien on monte quand la
// barre d'XP est pleine. Les machines guidées montent par 7 kg (33, 40, 47…) ;
// une poulie classée « machine » qui monte par 1,25 se règle dans sa fiche.
export const EXERCISE_TYPES = [
  { id: 'barbell',    label: 'Barre',          icon: Layers,         hint: 'Charge totale, barre incluse', incrementKg: 2.5 },
  { id: 'dumbbell',   label: 'Haltères',       icon: Dumbbell,       hint: 'Poids d’un seul haltère',      incrementKg: 2 },
  { id: 'machine',    label: 'Machine',        icon: Cog,            hint: null,                           incrementKg: 7 },
  { id: 'bodyweight', label: 'Poids du corps', icon: PersonStanding, hint: '0 si non lesté, sinon le lest', incrementKg: 0 },
]

export const EXERCISE_TYPE_BY_ID = Object.fromEntries(EXERCISE_TYPES.map((t) => [t.id, t]))
export const DEFAULT_TYPE = 'barbell'

export function getExerciseType(id) {
  return EXERCISE_TYPE_BY_ID[id] || EXERCISE_TYPE_BY_ID[DEFAULT_TYPE]
}

// Pas proposés d'un appui dans la fiche ; tout autre se tape à la main.
export const INCREMENT_CHOICES = [1.25, 2, 2.5, 5, 7]
export const MAX_INCREMENT_KG = 50

export function defaultIncrement(type) {
  return getExerciseType(type).incrementKg
}

/**
 * Un pas personnalisé, ou `null` pour « le défaut du type ».
 *
 * Seul un pas qui DIFFÈRE du défaut est stocké : passer un exercice de
 * « machine » à « haltères » doit faire passer son pas de 7 à 2 kg, sauf si on
 * l'a réglé à la main.
 */
export function customIncrement(value, type) {
  const n = Number(value)
  if (value == null || value === '' || !Number.isFinite(n) || n < 0 || n > MAX_INCREMENT_KG) return null
  const rounded = Math.round(n * 100) / 100
  return rounded === defaultIncrement(type) ? null : rounded
}

/**
 * Se compte-t-il en répétitions plutôt qu'en charge ?
 *
 * C'est EXACTEMENT « son type est poids du corps » — d'où l'absence de champ
 * `bodyweight` stocké à côté du type. Il a existé, dupliquait l'information et
 * ne pouvait que diverger : deux sources pour un seul fait, dont l'une
 * silencieusement fausse le jour où elles ne s'accordent plus.
 */
export function isBodyweight(exercise) {
  return exercise?.type === 'bodyweight'
}

// Rappel de convention affiché sous la saisie. Rend `null` quand il n'y a rien
// d'utile à dire — l'accordéon n'affiche alors aucune ligne.
export function weightHint(exercise) {
  if (!exercise) return null
  return getExerciseType(exercise.type).hint
}
