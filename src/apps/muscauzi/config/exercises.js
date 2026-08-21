import { Dumbbell, Cog, PersonStanding, Layers } from 'lucide-react'

// Types d'exercice — pilotent surtout le rappel de convention de saisie.
export const EXERCISE_TYPES = [
  { id: 'barbell',    label: 'Barre',        icon: Layers,          hint: 'charge totale, barre incluse' },
  { id: 'dumbbell',   label: 'Haltères',     icon: Dumbbell,        hint: 'poids d’UN seul haltère' },
  { id: 'machine',    label: 'Machine',      icon: Cog,             hint: 'charge affichée sur la machine' },
  { id: 'bodyweight', label: 'Poids du corps', icon: PersonStanding, hint: '0 si non lesté, sinon le lest ajouté' },
]

export const EXERCISE_TYPE_BY_ID = Object.fromEntries(EXERCISE_TYPES.map((t) => [t.id, t]))
export const DEFAULT_TYPE = 'barbell'

export function getExerciseType(id) {
  return EXERCISE_TYPE_BY_ID[id] || EXERCISE_TYPE_BY_ID[DEFAULT_TYPE]
}

// Rappel affiché en petit sous la saisie : dans six mois on ne doit pas avoir
// à se demander si « 60 » voulait dire 60 kg par haltère ou 60 en tout.
export function weightHint(exercise) {
  if (!exercise) return null
  if (exercise.bodyweight) return 'Poids du corps : 0 si non lesté, sinon le lest (10, 20…)'
  return `${getExerciseType(exercise.type).label} — ${getExerciseType(exercise.type).hint}`
}
