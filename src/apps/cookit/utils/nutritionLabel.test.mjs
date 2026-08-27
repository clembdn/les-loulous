// node --test src/apps/cookit/utils/
//
// L'OCR lui-même ne se teste pas sans navigateur — mais le parseur, si. Et
// c'est lui qui porte le vrai risque : confondre la colonne « per serve » avec
// la colonne « per 100 g » donne des valeurs crédibles et fausses.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNutritionLabel } from './nutritionLabel.js'

// Panneau australien type (Woolworths / Coles) : deux colonnes, énergie en kJ,
// sodium en mg, pas de ligne « sel ».
const AU = `
NUTRITION INFORMATION
Servings per package: 4
Serving size: 125g
                Avg Quantity    Avg Quantity
                per Serving     per 100g
Energy          1450kJ          1160kJ
Protein         5.2g            4.2g
Fat, Total      12.0g           9.6g
 - Saturated    3.1g            2.5g
Carbohydrate    45.0g           36.0g
 - Sugars       8.0g            6.4g
Dietary Fibre   2.0g            1.6g
Sodium          210mg           168mg
`

const FR = `
Valeurs nutritionnelles pour 100 g
Énergie 2252 kJ / 539 kcal
Matières grasses 30,9 g
dont acides gras saturés 10,6 g
Glucides 57,5 g
dont sucres 56,3 g
Protéines 6,3 g
Sel 0,107 g
`

test('étiquette australienne : on prend la colonne 100 g, jamais la portion', () => {
  const r = parseNutritionLabel(AU)
  assert.equal(r.twoColumns, true)
  // 1160 kJ / 4,184 = 277 kcal. Si on avait pris la colonne portion : 347.
  assert.equal(r.per100.kcal, 277)
  assert.equal(r.per100.proteins, 4.2)
  assert.equal(r.per100.fat, 9.6)
  assert.equal(r.per100.satFat, 2.5)
  assert.equal(r.per100.carbs, 36)
  assert.equal(r.per100.sugars, 6.4)
  assert.equal(r.per100.fiber, 1.6)
  // 168 mg de sodium → 0,42 g de sel.
  assert.equal(r.per100.salt, 0.42)
  assert.equal(r.servingGrams, 125)
  assert.equal(r.confidence, 1)
})

test('étiquette française : kcal explicites, virgule décimale, une seule colonne', () => {
  const r = parseNutritionLabel(FR)
  assert.equal(r.twoColumns, false)
  // La ligne porte kJ ET kcal : c'est la valeur en kcal qui doit gagner.
  assert.equal(r.per100.kcal, 539)
  assert.equal(r.per100.fat, 30.9)
  assert.equal(r.per100.satFat, 10.6)
  assert.equal(r.per100.carbs, 57.5)
  assert.equal(r.per100.sugars, 56.3)
  assert.equal(r.per100.proteins, 6.3)
  assert.equal(r.per100.salt, 0.107)
})

test('« dont … » ne doit pas écraser sa ligne parente', () => {
  const r = parseNutritionLabel(FR)
  assert.notEqual(r.per100.fat, r.per100.satFat)
  assert.notEqual(r.per100.carbs, r.per100.sugars)
})

test('texte bruité par l’OCR : O lu pour 0, accents perdus', () => {
  const r = parseNutritionLabel(`
    Nutrition Information
    Per Serving   Per 1OOg
    Energy        85O kJ      4OO kJ
    Proteins      1O.5 g      5.O g
    Fat           2.O g       1.O g
    Carbohydrate  2O.O g      1O.O g
  `)
  assert.equal(r.per100.kcal, 96) // 400 kJ
  assert.equal(r.per100.proteins, 5)
  assert.equal(r.per100.carbs, 10)
})

test('une photo illisible ne renvoie pas des zéros, mais du vide', () => {
  const r = parseNutritionLabel('~~~ flou ~~~\n???')
  assert.equal(r.per100.kcal, null)
  assert.equal(r.per100.proteins, null)
  assert.equal(r.confidence, 0)
})
