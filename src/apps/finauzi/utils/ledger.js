// FinAuzi — grand livre par compte.
//
// Trois natures de mouvement :
//   expense   — sort de `fromAccount`
//   income    — entre sur `toAccount`
//   transfer  — sort de `fromAccount`, entre sur `toAccount`, et n'est
//               JAMAIS compté comme dépense ni comme revenu. Le virement
//               mensuel vers le compte joint n'appauvrit personne, il déplace.
//
// Les montants sont stockés dans la devise du compte source. Sur un virement
// inter-devises, `amountReceived` porte le montant réellement crédité en A$ :
// c'est lui qui fait foi côté joint (il encaisse le vrai taux et les frais).

import { getAccount, getAccountCurrency, JOINT_ACCOUNT_ID, ACCOUNTS } from '../config/accounts.js'
import { convert, txRate } from './money.js'
import { getOccurrences } from './recurrence.js'

export const TX_KINDS = ['expense', 'income', 'transfer']

export function normalizeKind(kind) {
  return TX_KINDS.includes(kind) ? kind : 'expense'
}

// ─── Nature d'un virement ─────────────────────────────────────────────────
// Elle se déduit entièrement des deux comptes, sans rien à cocher :
//
//   perso → joint    un apport au pot
//   joint → perso    un retrait du pot
//   perso → perso    un règlement entre eux
//
// Voir l'en-tête de settlement.js pour pourquoi un « remboursement au pot »
// n'existe plus : c'était un apport déguisé, et le distinguer comptait deux
// fois le même euro.

export const TRANSFER_KINDS = {
  contribution: { id: 'contribution', label: 'Apport', short: 'apport', className: 'text-sky-400' },
  withdrawal: { id: 'withdrawal', label: 'Retrait', short: 'retrait', className: 'text-amber-400' },
  settlement: { id: 'settlement', label: 'Règlement', short: 'règlement', className: 'text-teal-400' },
}

export function getTransferKind(tx) {
  if (normalizeKind(tx.kind) !== 'transfer') return null
  const from = getAccount(tx.fromAccount)
  const to = getAccount(tx.toAccount)
  if (from.kind === 'personal' && to.kind === 'personal') return TRANSFER_KINDS.settlement
  if (to.id === JOINT_ACCOUNT_ID && from.kind === 'personal') return TRANSFER_KINDS.contribution
  if (from.id === JOINT_ACCOUNT_ID && to.kind === 'personal') return TRANSFER_KINDS.withdrawal
  return null
}

// Est-ce que ce mouvement touche ce compte, dans un sens ou dans l'autre ?
export function touchesAccount(tx, accountId) {
  return tx.fromAccount === accountId || tx.toAccount === accountId
}

// Impact d'UNE échéance de `tx` sur le solde de `accountId`,
// exprimé dans la devise de ce compte.
export function getAccountDelta(tx, accountId, fallbackRate) {
  const currency = getAccountCurrency(accountId)
  const kind = normalizeKind(tx.kind)
  const amount = Number(tx.amount) || 0
  const rate = txRate(tx, fallbackRate)

  if (kind === 'expense') {
    if (tx.fromAccount !== accountId) return 0
    return -convert(amount, tx.currency, currency, rate)
  }

  if (kind === 'income') {
    if (tx.toAccount !== accountId) return 0
    return convert(amount, tx.currency, currency, rate)
  }

  // transfer
  let delta = 0
  if (tx.fromAccount === accountId) {
    delta -= convert(amount, tx.currency, currency, rate)
  }
  if (tx.toAccount === accountId) {
    // Montant réellement crédité s'il est connu, sinon conversion au taux courant.
    if (tx.amountReceived != null) {
      delta += convert(Number(tx.amountReceived) || 0, getAccountCurrency(tx.toAccount), currency, rate)
    } else {
      delta += convert(amount, tx.currency, currency, rate)
    }
  }
  return delta
}

// Nombre d'échéances de `tx` déjà tombées au `atDate` inclus.
function countUpTo(tx, atDate) {
  if (!tx.date) return 0
  return getOccurrences(tx, tx.date, atDate).length
}

// Solde d'un compte à une date donnée, dans la devise du compte.
export function getAccountBalanceAt(transactions, accountId, opening, atDate, rate) {
  let balance = Number(opening) || 0
  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (!touchesAccount(tx, accountId)) continue
    const delta = getAccountDelta(tx, accountId, rate)
    if (delta === 0) continue
    balance += delta * countUpTo(tx, atDate)
  }
  return balance
}

