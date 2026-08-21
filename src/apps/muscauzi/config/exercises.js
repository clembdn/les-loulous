import { Dumbbell, Cog, PersonStanding, Layers } from 'lucide-react'

// Types d'exercice. `hint` n'existe que là où la saisie est réellement
// ambiguë — dire « charge affichée sur la machine » n'apprend rien à personne
// et ne fait qu'ajouter du bruit sous les champs.
export const EXERCISE_TYPES = [
  { id: 'barbell',    label: 'Barre',          icon: Layers,         hint: 'Charge totale, barre incluse' },
  { id: 'dumbbell',   label: 'Haltères',       icon: Dumbbell,       hint: 'Poids d’un seul haltère' },
  { id: 'machine',    label: 'Machine',        icon: Cog,            hint: null },
  { id: 'bodyweight', label: 'Poids du corps', icon: PersonStanding, hint: '0 si non lesté, sinon le lest' },
]

export const EXERCISE_TYPE_BY_ID = Object.fromEntries(EXERCISE_TYPES.map((t) => [t.id, t]))
export const DEFAULT_TYPE = 'barbell'

export function getExerciseType(id) {
  return EXERCISE_TYPE_BY_ID[id] || EXERCISE_TYPE_BY_ID[DEFAULT_TYPE]
}

// Rappel de convention affiché sous la saisie. Rend `null` quand il n'y a rien
// d'utile à dire — l'accordéon n'affiche alors aucune ligne.
export function weightHint(exercise) {
  if (!exercise) return null
  if (exercise.bodyweight) return EXERCISE_TYPE_BY_ID.bodyweight.hint
  return getExerciseType(exercise.type).hint
}
