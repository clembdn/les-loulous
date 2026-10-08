import { updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import {
  deleteTransaction, findTransactionsBetween, newTransactionDocument, newTransactionRef,
  subscribeToTransaction, updateTransaction,
} from '@/apps/finauzi/services/transactionService.js'
import { EXPENSE_CATEGORY } from '../utils/expense.js'
import { partDoc } from './refs.js'

// « Envoyer à FinAuzi » : la dépense est une transaction de FinAuzi, écrite
// par ses propres services (mêmes règles, même normalisation qu'une saisie
// dans FinAuzi) ; la réservation garde un lien vers elle (`expense`).
//
// Rien n'est attendu : hors-ligne, tout part au retour du réseau.

const PART = { stay: 'stays', transport: 'transports' }

export { subscribeToTransaction, findTransactionsBetween }

function linkOf(item, tx, created) {
  return {
    txId: tx.id,
    created,
    amount: tx.amount,
    currency: tx.currency,
    date: tx.date,
    // Le prix de la réservation à cet instant : s'il change, on proposera la mise à jour.
    basisPrice: item.price ?? null,
    basisCurrency: item.currency || null,
  }
}

function setLink(batch, kind, tripId, item, link, currentUid) {
  batch.update(partDoc(tripId, PART[kind], item.id), {
    expense: link,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

/**
 * Crée la dépense et le lien, dans UN lot : l'un sans l'autre laisserait
 * une dépense orpheline, ou un lien vers rien. `expense` :
 * `{ title, amount, currency, fromAccount, split, date }`. Rend `{ txId, done }`.
 */
export function sendExpense(kind, tripId, item, expense, currentUid) {
  const ref = newTransactionRef()
  const input = {
    kind: 'expense',
    title: expense.title,
    amount: expense.amount,
    currency: expense.currency,
    fromAccount: expense.fromAccount,
    split: expense.split,
    recurrence: 'one-off',
    date: expense.date,
    category: EXPENSE_CATEGORY,
    source: 'trip',
  }
  const batch = writeBatch(db)
  batch.set(ref, newTransactionDocument(input, currentUid))
  setLink(batch, kind, tripId, item, linkOf(item, { id: ref.id, ...input }, true), currentUid)
  return { txId: ref.id, done: batch.commit() }
}

/**
 * Rattache la réservation à une dépense déjà dans FinAuzi (une ligne de
 * relevé importée : `created` faux, on ne la supprimera jamais d'ici).
 */
export function linkExpense(kind, tripId, item, tx, currentUid, created = false) {
  const batch = writeBatch(db)
  setLink(batch, kind, tripId, item, linkOf(item, tx, created), currentUid)
  return batch.commit()
}

/** Oublie le lien ; la dépense reste dans FinAuzi. */
export function unlinkExpense(kind, tripId, item, currentUid) {
  return updateDoc(partDoc(tripId, PART[kind], item.id), {
    expense: null,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

/**
 * Met la dépense à jour (le prix de la réservation a changé) : la
 * transaction telle que FinAuzi la connaît, avec les champs de `patch`, et le
 * lien qui note le nouveau prix de référence.
 */
export function updateSentExpense(kind, tripId, item, tx, patch, currentUid) {
  const next = { ...tx, ...patch }
  return Promise.all([
    updateTransaction(tx.id, next, currentUid),
    linkExpense(kind, tripId, item, { ...next, id: tx.id }, currentUid, !!item.expense?.created),
  ])
}

/** Supprime la dépense dans FinAuzi (celle qu'on y avait créée). */
export function deleteSentExpense(txId) {
  return deleteTransaction(txId)
}
