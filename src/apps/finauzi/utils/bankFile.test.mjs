// node --test src/apps/finauzi/utils/
//
// Lecture d'un relevé téléchargé. L'invariant qui compte : un fichier valide ne
// doit JAMAIS rendre zéro ligne en silence. C'est ce qui arrivait à un export
// Caisse d'Épargne dont la ligne de préambule contenait des virgules — le
// détecteur de séparateur se calait dessus et écartait le point-virgule.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBankFile, parseAmount, parseBankDate } from './bankFile.js'

const CE_BODY = [
  'Date;Libelle;Debit;Credit',
  '14/08/2025;CB CARREFOUR MARKET;45,20;',
  '15/08/2025;VIR SALAIRE;;2100,00',
].join('\n')

test('un préambule à virgules ne fait plus rater le séparateur', () => {
  const withPreamble = 'Compte, N 04123456789, Solde au 31/08/2025\n' + CE_BODY

  assert.equal(parseBankFile(CE_BODY).lines.length, 2, 'sans préambule')
  assert.equal(parseBankFile(withPreamble).lines.length, 2, 'avec préambule à virgules')
  assert.equal(parseBankFile('Compte N 04123456789\n' + CE_BODY).lines.length, 2, 'préambule sans virgule')
})

test('colonnes Débit / Crédit séparées : le sens vient de la colonne', () => {
  const { lines } = parseBankFile(CE_BODY)
  const byLabel = Object.fromEntries(lines.map((l) => [l.label, l.amount]))

  assert.equal(byLabel['CB CARREFOUR MARKET'], -45.2, 'un débit sort')
  assert.equal(byLabel['VIR SALAIRE'], 2100, 'un crédit entre')
})

test('CommBank : pas d\'en-tête, les colonnes se devinent au contenu', () => {
  const cba = [
    '14/08/2025,"-45.20","EFTPOS WOOLWORTHS 2043","1954.80"',
    '15/08/2025,"2100.00","SALARY ACME","4054.80"',
  ].join('\n')

  const { lines } = parseBankFile(cba)
  assert.equal(lines.length, 2)
  // Le plus récent en tête.
  assert.equal(lines[0].date, '2025-08-15')
  assert.equal(lines[0].amount, 2100)
  assert.equal(lines[1].amount, -45.2)
})

test('un fichier sans colonne de montant le DIT au lieu de rendre zéro ligne', () => {
  const noAmount = ['Date;Libelle', '14/08/2025;CB CARREFOUR'].join('\n')
  const result = parseBankFile(noAmount)

  assert.equal(result.lines.length, 0)
  assert.equal(result.error, 'no-amount-column')
})

test('un OFX porte son FITID, seul dédoublonnage exact', () => {
  const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>AUD
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250814120000<TRNAMT>-45.20<FITID>ABC123<NAME>WOOLWORTHS<MEMO>SYDNEY</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20250815<TRNAMT>2100.00<FITID>ABC124<NAME>SALARY</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

  const result = parseBankFile(ofx)
  assert.equal(result.format, 'ofx')
  assert.equal(result.currency, 'AUD')
  assert.equal(result.lines.length, 2)
  assert.equal(result.lines[1].externalId, 'ABC123')
  assert.equal(result.lines[1].label, 'WOOLWORTHS — SYDNEY')
  assert.equal(result.lines[1].date, '2025-08-14')
})

test('sans FITID, une empreinte distingue deux lignes identiques du même jour', () => {
  const twice = [
    'Date;Libelle;Montant',
    '14/08/2025;CB CAFE;-4,50',
    '14/08/2025;CB CAFE;-4,50',
  ].join('\n')

  const { lines } = parseBankFile(twice)
  assert.equal(lines.length, 2)
  assert.notEqual(lines[0].externalId, lines[1].externalId)
  assert.ok(lines.every((l) => l.isSyntheticId))
})

test('les montants se lisent dans les deux conventions', () => {
  assert.equal(parseAmount('1 234,56'), 1234.56)   // France
  assert.equal(parseAmount('-1234.56'), -1234.56)  // Australie
  assert.equal(parseAmount('(45,20)'), -45.2)      // parenthèses = débit
  // Trois décimales sans autre séparateur : c'est un millier, pas des centimes.
  assert.equal(parseAmount('1.234'), 1234)
  assert.equal(parseAmount('1.234,56'), 1234.56)
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('n/a'), null)
})

test('les dates se lisent dans les trois formats, toujours en clé locale', () => {
  assert.equal(parseBankDate('20250814120000'), '2025-08-14') // OFX
  assert.equal(parseBankDate('2025-08-14'), '2025-08-14')     // ISO
  assert.equal(parseBankDate('14/08/2025'), '2025-08-14')     // jour en premier
  assert.equal(parseBankDate('14/08/25'), '2025-08-14')
  assert.equal(parseBankDate('pas une date'), null)
})
