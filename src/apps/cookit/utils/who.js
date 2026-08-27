import { CLEMENT_UID, LISE_UID, getPerson } from '@/shared/config/people.js'

export const WHO_BOTH = 'both'

// Options du picker : « Nous deux » + les deux personnes.
export const WHO_OPTIONS = [
  { value: WHO_BOTH, label: 'Nous deux' },
  { value: CLEMENT_UID, label: getPerson(CLEMENT_UID)?.label || 'Clément' },
  { value: LISE_UID, label: getPerson(LISE_UID)?.label || 'Lise' },
]

// Libellé + pastille de couleur pour l'étiquette « pour qui » d'un plat.
export function whoMeta(who) {
  if (who === WHO_BOTH || !who) return { label: 'Nous deux', dotClass: null, both: true }
  const p = getPerson(who)
  return { label: p?.label || '?', dotClass: p?.dotClass || 'bg-slate-400', both: false }
}
