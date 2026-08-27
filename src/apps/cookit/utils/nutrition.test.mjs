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

// --- Répartition entre les deux personnes ---

import { shareFor, gramsForShare, splitFromGrams, sumIngredientsForPerson, personFactor } from './nutrition.js'
import { CLEMENT_UID, LISE_UID } from '../../../shared/config/people.js'

const PATES = { name: 'Pâtes', quantity: 250, unit: 'g', foodId: 'p' }
const FARINE = { per100: { kcal: 350, proteins: 12, carbs: 70, fat: 2 } }
const BY = new Map([['p', FARINE]])

test('sans répartition, les parts sont égales', () => {
  assert.equal(shareFor(PATES, CLEMENT_UID), 0.5)
  assert.equal(gramsForShare(PATES, CLEMENT_UID), 125)
  assert.equal(gramsForShare(PATES, LISE_UID), 125)
})

test('le cas d’usage : 250 g de pâtes, 150 pour l’un', () => {
  const split = splitFromGrams(PATES, CLEMENT_UID, 150)
  const ing = { ...PATES, split }
  assert.equal(gramsForShare(ing, CLEMENT_UID), 150)
  assert.equal(gramsForShare(ing, LISE_UID), 100)
})

test('les deux parts redonnent EXACTEMENT le total', () => {
  // Le piège des arrondis : deux fractions arrondies séparément ne retombent pas
  // forcément sur le total, et les calories du couple partiraient à la dérive.
  for (const g of [150, 133, 1, 249, 175.5]) {
    const ing = { ...PATES, split: splitFromGrams(PATES, CLEMENT_UID, g) }
    const somme = gramsForShare(ing, CLEMENT_UID) + gramsForShare(ing, LISE_UID)
    assert.ok(Math.abs(somme - 250) < 0.2, `${g} → somme ${somme}`)

    const c = sumIngredientsForPerson([ing], BY, CLEMENT_UID).totals.kcal
    const l = sumIngredientsForPerson([ing], BY, LISE_UID).totals.kcal
    const total = sumIngredients([ing], BY).totals.kcal
    assert.ok(Math.abs(c + l - total) < 0.5, `${g} → ${c}+${l} ≠ ${total}`)
  }
})

test('une part égale ne stocke rien', () => {
  // Pas de donnée inutile en base quand on retombe sur le défaut.
  assert.equal(splitFromGrams(PATES, CLEMENT_UID, 125), null)
})

test('la répartition survit au changement de portions', () => {
  const ing = { ...PATES, split: splitFromGrams(PATES, CLEMENT_UID, 150) }
  const x1 = sumIngredientsForPerson([ing], BY, CLEMENT_UID, 1).totals.kcal
  const x2 = sumIngredientsForPerson([ing], BY, CLEMENT_UID, 2).totals.kcal
  // C'est tout l'intérêt de stocker des fractions et non des grammes.
  assert.ok(Math.abs(x2 - x1 * 2) < 0.01)
})

test('un ingrédient non estimé ne vaut pas zéro pour une personne non plus', () => {
  const r = sumIngredientsForPerson(
    [{ name: 'Sel', quantity: 1, unit: 'pincee', foodId: null }],
    BY,
    CLEMENT_UID,
  )
  assert.equal(r.resolvedCount, 0)
  assert.equal(r.unresolved.length, 1)
})

test('une répartition incohérente est renormalisée au lieu de fausser le total', () => {
  const ing = { ...PATES, split: { [CLEMENT_UID]: 3, [LISE_UID]: 1 } }
  assert.equal(shareFor(ing, CLEMENT_UID), 0.75)
  assert.equal(gramsForShare(ing, CLEMENT_UID) + gramsForShare(ing, LISE_UID), 250)
})

// --- Une portion par personne, quel que soit le format de la recette ---

test('la part d’une personne, c’est UNE portion — pas la moitié de la casserole', () => {
  // Le bug signalé : crème chocolat prévue pour 4, 1 000 kcal au total, la fiche
  // affichait 500 kcal pour Clément là où il en mange 250.
  const creme = [{ name: 'Base', quantity: 500, unit: 'g', foodId: 'c' }]
  const by = new Map([['c', { per100: { kcal: 200, proteins: 4, carbs: 30, fat: 8 } }]])

  assert.equal(sumIngredients(creme, by).totals.kcal, 1000)
  assert.equal(sumIngredientsForPerson(creme, by, CLEMENT_UID, personFactor(4)).totals.kcal, 250)

  // Une recette « pour 2 » se mange entièrement à deux : rien ne change pour elle.
  const ing = { ...PATES, split: splitFromGrams(PATES, CLEMENT_UID, 150) }
  assert.equal(sumIngredientsForPerson([ing], BY, CLEMENT_UID, personFactor(2)).totals.kcal, 525)
  assert.equal(sumIngredientsForPerson([ing], BY, LISE_UID, personFactor(2)).totals.kcal, 350)
})

test('changer le curseur de portions ne change pas la part d’une personne', () => {
  // Servir 6 parts au lieu de 4 fait grossir le total, pas l'assiette de chacun.
  const creme = [{ name: 'Base', quantity: 500, unit: 'g', foodId: 'c' }]
  const by = new Map([['c', { per100: { kcal: 200, proteins: 4, carbs: 30, fat: 8 } }]])
  const at = (cible) => {
    const facteur = cible / 4
    return sumIngredientsForPerson(creme, by, CLEMENT_UID, facteur * personFactor(cible)).totals.kcal
  }
  assert.equal(at(4), 250)
  assert.equal(at(6), 250)
  assert.equal(at(2), 250)
})

test('un nombre de portions inconnu ne divise rien', () => {
  assert.equal(personFactor(null), 1)
  assert.equal(personFactor(0), 1)
  assert.equal(personFactor(2), 1)
  assert.equal(personFactor(4), 0.5)
})
