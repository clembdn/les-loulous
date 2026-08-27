// node --test src/apps/cookit/utils/
//
// Le pont planning → journal. Deux invariants comptent plus que le reste :
// chacun ne voit que sa part, et un plat non estimable n'est jamais compté zéro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMealNutrition, plannedEntriesFor } from './plannedMeals.js'
import { CLEMENT_UID, LISE_UID } from '../../../shared/config/people.js'
import { WHO_BOTH } from './who.js'

const PATES = { per100: { kcal: 350, proteins: 12, carbs: 70, fat: 2 } }
const BY = new Map([['p', PATES]])

// Carbonara « pour 2 » : 250 g de pâtes, partagées 150 / 100.
const CARBONARA = {
  id: 'r1',
  title: 'Pâtes carbonara',
  servings: 2,
  ingredients: [
    { name: 'Pâtes', quantity: 250, unit: 'g', foodId: 'p', split: { [CLEMENT_UID]: 0.6, [LISE_UID]: 0.4 } },
  ],
}

// Crème chocolat « pour 4 » : 1 000 kcal en tout, donc 250 par portion.
const CREME = {
  id: 'r3',
  title: 'Crème chocolat',
  servings: 4,
  ingredients: [{ name: 'Base', quantity: 500, unit: 'g', foodId: 'c' }],
}
const BY4 = new Map([['c', { per100: { kcal: 200, proteins: 4, carbs: 30, fat: 8 } }]])

test('« nous deux » fige une nutrition différente pour chacun', () => {
  // 2 parts servies : une pour chacun. La carbonara est prévue pour 2, donc
  // c'est tout le plat — réparti 150 / 100 g de pâtes à 350 kcal/100 g.
  const n = buildMealNutrition(CARBONARA, 2, WHO_BOTH, BY)
  assert.equal(Math.round(n[CLEMENT_UID].kcal), 525)
  assert.equal(Math.round(n[LISE_UID].kcal), 350)
  assert.equal(Math.round(n[CLEMENT_UID].kcal + n[LISE_UID].kcal), 875)
})

test('une recette pour 4 ne compte pas une demi-casserole par personne', () => {
  // Le bug signalé : 1 000 kcal pour 4 portions donnaient 500 kcal à chacun.
  const n = buildMealNutrition(CREME, 2, WHO_BOTH, BY4)
  assert.equal(Math.round(n[CLEMENT_UID].kcal), 250)
  assert.equal(Math.round(n[LISE_UID].kcal), 250)
})

test('un plat pour une seule personne lui revient en entier', () => {
  // Une seule part servie, pour lui : il la mange toute, sans partage.
  const n = buildMealNutrition(CREME, 1, CLEMENT_UID, BY4)
  assert.equal(Math.round(n[CLEMENT_UID].kcal), 250)
  assert.equal(n[LISE_UID], undefined)
  // Et s'il finit la casserole, il prend les 4 parts.
  assert.equal(Math.round(buildMealNutrition(CREME, 4, CLEMENT_UID, BY4)[CLEMENT_UID].kcal), 1000)
})

test('un plat non estimable ne fige pas des zéros', () => {
  const vide = { id: 'r2', title: 'X', servings: 2, ingredients: [{ name: 'Sel', quantity: 1, unit: 'pincee', foodId: null }] }
  // Figer 0 kcal ferait compter un vrai repas comme nul dans le journal.
  assert.equal(buildMealNutrition(vide, 2, WHO_BOTH, BY), null)
  assert.equal(buildMealNutrition(null, 2, WHO_BOTH, BY), null)
})

const DAY = {
  id: '2026-08-27',
  midi: [
    { id: 'm1', recipeId: 'r1', title: 'Pâtes carbonara', who: WHO_BOTH, portions: 1,
      nutrition: { [CLEMENT_UID]: { kcal: 525, proteins: 18, carbs: 105, fat: 3 }, [LISE_UID]: { kcal: 350, proteins: 12, carbs: 70, fat: 2 } } },
    { id: 'm2', recipeId: 'r9', title: 'Salade', who: CLEMENT_UID, portions: 1,
      nutrition: { [CLEMENT_UID]: { kcal: 120, proteins: 3, carbs: 8, fat: 7 } } },
  ],
  soir: [
    { id: 'm3', recipeId: null, title: 'Resto', who: WHO_BOTH, portions: 1, nutrition: null },
  ],
}

test('chacun ne voit que les plats qui le concernent, avec sa part', () => {
  const c = plannedEntriesFor(DAY, CLEMENT_UID)
  const l = plannedEntriesFor(DAY, LISE_UID)

  assert.deepEqual(c.map((e) => e.label), ['Pâtes carbonara', 'Salade', 'Resto'])
  // La salade est « pour Clément » : elle n'apparaît pas chez Lise.
  assert.deepEqual(l.map((e) => e.label), ['Pâtes carbonara', 'Resto'])

  assert.equal(c[0].kcal, 525)
  assert.equal(l[0].kcal, 350)
})

test('un repas libre remonte sans valeurs, pas à zéro', () => {
  const [resto] = plannedEntriesFor(DAY, LISE_UID).filter((e) => e.label === 'Resto')
  assert.equal(resto.kcal, null)
  assert.notEqual(resto.kcal, 0)
})

test('le créneau du planning devient celui du journal', () => {
  const c = plannedEntriesFor(DAY, CLEMENT_UID)
  assert.equal(c.find((e) => e.label === 'Pâtes carbonara').slot, 'midi')
  assert.equal(c.find((e) => e.label === 'Resto').slot, 'soir')
})

test('retirer un plat de son journal ne touche pas celui de l’autre', () => {
  const overrides = { m1: { skipped: true } }
  const c = plannedEntriesFor(DAY, CLEMENT_UID, overrides)
  const l = plannedEntriesFor(DAY, LISE_UID)   // Lise n'a rien retiré
  assert.equal(c.some((e) => e.mealId === 'm1'), false)
  assert.equal(l.some((e) => e.mealId === 'm1'), true)
})

test('les lignes dérivées portent un id stable et distinct', () => {
  // Stable : pas de doublon d'une image à l'autre. Distinct : impossible de le
  // confondre avec l'id d'une vraie entrée de journal.
  const a = plannedEntriesFor(DAY, CLEMENT_UID)
  const b = plannedEntriesFor(DAY, CLEMENT_UID)
  assert.deepEqual(a.map((e) => e.id), b.map((e) => e.id))
  assert.ok(a.every((e) => e.id.startsWith('planned:') && e.planned === true))
})

test('le nombre de parts servies met le repas à l’échelle', () => {
  const deux = buildMealNutrition(CREME, 2, WHO_BOTH, BY4)
  const quatre = buildMealNutrition(CREME, 4, WHO_BOTH, BY4)
  assert.equal(Math.round(deux[CLEMENT_UID].kcal * 2), Math.round(quatre[CLEMENT_UID].kcal))
})

test('une recette sans nombre de portions vaut une tablée', () => {
  // Rien à diviser : on ne va pas inventer un découpage.
  const sans = { id: 'r4', title: 'Y', ingredients: CARBONARA.ingredients }
  const n = buildMealNutrition(sans, 2, WHO_BOTH, BY)
  assert.equal(Math.round(n[CLEMENT_UID].kcal + n[LISE_UID].kcal), 875)
})

test('une journée vide ne produit rien', () => {
  assert.deepEqual(plannedEntriesFor(null, CLEMENT_UID), [])
  assert.deepEqual(plannedEntriesFor({ midi: [], soir: [] }, CLEMENT_UID), [])
})