// Solde de tous les comptes d'un coup — chacun dans sa propre devise.
// Retourne { [accountId]: number }.
export function getAllBalances(transactions, openings, rate, atDate = new Date()) {
  const result = {}
  for (const account of ACCOUNTS) {
    result[account.id] = getAccountBalanceAt(
      transactions,
      account.id,
      openings?.[account.id] || 0,
      atDate,
      rate,
    )
  }
  return result
}

// Patrimoine consolidé, en EUR — la seule vraie façon d'additionner
// un compte en A$ et deux comptes en €.
export function getNetWorthEUR(balances, rate) {
  let total = 0
  for (const account of ACCOUNTS) {
    total += convert(balances[account.id] || 0, account.currency, 'EUR', rate)
  }
  return total
}

// ─── Agrégats sur une période ─────────────────────────────────────────────
// Un virement n'est ni un revenu ni une dépense POUR LE COUPLE — déplacer
// 2 000 € de son perso vers le joint n'appauvrit personne. Mais POUR UN COMPTE
// pris isolément, c'en est un : le compte joint n'a aucun revenu propre, il ne
// vit que des virements reçus. Afficher 0 € de revenus sur le joint alors qu'il
// est alimenté tous les mois n'apprenait rien à personne.
//
// D'où deux jeux de chiffres dans le même résumé :
//   income / expenses          les vrais revenus et dépenses, virements exclus
//   inflow / outflow           tout ce qui entre et sort du compte regardé
//   net                        inflow − outflow, donc la variation du solde
//
// En vue consolidée (`accountId` nul), les virements sont neutralisés et
// inflow/outflow retombent exactement sur income/expenses.

export function summarizePeriod(transactions, { accountId = null, from, to, rate }) {
  let income = 0
  let expenses = 0
  let transfersIn = 0
  let transfersOut = 0

  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (accountId && !touchesAccount(tx, accountId)) continue

    const count = getOccurrences(tx, from, to).length
    if (count === 0) continue

    const kind = normalizeKind(tx.kind)
    const targetCurrency = accountId ? getAccountCurrency(accountId) : 'EUR'

    if (kind === 'transfer') {
      // Hors vue d'un compte, un virement interne ne bouge rien.
      if (!accountId) continue
      // `getAccountDelta` gère déjà le sens, la devise et le montant
      // réellement crédité quand le virement change de monnaie.
      const delta = getAccountDelta(tx, accountId, rate) * count
      if (delta >= 0) transfersIn += delta
      else transfersOut += -delta
      continue
    }

    if (accountId) {
      if (kind === 'expense' && tx.fromAccount !== accountId) continue
      if (kind === 'income' && tx.toAccount !== accountId) continue
    }

    const amount = convert(Number(tx.amount) || 0, tx.currency, targetCurrency, txRate(tx, rate)) * count
    if (kind === 'income') income += amount
    else expenses += amount
  }

  const inflow = income + transfersIn
  const outflow = expenses + transfersOut

  return {
    income,
    expenses,
    transfersIn,
    transfersOut,
    inflow,
    outflow,
    net: inflow - outflow,
  }
}

// Dépenses par catégorie sur une période. Les virements sont ignorés.
export function getSpendingByCategory(transactions, { accountId = null, from, to, rate, currency = 'EUR' }) {
  const byCategory = {}
  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (normalizeKind(tx.kind) !== 'expense') continue
    if (accountId && tx.fromAccount !== accountId) continue

    const count = getOccurrences(tx, from, to).length
    if (count === 0) continue

    const amount = convert(Number(tx.amount) || 0, tx.currency, currency, txRate(tx, rate)) * count
    const categoryId = tx.category || 'other-expense'
    byCategory[categoryId] = (byCategory[categoryId] || 0) + amount
  }
  return byCategory
}

// Dépenses par répartition (commun / Clément / Lise) — répond à
// « où part l'argent, et pour qui ? ».
export function getSpendingBySplit(transactions, { from, to, rate, currency = 'EUR' }) {
  const bySplit = {}
  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (normalizeKind(tx.kind) !== 'expense') continue

    const count = getOccurrences(tx, from, to).length
    if (count === 0) continue

    const amount = convert(Number(tx.amount) || 0, tx.currency, currency, txRate(tx, rate)) * count
    bySplit[tx.split] = (bySplit[tx.split] || 0) + amount
  }
  return bySplit
}

// Toutes les échéances d'une période, à plat et triées — sert à afficher
// « ce qui tombe ce mois-ci » et à construire les projections.
export function expandOccurrences(transactions, { accountId = null, from, to }) {
  const events = []
  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (accountId && !touchesAccount(tx, accountId)) continue
    for (const date of getOccurrences(tx, from, to)) {
      events.push({ tx, date, timestamp: date.getTime() })
    }
  }
  events.sort((a, b) => a.timestamp - b.timestamp)
  return events
}
