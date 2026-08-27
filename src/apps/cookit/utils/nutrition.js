// Conversion d'un ingrédient (quantité + unité) en grammes, puis en calories/macros.
//
// Règle centrale de cette app : un ingrédient qu'on NE SAIT PAS convertir ne vaut
// jamais 0. Il est remonté dans `unresolved` avec sa raison, pour que l'écran
// affiche « 1 240 kcal · 3 ingrédients non estimés » au lieu d'un total faux.
// C'est précisément le défaut qui rend la plupart des apps de nutrition
// silencieusement inexactes.

import { getUnit } from './quantity.js'
import { AUTHORIZED_UIDS } from '../../../shared/config/people.js'

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

  // count / pack : il faut le poids d'une unité. À défaut, la portion indiquée
  // sur l'emballage fait un repère honnête — elle est déjà récupérée d'Open Food
  // Facts et stockée, elle n'était simplement jamais lue.
  const per = Number(food?.gramsPerPiece) > 0 ? Number(food.gramsPerPiece) : Number(food?.servingGrams)
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
// Part d'un ingrédient revenant à une personne, en fraction de la quantité
// totale. Absente ⇒ parts égales.
//
// On stocke des FRACTIONS et pas des grammes : une recette dont on change le
// nombre de portions garde ainsi son partage. Des grammes figés deviendraient
// faux en silence dès qu'on passe de 2 à 4.
export function shareFor(ingredient, uid) {
  const split = ingredient?.split
  if (!split || typeof split !== 'object') return 1 / AUTHORIZED_UIDS.length
  const total = AUTHORIZED_UIDS.reduce((sum, u) => sum + (Number(split[u]) || 0), 0)
  if (!(total > 0)) return 1 / AUTHORIZED_UIDS.length
  // Renormalisé : deux fractions saisies séparément peuvent ne pas tomber juste.
  return (Number(split[uid]) || 0) / total
}

// Fractions → grammes, pour l'affichage et la saisie (l'écran raisonne en
// grammes, le stockage en fractions).
export function gramsForShare(ingredient, uid) {
  const q = Number(ingredient?.quantity)
  if (!Number.isFinite(q)) return null
  return Math.round(q * shareFor(ingredient, uid) * 10) / 10
}

// Fabrique le `split` correspondant à « telle personne prend tant de grammes ».
// Rend null quand on retombe sur des parts égales, pour ne rien stocker d'inutile.
export function splitFromGrams(ingredient, uid, grams) {
  const total = Number(ingredient?.quantity)
  const g = Number(grams)
  if (!(total > 0) || !Number.isFinite(g) || g < 0) return null
  const mine = Math.min(g, total) / total
  const others = AUTHORIZED_UIDS.filter((u) => u !== uid)
  if (others.length === 0) return null
  const rest = (1 - mine) / others.length
  const equal = 1 / AUTHORIZED_UIDS.length
  if (Math.abs(mine - equal) < 0.001) return null
  const out = { [uid]: Math.round(mine * 1000) / 1000 }
  for (const u of others) out[u] = Math.round(rest * 1000) / 1000
  return out
}

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

// Mêmes totaux, mais pour une seule personne : chaque ingrédient est pondéré par
// sa part. La règle « un ingrédient non estimé ne vaut jamais zéro » vaut ici
// aussi — une part de rien reste rien, pas zéro.
export function sumIngredientsForPerson(ingredients, foodById, uid, factor = 1) {
  const weighted = (ingredients || []).map((ing) => {
    const share = shareFor(ing, uid)
    return {
      ...ing,
      quantity: ing.quantity == null ? ing.quantity : ing.quantity * share,
      gramsOverride: ing.gramsOverride == null ? null : ing.gramsOverride * share,
    }
  })
  return sumIngredients(weighted, foodById, factor)
}

// Facteur ramenant les totaux d'une recette à UNE PORTION POUR CHACUN.
//
// `shareFor` partage une TABLÉE entre les deux personnes (ses parts font 1) : il
// faut donc d'abord ramener la casserole à ce qu'on sert d'un coup. Une recette
// « pour 2 » se mange entièrement à deux — facteur 1. Une recette « pour 4 » en
// fait deux fois trop — facteur 0,5, et chacun retrouve sa portion.
//
// C'est ce facteur qui manquait : une crème chocolat « pour 4 » à 1 000 kcal
// comptait 500 kcal par personne au lieu de 250.
//
// Nombre de portions inconnu ⇒ 1 : on suppose que le plat est fait pour la
// tablée, plutôt que d'inventer une division.
export function personFactor(servings) {
  const s = Number(servings)
  if (!(s > 0)) return 1
  return AUTHORIZED_UIDS.length / s
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
