import { WHO_BOTH } from './who.js'
import { sumIngredients, sumIngredientsForPerson, perServing } from './nutrition.js'
import { AUTHORIZED_UIDS } from '../../../shared/config/people.js'

// Le pont entre le planning et le journal.
//
// Principe : on ne DUPLIQUE pas les repas planifiés dans les journaux, on les y
// DÉRIVE. Deux raisons décisives :
//
//   1. Les règles Firestore protègent chaque journal par `isOwner` : le téléphone
//      de l'un ne peut ni lire ni écrire le journal de l'autre. Un plat « nous
//      deux » ne pourrait donc pas être poussé dans les deux journaux depuis un
//      seul appareil — et relâcher la règle donnerait à chacun accès au journal
//      du conjoint.
//   2. Rien n'étant écrit, rien ne peut être écrit deux fois : le doublon, plaie
//      habituelle de ce genre de synchronisation, est impossible par construction.
//
// La nutrition est figée dans le repas au moment de la planification ; le journal
// se contente de lire la part de la personne connectée.

// Nutrition par personne d'une recette planifiée, à figer dans le repas.
// `who` désigne pour qui est le plat : une personne seule le mange en entier,
// « nous deux » se partage selon la répartition des ingrédients.
// `portions` est un MULTIPLICATEUR de la recette : 1 = le plat entier tel qu'il
// est enregistré, 0,5 = la moitié. Volontairement pas « nombre de parts
// mangées » : au planning on note « on mange une carbonara », pas « j'ai mangé
// 2 des 2 portions ». Diviser par recipe.servings comptait le plat de moitié.
export function buildMealNutrition(recipe, portions, who, foodById) {
  if (!recipe) return null
  const factor = portions > 0 ? portions : 1

  const pick = (uid) => {
    const r = who === WHO_BOTH
      ? sumIngredientsForPerson(recipe.ingredients, foodById, uid, factor)
      : sumIngredients(recipe.ingredients, foodById, factor)
    // Aucun ingrédient estimable : ne rien figer plutôt que de figer des zéros,
    // qui compteraient ensuite comme un repas à 0 kcal.
    if (r.resolvedCount === 0) return null
    return { kcal: r.totals.kcal, proteins: r.totals.proteins, carbs: r.totals.carbs, fat: r.totals.fat }
  }

  const out = {}
  for (const uid of AUTHORIZED_UIDS) {
    if (who !== WHO_BOTH && who !== uid) continue
    const v = pick(uid)
    if (v) out[uid] = v
  }
  return Object.keys(out).length ? out : null
}

// Repas planifiés d'une journée qui concernent `uid`, transformés en lignes de
// journal. `overrides` vient du journal de la personne : elle peut retirer un
// repas qu'elle n'a finalement pas mangé.
export function plannedEntriesFor(day, uid, overrides = {}) {
  if (!day) return []
  const out = []
  for (const slot of ['midi', 'soir']) {
    for (const meal of day[slot] || []) {
      if (meal.who !== WHO_BOTH && meal.who !== uid) continue
      if (overrides[meal.id]?.skipped) continue
      const n = overrides[meal.id]?.nutrition || meal.nutrition?.[uid] || null
      out.push({
        id: `planned:${meal.id}`,
        mealId: meal.id,
        planned: true,
        slot,
        kind: 'recipe',
        refId: meal.recipeId,
        label: meal.title,
        amount: meal.portions || 1,
        amountUnit: 'portion',
        // `null` et non 0 : un repas libre n'a pas de valeurs, il ne vaut pas zéro.
        kcal: n?.kcal ?? null,
        proteins: n?.proteins ?? null,
        carbs: n?.carbs ?? null,
        fat: n?.fat ?? null,
      })
    }
  }
  return out
}

// Recalcule la nutrition d'un repas déjà planifié (recette modifiée depuis, ou
// répartition ajustée) — utilisé quand on replanifie, jamais automatiquement.
export function recipePerServing(recipe, foodById) {
  const r = sumIngredients(recipe?.ingredients || [], foodById)
  return perServing(r.totals, recipe?.servings || 1)
}
