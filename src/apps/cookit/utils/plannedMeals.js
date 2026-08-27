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
//
// `portions` est le NOMBRE DE PARTS SERVIES à ce repas, au sens où la recette
// l'entend : une recette « pour 4 » dont on sert 2 parts compte la moitié.
// C'est aussi ce qui permet à « nous deux » de valoir 2 parts par défaut — une
// pour chacun — et à un plat « pour Clément » d'en valoir 1.
//
// (La version précédente traitait `portions` comme un multiplicateur de la
// casserole entière : une crème prévue pour 4 comptait alors 500 kcal par
// personne au lieu de 250. La division par `recipe.servings` était bonne, c'est
// la valeur par défaut — 1 au lieu de 2 — qui était fausse.)
//
// `who` désigne pour qui est le plat : une personne seule mange toutes les parts
// servies, « nous deux » les partage selon la répartition des ingrédients.
export function buildMealNutrition(recipe, portions, who, foodById) {
  if (!recipe) return null
  const served = portions > 0 ? portions : 1
  // Nombre de portions non renseigné : on suppose que la recette nourrit la
  // tablée, comme le fait la fiche recette. Retomber sur 1 aurait compté la
  // casserole entière pour chacun.
  const servings = recipe.servings > 0 ? recipe.servings : AUTHORIZED_UIDS.length
  const factor = served / servings

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
