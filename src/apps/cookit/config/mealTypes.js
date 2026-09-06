import { Croissant, Sun, Moon, IceCreamCone } from 'lucide-react'

// Types de repas d'une recette.
//
// Une recette en porte PLUSIEURS : des pâtes carbonara se mangent aussi bien le
// midi que le soir. Forcer un choix unique obligerait à dupliquer la recette,
// et le filtre « Dîner » passerait à côté de la moitié du répertoire.
//
// L'ordre est chronologique — c'est celui des pastilles de filtre et des
// étiquettes sur une fiche, pour qu'une recette s'affiche pareil partout quel
// que soit l'ordre de saisie.
//
// Classes de couleur écrites en toutes lettres : Tailwind ne scanne que les
// littéraux, une classe construite à l'exécution ne serait jamais générée.
export const MEAL_TYPES = [
  {
    id: 'petit-dejeuner',
    label: 'Petit-déj',
    icon: Croissant,
    colorClass: 'text-amber-500',
    pillClass: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
    chipClass: 'bg-amber-500 text-white border-amber-500',
  },
  {
    id: 'dejeuner',
    label: 'Déjeuner',
    icon: Sun,
    colorClass: 'text-orange-500',
    pillClass: 'bg-orange-500/10 text-orange-700 border-orange-500/25',
    chipClass: 'bg-orange-500 text-white border-orange-500',
  },
  {
    id: 'diner',
    label: 'Dîner',
    icon: Moon,
    colorClass: 'text-indigo-500',
    pillClass: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25',
    chipClass: 'bg-indigo-500 text-white border-indigo-500',
  },
  {
    id: 'dessert',
    label: 'Dessert',
    icon: IceCreamCone,
    colorClass: 'text-pink-500',
    pillClass: 'bg-pink-500/10 text-pink-700 border-pink-500/25',
    chipClass: 'bg-pink-500 text-white border-pink-500',
  },
]

export const MEAL_TYPE_IDS = MEAL_TYPES.map((m) => m.id)
const MEAL_TYPE_BY_ID = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, m]))

export function getMealType(id) {
  return MEAL_TYPE_BY_ID[id] || null
}

// Ids valides, dédoublonnés, remis dans l'ordre du catalogue. On filtre le
// catalogue plutôt que l'entrée : un id inconnu (typo, ancienne version) est
// écarté au passage, sans avoir à le tester.
export function normalizeMeals(raw) {
  if (!Array.isArray(raw)) return []
  return MEAL_TYPE_IDS.filter((id) => raw.includes(id))
}
