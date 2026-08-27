// node --test src/apps/cookit/utils/
//
// Le rangement par rayon est une DEVINETTE. Ces tests ne cherchent pas la
// perfection : ils garantissent qu'on ne se trompe pas avec assurance, ce qui
// est bien pire que de répondre « Autres ».

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveFoodAisle } from './foodAisle.js'
import { guessAisle } from './aisleGuess.js'

test('les groupes Open Food Facts rangent le produit sans deviner', () => {
  assert.equal(resolveFoodAisle({ name: 'Cheddar cheese', group: 'Milk and dairy products' }), 'cremerie')
  assert.equal(resolveFoodAisle({ name: 'Nutella', group: 'Sugary snacks' }), 'epicerie-sucree')
  assert.equal(resolveFoodAisle({ name: 'Powerade', group: 'Beverages' }), 'boissons')
  assert.equal(resolveFoodAisle({ name: 'X', group: 'Fish Meat Eggs' }), 'boucherie')
  // La casse diffère entre pnns_groups_1 et food_groups_tags.
  assert.equal(resolveFoodAisle({ name: 'X', group: 'milk and dairy products' }), 'cremerie')
})

test('les groupes CIQUAL continuent de fonctionner', () => {
  assert.equal(resolveFoodAisle({ name: 'Poulet, blanc', group: 'viandes, œufs, poissons et assimilés' }), 'boucherie')
  assert.equal(resolveFoodAisle({ name: 'Riz', group: 'produits céréaliers' }), 'epicerie-salee')
})

test('un aliment déjà rangé dans « autres » est re-deviné, pas figé', () => {
  // Le bug d'origine : « autres » étant un id valide, il passait pour un choix
  // délibéré et aucun code ne pouvait plus le corriger.
  assert.equal(resolveFoodAisle({ name: 'Cheddar cheese', aisle: 'autres' }), 'cremerie')
})

test('un rayon choisi à la main est respecté', () => {
  assert.equal(
    resolveFoodAisle({ name: 'Cheddar cheese', group: 'Milk and dairy products', aisle: 'autres', aisleManual: true }),
    'autres',
  )
  assert.equal(
    resolveFoodAisle({ name: 'Cheddar cheese', aisle: 'boissons', aisleManual: true }),
    'boissons',
  )
})

test('les faux positifs de sous-chaîne sont éteints', () => {
  // Chacun de ces noms donnait auparavant une réponse fausse et confiante.
  assert.notEqual(guessAisle('Mussels in Brine'), 'epicerie-salee') // « mus-sel-s »
  assert.equal(guessAisle('Southern Fried Chicken'), 'boucherie')   // et non « sou-the-rn »
  assert.equal(guessAisle('Daily Juice'), 'boissons')               // et non « d-ail-y »
})

test('les noms anglais courants tombent au bon rayon', () => {
  const expected = {
    'Full Cream Milk': 'cremerie',
    'Woolworths Greek Style Yoghurt': 'cremerie',
    'Chicken Breast': 'boucherie',
    'Bananas': 'fruits-legumes',
    'Frozen Peas': 'surgeles',
    'Sparkling Water': 'boissons',
    'Extra Virgin Olive Oil': 'epicerie-salee',
  }
  for (const [name, aisle] of Object.entries(expected)) {
    assert.equal(guessAisle(name), aisle, name)
  }
})

test('les mots-clés composés l’emportent sur les simples', () => {
  // « peanut butter » doit gagner contre « butter », sinon → crémerie.
  assert.equal(guessAisle('Peanut Butter'), 'epicerie-salee')
  // « jus » / « juice » doit gagner contre le nom du fruit.
  assert.equal(guessAisle('Jus d’orange'), 'boissons')
  assert.equal(guessAisle('Orange Juice'), 'boissons')
  // …sans casser le fruit seul.
  assert.equal(guessAisle('Orange'), 'fruits-legumes')
})

test('les pluriels français ne régressent pas', () => {
  assert.equal(guessAisle('Pommes de terre'), 'fruits-legumes')
  assert.equal(guessAisle('Lardons fumés'), 'boucherie')
  assert.equal(guessAisle('Pâtes'), 'epicerie-salee')
})

// --- Nom principal, boulangerie, poissonnerie ---

test('le complément ne décide plus du rayon à la place du produit', () => {
  // « eau » est un mot-clé « boissons » : le maquereau en boîte finissait au
  // rayon Boissons à cause de son propre jus.
  assert.equal(guessAisle('Maquereaux à l’eau'), 'boucherie')
  assert.equal(guessAisle('Thon à l’huile'), 'boucherie')
  assert.equal(guessAisle('Yaourt à la grecque'), 'cremerie')
  assert.equal(guessAisle('Tarte au citron'), 'epicerie-sucree')
  // …sans casser les noms dont la tête ne dit rien.
  assert.equal(guessAisle('Filet de saumon'), 'boucherie')
})

test('la boulangerie existe enfin', () => {
  const expected = {
    'Pain à hot dog': 'boulangerie',
    'Pain de mie': 'boulangerie',
    Baguette: 'boulangerie',
    'Hot dog rolls': 'boulangerie',
    'Sourdough Bread': 'boulangerie',
    Brioche: 'boulangerie',
  }
  for (const [name, aisle] of Object.entries(expected)) {
    assert.equal(guessAisle(name), aisle, name)
  }
  // Le mot « roll » ne doit pas emporter le papier toilette avec lui.
  assert.equal(guessAisle('Toilet Rolls'), 'hygiene')
})

test('les poissons courants ne sont plus des inconnus', () => {
  for (const name of ['Maquereaux', 'Sardines', 'Cabillaud', 'Mackerel', 'Barramundi', 'Mussels']) {
    assert.equal(guessAisle(name), 'boucherie', name)
  }
})

test('un groupe fourre-tout cède devant un nom précis', () => {
  // « Cereals and potatoes » range aussi bien les pâtes que le pain : il ne peut
  // pas trancher seul. Les groupes spécifiques, eux, gardent la priorité.
  assert.equal(resolveFoodAisle({ name: 'Hot dog rolls', group: 'Cereals and potatoes' }), 'boulangerie')
  assert.equal(resolveFoodAisle({ name: 'Barilla Spaghetti', group: 'Cereals and potatoes' }), 'epicerie-salee')
  assert.equal(resolveFoodAisle({ name: 'Produit sans nom parlant', group: 'Composite foods' }), 'epicerie-salee')
  assert.equal(resolveFoodAisle({ name: 'Cheddar cheese', group: 'Milk and dairy products' }), 'cremerie')
})
