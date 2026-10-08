// node --test src/apps/finauzi/utils/
//
// Le rapprochement d'un relevé : ce qui est déjà connu ne doit JAMAIS être
// recréé (le loyer compterait deux fois), et ce qui est neuf ne doit pas être
// avalé par une échéance qui ne lui correspond pas.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLEMENT_UID as C } from '../../../shared/config/people.js'
import { IMPORT_STATUS, reconcileStatement, summarize } from './importMatch.js'

const RATE = 2 // 1 € = 2 A$
const { IMPORTED, EXPECTED, NEW } = IMPORT_STATUS

let n = 0
const tx = (fields) => ({ id: `t${++n}`, recurrence: 'one-off', isActive: true, split: 'common', ...fields })
const line = (date, amount, label = 'OPERATION', externalId = `fit-${++n}`) => ({ date, amount, label, externalId })
const run = (lines, transactions, accountId) => reconcileStatement(lines, { transactions, accountId, rate: RATE })
const statusOf = (rows, externalId) => rows.find((r) => r.line.externalId === externalId)?.status

test('déjà importée (même identifiant bancaire, même compte) : on n’y touche pas', () => {
  const known = [tx({ kind: 'expense', amount: 12, currency: 'EUR', fromAccount: 'clement', date: '2026-09-02', externalId: 'clement:FIT1' })]
  const rows = run([line('2026-09-02', -12, 'CAFE', 'FIT1')], known, 'clement')
  assert.equal(rows[0].status, IMPORTED)
  assert.equal(rows[0].selected, false)
  // Le même numéro d'opération sur UN AUTRE compte n'est pas un doublon.
  assert.equal(run([line('2026-09-02', -12, 'CAFE', 'FIT1')], known, 'lise')[0].status, NEW)
})

test('le loyer saisi une fois en récurrence : le prélèvement du mois est « attendu », pas recréé', () => {
  const rent = tx({ kind: 'expense', amount: 2400, currency: 'AUD', fromAccount: 'joint', recurrence: 'monthly', date: '2026-07-01' })
  const rows = run([line('2026-09-03', -2400, 'RENT')], [rent], 'joint')
  assert.equal(rows[0].status, EXPECTED)
  assert.equal(rows[0].match.tx, rent)
  assert.equal(rows[0].selected, false, 'rien à créer')
})

test('au-delà de 4 jours d’écart, ou au mauvais signe, ce n’est pas la même opération', () => {
  const coffee = tx({ kind: 'expense', amount: 12, currency: 'EUR', fromAccount: 'clement', date: '2026-09-02' })
  assert.equal(run([line('2026-09-07', -12)], [coffee], 'clement')[0].status, NEW)
  // Un remboursement de 12 € n'est pas la dépense de 12 €.
  assert.equal(run([line('2026-09-02', 12)], [coffee], 'clement')[0].status, NEW)
  // Une dépense est exacte au centime près.
  assert.equal(run([line('2026-09-02', -12.05)], [coffee], 'clement')[0].status, NEW)
  assert.equal(run([line('2026-09-02', -12.01)], [coffee], 'clement')[0].status, EXPECTED)
})

test('deux cafés identiques le même jour, une seule dépense connue : un attendu, un nouveau', () => {
  const coffee = tx({ kind: 'expense', amount: 4.5, currency: 'EUR', fromAccount: 'clement', date: '2026-09-02' })
  const rows = run([line('2026-09-02', -4.5, 'CAFE', 'A'), line('2026-09-02', -4.5, 'CAFE', 'B')], [coffee], 'clement')
  assert.deepEqual(summarize(rows), { total: 2, fresh: 1, expected: 1, imported: 0, selected: 1 })
  // Stable d'un import à l'autre : la première ligne prend l'échéance.
  assert.equal(statusOf(rows, 'A'), EXPECTED)
  assert.equal(statusOf(rows, 'B'), NEW)
})

test('un apport perso → joint se retrouve dans LES DEUX relevés, sans être importé deux fois', () => {
  // 1 000 € partis de France, 1 960 A$ arrivés (taux et frais réels).
  const contribution = tx({ kind: 'transfer', amount: 1000, currency: 'EUR', fromAccount: 'clement', toAccount: 'joint', amountReceived: 1960, date: '2026-09-10' })
  assert.equal(run([line('2026-09-10', -1000, 'WISE')], [contribution], 'clement')[0].status, EXPECTED)
  assert.equal(run([line('2026-09-11', 1960, 'TRANSFER FROM WISE')], [contribution], 'joint')[0].status, EXPECTED)
})

test('virement sans montant reçu saisi : 3 % de tolérance côté arrivée (taux du jour, frais)', () => {
  const contribution = tx({ kind: 'transfer', amount: 1000, currency: 'EUR', fromAccount: 'clement', toAccount: 'joint', date: '2026-09-10' })
  // Attendu à 2 000 A$ au taux de l'app ; arrivé 1 955 A$ : à moins de 3 %.
  assert.equal(run([line('2026-09-11', 1955)], [contribution], 'joint')[0].status, EXPECTED)
  assert.equal(run([line('2026-09-11', 1900)], [contribution], 'joint')[0].status, NEW)
})

test('dépense saisie dans une AUTRE devise que son compte (hôtel en € payé avec le joint) : rapprochée malgré le vrai taux', () => {
  // 412 € envoyés depuis Trip Planner, payés avec la carte du joint (A$) ;
  // la banque a débité 830,40 A$ (son taux, ses frais) — pas les 824 A$ du taux de l'app.
  const hotel = tx({ kind: 'expense', amount: 412, currency: 'EUR', fromAccount: 'joint', date: '2026-10-06', source: 'trip', split: C })
  const rows = run([line('2026-10-07', -830.4, 'BOOKING.COM')], [hotel], 'joint')
  assert.equal(rows[0].status, EXPECTED, 'sinon le même paiement compterait deux fois')
  // Mais pas n'importe quel montant : au-delà de 3 %, c'est autre chose.
  assert.equal(run([line('2026-10-07', -900)], [hotel], 'joint')[0].status, NEW)
})

test('le plus proche en montant, puis en date, l’emporte', () => {
  const a = tx({ kind: 'expense', amount: 50, currency: 'EUR', fromAccount: 'clement', date: '2026-09-01' })
  const b = tx({ kind: 'expense', amount: 50, currency: 'EUR', fromAccount: 'clement', date: '2026-09-04' })
  const rows = run([line('2026-09-04', -50)], [a, b], 'clement')
  assert.equal(rows[0].match.tx, b)
})

test('une ligne nouvelle part cochée, avec le compte, un libellé lisible et la répartition par défaut', () => {
  const rows = run([line('2026-09-02', -23.9, 'CB CARREFOUR CITY 01/09')], [], 'clement')
  assert.equal(rows[0].status, NEW)
  assert.equal(rows[0].selected, true)
  assert.equal(rows[0].kind, 'expense')
  assert.equal(rows[0].amount, 23.9)
  assert.equal(rows[0].split, C, 'perso de Clément → à Clément')
  assert.equal(rows[0].externalId, `clement:${rows[0].line.externalId}`)
  assert.equal(run([line('2026-09-02', -10)], [], 'joint')[0].split, 'common', 'joint → commun')
})

test('relevé rendu du plus récent au plus ancien ; relevé vide → rien', () => {
  const rows = run([line('2026-09-01', -1), line('2026-09-03', -2), line('2026-09-02', -3)], [], 'clement')
  assert.deepEqual(rows.map((r) => r.line.date), ['2026-09-03', '2026-09-02', '2026-09-01'])
  assert.deepEqual(run([], [], 'clement'), [])
})
