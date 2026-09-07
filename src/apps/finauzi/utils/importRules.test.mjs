// node --test src/apps/finauzi/utils/
//
// Deviner la catégorie d'une ligne de relevé. L'invariant qui compte : un
// commerçant se reconnaît en MOTS ENTIERS. La comparaison se faisait sur la
// sous-chaîne brute, et « eau » (le fournisseur d'eau) attrapait BUREAU,
// BORDEAUX, CHATEAU et BEAUTY pendant que « ola » (le VTC) attrapait SOLARIUM.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLabel, prettifyLabel, guessCategory, ruleKeyFor, learnRule } from './importRules.js'

test('le nettoyage retire le bruit bancaire et garde le commerçant', () => {
  assert.equal(normalizeLabel('CB CARREFOUR MARKET 14/08 CARTE 4979'), 'carrefour market')
  assert.equal(normalizeLabel('EFTPOS WOOLWORTHS 2043 SYDNEY AUS'), 'woolworths sydney')
  assert.equal(normalizeLabel('PRÉLÈVEMENT ÉLECTRICITÉ'), 'electricite')
  // « direct debit » part en entier : sinon « direct » survivrait seul.
  assert.equal(normalizeLabel('DIRECT DEBIT AGL ENERGY'), 'agl energy')
})

test('un commerçant ne se reconnaît qu\'en mots entiers', () => {
  // Les six libellés qui partaient dans la mauvaise catégorie.
  for (const label of ['BUREAU VALLEE', 'CB BORDEAUX METRO', 'CHATEAU MARGAUX', 'NOUVEAU MONDE', 'BEAUTY SUCCESS']) {
    assert.equal(guessCategory(label, 'expense'), null, `${label} ne doit pas être une facture`)
  }
  for (const label of ['SOLARIUM', 'ACHAT CHOCOLATERIE DUPONT']) {
    assert.equal(guessCategory(label, 'expense'), null, `${label} ne doit pas être du transport`)
  }
  // Le mot entier, lui, doit toujours répondre.
  assert.equal(guessCategory('PRLV VEOLIA EAU', 'expense'), 'utilities')
  assert.equal(guessCategory('CB GARAGE MARTIN', 'expense'), 'transport')
})

test('le commerçant le plus précis gagne, quel que soit l\'ordre des catégories', () => {
  // « total » (carburant) et « totalenergies » (électricité) vivent dans deux
  // catégories différentes ; c'est la correspondance la plus longue qui tranche.
  assert.equal(guessCategory('PRLV SEPA TOTALENERGIES ELECTRICITE', 'expense'), 'utilities')
  assert.equal(guessCategory('CB TOTAL ACCESS 14/08 CARTE 4979', 'expense'), 'transport')
  assert.equal(guessCategory('CB TOTALENERGIES ACCES NANTES', 'expense'), 'transport')
  // Même arbitrage entre « uber » et « uber eats ».
  assert.equal(guessCategory('UBER EATS SYDNEY', 'expense'), 'restaurants')
  assert.equal(guessCategory('UBER TRIP SYDNEY', 'expense'), 'transport')
})

test('les commerçants ponctués passent par le même nettoyage que les libellés', () => {
  // Comparés bruts, ils ne pouvaient jamais correspondre : le nettoyage retire
  // le point et le tiret du libellé mais pas de la table.
  assert.equal(guessCategory('APPLE.COM/BILL', 'expense'), 'subscriptions')
  assert.equal(guessCategory('JB HI-FI ONLINE', 'expense'), 'shopping')
})

test('le sens de l\'argent filtre la catégorie', () => {
  assert.equal(guessCategory('VIR SEPA SALAIRE ACME', 'income'), 'salary')
  // Un salaire en dépense n'a pas de sens, une dépense en crédit non plus.
  assert.equal(guessCategory('VIR SEPA SALAIRE ACME', 'expense'), null)
  assert.equal(guessCategory('REMBOURSEMENT CARREFOUR', 'income'), 'bonus')
  assert.equal(guessCategory('CB CARREFOUR MARKET', 'expense'), 'groceries')
})

test('une règle apprise passe avant la table', () => {
  const rules = learnRule({}, 'CB CARREFOUR MARKET 14/08', 'restaurants')
  assert.equal(rules.carrefour, 'restaurants')
  assert.equal(guessCategory('CB CARREFOUR CITY', 'expense', rules), 'restaurants')
  // Et elle vaut pour les autres enseignes du même commerçant.
  assert.equal(guessCategory('CB CARREFOUR MARKET', 'expense', rules), 'restaurants')
})

test('la clé de règle vise le commerçant, pas le libellé entier', () => {
  assert.equal(ruleKeyFor('CB CARREFOUR MARKET 14/08 CARTE 4979'), 'carrefour')
  // Un premier mot court ne suffit pas à identifier : on en prend deux.
  assert.equal(ruleKeyFor('EFTPOS IGA MARRICKVILLE'), 'iga marrickville')
  assert.equal(ruleKeyFor('CB 4979 14/08'), null)
})

test('le titre affiché reste lisible même sans commerçant reconnaissable', () => {
  assert.equal(prettifyLabel('CB CARREFOUR MARKET 14/08 CARTE 4979'), 'Carrefour Market')
  assert.equal(prettifyLabel(''), 'Opération')
  assert.equal(prettifyLabel('CB 4979'), 'CB 4979')
})
