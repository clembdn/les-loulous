// node --test src/apps/cookit/utils/
//
// Le projet n'a pas de test runner : on utilise `node:test`, intégré à Node 20,
// pour ne pas ajouter de dépendance. Ces tests verrouillent les conversions —
// c'est là que se cachent les erreurs silencieuses d'un calcul nutritionnel.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toGrams, sumIngredients, perServing, UNRESOLVED } from './nutrition.js'

const OEUF = { per100: { kcal: 140, proteins: 12.7, carbs: 0.27, fat: 9.83 }, gramsPerPiece: 55 }
const RIZ = { per100: { kcal: 356, proteins: 7.11, carbs: 78.6, fat: 0.98 } }
const HUILE = { per100: { kcal: 900, proteins: 0, carbs: 0, fat: 100 }, densityGPerMl: 0.92 }

test('masses et volumes se convertissent', () => {
  assert.equal(toGrams(200, 'g', RIZ).grams, 200)
  assert.equal(toGrams(1.5, 'kg', RIZ).grams, 1500)
  // Volume sans densité connue : on retombe sur celle de l'eau.
  assert.equal(toGrams(250, 'ml', RIZ).grams, 250)
  // Avec une densité, l'huile pèse moins que son volume.
  assert.equal(toGrams(100, 'ml', HUILE).grams, 92)
})

test('cuillères : 1 c. à s. = 15 mL, 1 c. à c. = 5 mL', () => {
  assert.equal(toGrams(1, 'cas', RIZ).grams, 15)
  assert.equal(toGrams(2, 'cac', RIZ).grams, 10)
  assert.equal(Math.round(toGrams(1, 'cas', HUILE).grams * 10) / 10, 13.8)
})

test('les pièces exigent un poids unitaire, sinon on refuse d’inventer', () => {
  assert.equal(toGrams(2, 'piece', OEUF).grams, 110)
  const sans = toGrams(2, 'tranche', RIZ)
  assert.equal(sans.grams, null)
  assert.equal(sans.reason, UNRESOLVED.NEEDS_PIECE_WEIGHT)
})

test('un ingrédient non estimé n’est jamais compté comme zéro', () => {
  const r = sumIngredients(
    [
      { name: 'Riz', quantity: 100, unit: 'g', foodId: 'riz' },
      { name: 'Persil', quantity: null, unit: null, foodId: 'riz' },
      { name: 'Sel', quantity: 1, unit: 'pincee', foodId: null },
    ],
    new Map([['riz', RIZ]]),
  )
  assert.equal(r.totals.kcal, 356)
  assert.equal(r.resolvedCount, 1)
  assert.deepEqual(
    r.unresolved.map((u) => u.reason),
    [UNRESOLVED.NO_QUANTITY, UNRESOLVED.NO_FOOD],
  )
})

test('le poids saisi à la main suit le facteur de portions', () => {
  // Le piège : `gramsOverride` figé quand on double les portions.
  const ing = [{ name: 'Pain', quantity: 2, unit: 'tranche', foodId: 'p', gramsOverride: 60 }]
  const by = new Map([['p', { per100: { kcal: 250, proteins: 8, carbs: 50, fat: 2 } }]])
  assert.equal(sumIngredients(ing, by, 1).totals.kcal, 150)
  assert.equal(sumIngredients(ing, by, 2).totals.kcal, 300)
})

test('le total par portion divise bien', () => {
  const totals = { kcal: 1000, proteins: 50, carbs: 100, fat: 20 }
  assert.equal(perServing(totals, 4).kcal, 250)
  assert.equal(perServing(totals, 0), null)
})
