// Conversion d'un ingrédient (quantité + unité) en grammes, puis en calories/macros.
//
// Règle centrale de cette app : un ingrédient qu'on NE SAIT PAS convertir ne vaut
// jamais 0. Il est remonté dans `unresolved` avec sa raison, pour que l'écran
// affiche « 1 240 kcal · 3 ingrédients non estimés » au lieu d'un total faux.
// C'est précisément le défaut qui rend la plupart des apps de nutrition
// silencieusement inexactes.

import { getUnit } from './quantity.js'

// Volumes conventionnels des cuillères (famille `spoon`, sans facteur propre).
const SPOON_ML = { cas: 15, cac: 5 }

// Densité par défaut d'un liquide, à défaut de mieux : celle de l'eau.
const DEFAULT_DENSITY = 1

export const MACRO_KEYS = ['kcal', 'proteins', 'carbs', 'fat']

export const EMPTY_PER100 = {
  kcal: 0, proteins: 0, carbs: 0, fat: 0,
  sugars: null, satFat: null, fiber: null, salt: null,
}

// Pourquoi un ingrédient n'a pas pu être estimé — sert à proposer la bonne action.
export const UNRESOLVED = {
  NO_FOOD: 'no-food',            // pas encore lié à un aliment
  NO_QUANTITY: 'no-quantity',    // « un peu de persil »
  NEEDS_PIECE_WEIGHT: 'needs-piece-weight', // « 2 tranches » sans poids unitaire connu
}

export const UNRESOLVED_LABEL = {
  [UNRESOLVED.NO_FOOD]: 'à lier à un aliment',
  [UNRESOLVED.NO_QUANTITY]: 'quantité non précisée',
  [UNRESOLVED.NEEDS_PIECE_WEIGHT]: 'poids unitaire inconnu',
}

function round1(n) { return Math.round(n * 10) / 10 }

// { quantity, unit } + aliment → grammes, ou { grams: null, reason }.
export function toGrams(quantity, unit, food) {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
    return { grams: null, reason: UNRESOLVED.NO_QUANTITY }
  }

  // Sans unité, on interprète le nombre comme un nombre de pièces (« 2 œufs »).
  const family = unit ? getUnit(unit)?.family : 'count'
  const factor = unit ? (getUnit(unit)?.factor ?? 1) : 1

  if (family === 'mass') return { grams: quantity * factor, reason: null }

  if (family === 'volume' || family === 'spoon') {
    const ml = family === 'spoon' ? quantity * (SPOON_ML[unit] ?? 0) : quantity * factor
    const density = Number(food?.densityGPerMl) > 0 ? Number(food.densityGPerMl) : DEFAULT_DENSITY
    return { grams: ml * density, reason: null }
  }

  // count / pack : impossible sans le poids d'une unité, qu'on ne devine pas.
  const per = Number(food?.gramsPerPiece)
  if (per > 0) return { grams: quantity * per, reason: null }
  return { grams: null, reason: UNRESOLVED.NEEDS_PIECE_WEIGHT }
}

// Valeurs nutritionnelles d'une masse donnée d'un aliment (le per100 est /100 g).
export function nutrientsForGrams(food, grams) {
  const per100 = food?.per100 || {}
  const k = grams / 100
  const out = {}
  for (const key of Object.keys(EMPTY_PER100)) {
    const v = per100[key]
    out[key] = Number.isFinite(v) ? v * k : null
  }
  return out
}

function addInto(total, part) {
  for (const key of Object.keys(EMPTY_PER100)) {
    const v = part[key]
    if (!Number.isFinite(v)) continue
    total[key] = (Number.isFinite(total[key]) ? total[key] : 0) + v
  }
}

// Somme d'une liste d'ingrédients de recette.
//   ingredients : [{ name, quantity, unit, foodId, gramsOverride }]
//   foodById    : Map|objet id → aliment
//   factor      : mise à l'échelle des portions (RecipeDetail l'a déjà)
// → { totals, unresolved: [{ index, name, reason }], resolvedCount }
export function sumIngredients(ingredients, foodById, factor = 1) {
  const totals = { ...EMPTY_PER100, sugars: null, satFat: null, fiber: null, salt: null }
  const unresolved = []
  let resolvedCount = 0

  ;(ingredients || []).forEach((ing, index) => {
    const food = foodById?.get ? foodById.get(ing.foodId) : foodById?.[ing.foodId]
    if (!ing.foodId || !food) {
      unresolved.push({ index, name: ing.name, reason: UNRESOLVED.NO_FOOD })
      return
    }
    // Un poids saisi à la main sur l'ingrédient prime sur la conversion d'unité.
    const override = Number(ing.gramsOverride)
    const { grams, reason } = override > 0
      ? { grams: override, reason: null }
      : toGrams(ing.quantity, ing.unit, food)

    if (grams == null) {
      unresolved.push({ index, name: ing.name, reason })
      return
    }
    addInto(totals, nutrientsForGrams(food, grams * factor))
    resolvedCount += 1
  })

  return { totals, unresolved, resolvedCount }
}

// Totaux d'une recette ramenés à une portion (null si le nombre de portions est inconnu).
export function perServing(totals, servings) {
  if (!servings || servings <= 0) return null
  const out = {}
  for (const [key, v] of Object.entries(totals)) {
    out[key] = Number.isFinite(v) ? v / servings : null
  }
  return out
}

// « 1 240 kcal » — arrondi à l'entier, espace insécable fine pour les milliers.
export function formatKcal(v) {
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v).toLocaleString('fr-FR')} kcal`
}

// « 12,4 g » — une décimale, virgule française.
export function formatGrams(v) {
  if (!Number.isFinite(v)) return '—'
  return `${round1(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} g`
}
