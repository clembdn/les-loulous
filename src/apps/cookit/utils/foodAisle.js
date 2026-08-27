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

// Groupes PNNS d'Open Food Facts (taxonomie fermée, neuf valeurs). Clés en
// minuscules : `pnns_groups_1` et `food_groups_tags` ne s'accordent pas sur la
// casse (« Milk and dairy products » vs « milk and dairy products »).
const AISLE_BY_OFF_GROUP = {
  'fruits and vegetables': 'fruits-legumes',
  'milk and dairy products': 'cremerie',
  'fish meat eggs': 'boucherie',
  'beverages': 'boissons',
  'sugary snacks': 'epicerie-sucree',
  'cereals and potatoes': 'epicerie-salee',
  'salty snacks': 'epicerie-salee',
  'fat and sauces': 'epicerie-salee',
  'composite foods': 'epicerie-salee',
}

export function resolveAisle(id) {
  return AISLE_BY_ID[id] ? id : DEFAULT_AISLE
}

// Rayon d'un aliment.
//
// Seul un rayon EXPLICITEMENT choisi par l'utilisateur (`aisleManual`) est
// respecté. Se fier à la simple présence de `food.aisle` ne marchait pas :
// « autres » est un id valide, donc le rayon par défaut fabriqué à la lecture
// passait pour un choix délibéré et se figeait à vie — c'est ce qui bloquait
// tous les produits scannés dans « Autres ».
export function resolveFoodAisle(food) {
  if (food?.aisleManual && AISLE_BY_ID[food.aisle]) return food.aisle
  const g = String(food?.group || '').toLowerCase()
  const fromGroup = g ? (AISLE_BY_CIQUAL_GROUP[g] || AISLE_BY_OFF_GROUP[g]) : null
  if (fromGroup) return fromGroup
  return guessAisle(food?.name || '')
}
