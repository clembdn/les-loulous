import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'
import { guessAisle } from './aisleGuess.js'

// Rayon d'un aliment. Deux sources, dans cet ordre :
//
//   1. le groupe CIQUAL, quand il existe — « Poulet, blanc, cuit » appartient au
//      groupe « viandes, œufs, poissons », information autrement plus fiable que
//      de chercher des mots-clés dans un nom écrit à l'envers ;
//   2. sinon le devinage par mots-clés, comme pour la liste de courses.
//
// La table couvre les 11 groupes de la table CIQUAL 2020 (cf. data/ciqual.json).

const AISLE_BY_CIQUAL_GROUP = {
  'viandes, œufs, poissons et assimilés': 'boucherie',
  'produits laitiers et assimilés': 'cremerie',
  'fruits, légumes, légumineuses et oléagineux': 'fruits-legumes',
  'eaux et autres boissons': 'boissons',
  'produits sucrés': 'epicerie-sucree',
  'glaces et sorbets': 'surgeles',
  'produits céréaliers': 'epicerie-salee',
  'entrées et plats composés': 'epicerie-salee',
  'aides culinaires et ingrédients divers': 'epicerie-salee',
  'matières grasses': 'epicerie-salee',
  'aliments infantiles': 'autres',
}

export function resolveAisle(id) {
  return AISLE_BY_ID[id] ? id : DEFAULT_AISLE
}

// Rayon à poser sur un aliment qu'on enregistre. Un rayon déjà choisi à la main
// n'est jamais écrasé.
export function resolveFoodAisle(food) {
  if (food?.aisle && AISLE_BY_ID[food.aisle]) return food.aisle
  const fromGroup = food?.group ? AISLE_BY_CIQUAL_GROUP[food.group] : null
  if (fromGroup) return fromGroup
  return guessAisle(food?.name || '')
}
