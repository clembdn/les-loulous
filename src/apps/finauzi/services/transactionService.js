import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AUTHORIZED_UIDS, CLEMENT_UID } from '@/shared/config/people.js'
import { isValidCategoryId, getDefaultCategoryId } from '../config/categories.js'
import {
  JOINT_ACCOUNT_ID, SPLIT_COMMON,
  getAccount, getAccountCurrency, getPersonalAccountId,
  isValidAccountId, isValidSplit, getDefaultSplit,
} from '../config/accounts.js'
import { normalizeRecurrence } from '../utils/recurrence.js'
import { normalizeKind, TX_KINDS } from '../utils/ledger.js'
import { todayISO } from '../utils/dates.js'
import { getCachedEurToAud } from './exchangeRateService.js'

const TX_PATH = 'couples/main/transactions'

function txCollection() {
  return collection(db, TX_PATH)
}

function txDoc(id) {
  return doc(db, TX_PATH, id)
}

function resolveCategory(raw, kind) {
  if (isValidCategoryId(raw)) return raw
  return getDefaultCategoryId(kind)
}

// ─── Lecture : compatibilité ascendante ───────────────────────────────────
// Les documents écrits avant la refonte portaient { type, amountEUR, account,
// personUid } avec account ∈ {personal, common}. On les relit dans le nouveau
// modèle sans script de migration : les anciennes lignes restent justes, et
// elles se convertissent définitivement à la première modification.

function legacyPersonUid(raw) {
  if (AUTHORIZED_UIDS.includes(raw?.personUid)) return raw.personUid
  if (AUTHORIZED_UIDS.includes(raw?.createdBy)) return raw.createdBy
  return CLEMENT_UID
}

function legacyAccountId(raw) {
  if (raw?.account === 'common') return JOINT_ACCOUNT_ID
  return getPersonalAccountId(legacyPersonUid(raw)) || getPersonalAccountId(CLEMENT_UID)
}

function normalize(raw) {
  const kind = TX_KINDS.includes(raw.kind)
    ? raw.kind
    : (raw.type === 'income' ? 'income' : 'expense')

  const isLegacy = !TX_KINDS.includes(raw.kind)
  const legacyAccount = isLegacy ? legacyAccountId(raw) : null

  let fromAccount = null
  let toAccount = null
  if (kind === 'expense') {
    fromAccount = isValidAccountId(raw.fromAccount) ? raw.fromAccount : legacyAccount
  } else if (kind === 'income') {
    toAccount = isValidAccountId(raw.toAccount) ? raw.toAccount : legacyAccount
  } else {
    fromAccount = isValidAccountId(raw.fromAccount) ? raw.fromAccount : null
    toAccount = isValidAccountId(raw.toAccount) ? raw.toAccount : null
  }

  // Répartition : ce qui sortait d'un compte perso était perso, ce qui
  // sortait du compte commun était commun.
  const anchorAccount = fromAccount || toAccount
  const split = isValidSplit(raw.split)
    ? raw.split
    : (isLegacy
      ? (raw.account === 'common' ? SPLIT_COMMON : legacyPersonUid(raw))
      : getDefaultSplit(anchorAccount))

  const amount = Number(raw.amount != null ? raw.amount : raw.amountEUR) || 0
  // Les anciens montants étaient tous en euros, y compris ceux du compte
  // commun — d'où la devise figée à EUR tant que la ligne n'est pas rouverte.
  const currency = raw.currency === 'AUD' || raw.currency === 'EUR'
    ? raw.currency
    : (isLegacy ? 'EUR' : getAccountCurrency(anchorAccount))

  // Le taux qui avait cours à la saisie. Absent sur les lignes écrites avant
  // son introduction : elles retomberont sur le taux global des réglages.
  const rawRate = Number(raw.rate)
  const rate = isFinite(rawRate) && rawRate > 0 ? rawRate : null

  return {
    id: raw.id,
    kind,
    title: raw.title || '',
    amount,
    currency,
    rate,
    amountReceived: raw.amountReceived != null ? Number(raw.amountReceived) : null,
    fromAccount,
    toAccount,
    split,
    recurrence: normalizeRecurrence(raw.recurrence),
    date: raw.date,
    endDate: raw.endDate || null,
    category: resolveCategory(raw.category, kind),
    notes: raw.notes || null,
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
    isLegacy,
  }
}

export function subscribeToTransactions(callback, onError) {
  const q = query(txCollection(), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[FinAuzi] transactions error:', err)
    onError?.(err)
  })
}

// ─── Écriture ─────────────────────────────────────────────────────────────

// Construit un document propre à partir de la saisie du formulaire.
// La devise n'est jamais choisie par l'utilisateur : elle découle du compte
// qui bouge, ce qui rend impossible un solde en A$ nourri de montants en €.
function buildPayload(input) {
  const kind = normalizeKind(input.kind)

  const fromAccount = kind === 'income'
    ? null
    : (isValidAccountId(input.fromAccount) ? input.fromAccount : JOINT_ACCOUNT_ID)
  const toAccount = kind === 'expense'
    ? null
    : (isValidAccountId(input.toAccount) ? input.toAccount : JOINT_ACCOUNT_ID)

  const sourceAccount = kind === 'income' ? toAccount : fromAccount

  // La devise du compte est le défaut, pas une contrainte. Chacun détient de
  // l'argent dans les deux pays derrière un seul compte perso : Lise peut
  // alimenter le pot avec son salaire australien, en A$, depuis ce même compte.
  // Le montant est alors stocké EN A$, et toutes les conversions partent de là.
  const currency = input.currency === 'AUD' || input.currency === 'EUR'
    ? input.currency
    : getAccountCurrency(sourceAccount)

  // Sur un virement qui change de devise, le montant crédité fait foi côté
  // destination : il porte le vrai taux et les frais du transfert.
  let amountReceived = null
  if (kind === 'transfer' && toAccount && getAccountCurrency(toAccount) !== currency) {
    const received = Number(input.amountReceived)
    amountReceived = isFinite(received) && received > 0 ? Math.round(received * 100) / 100 : null
  }

  const split = isValidSplit(input.split) ? input.split : getDefaultSplit(sourceAccount)
  const recurrence = normalizeRecurrence(input.recurrence)

  // Le taux est figé à l'écriture pour que la conversion de cette ligne ne
  // bouge plus. Saisi à la main s'il est fourni, sinon le dernier taux
  // connu — jamais un appel réseau ici : une écriture doit rester instantanée,
  // y compris hors ligne.
  const explicitRate = Number(input.rate)
  const rate = isFinite(explicitRate) && explicitRate > 0
    ? Math.round(explicitRate * 1e6) / 1e6
    : getCachedEurToAud()

  return {
    kind,
    title: String(input.title || '').trim(),
    amount: Math.round((Number(input.amount) || 0) * 100) / 100,
    currency,
    rate,
    amountReceived,
    fromAccount,
    toAccount,
    split: kind === 'transfer' ? SPLIT_COMMON : split,
    recurrence,
    date: input.date,
    endDate: recurrence !== 'one-off' && input.endDate ? input.endDate : null,
    category: resolveCategory(input.category, kind),
    notes: input.notes ? String(input.notes).trim() || null : null,
    isActive: input.isActive !== false,
  }
}

export async function createTransaction(input, currentUid) {
  const now = new Date().toISOString()
  const ref = await addDoc(txCollection(), {
    ...buildPayload(input),
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  })
  return ref.id
}

export async function updateTransaction(id, input, currentUid) {
  await updateDoc(txDoc(id), {
    ...buildPayload(input),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function deleteTransaction(id) {
  await deleteDoc(txDoc(id))
}

// ─── Raccourcis de règlement ──────────────────────────────────────────────

// « Régler le solde » — un virement d'un perso à l'autre. Rien à marquer :
// tout virement entre leurs deux comptes solde le compte, par construction.
// Il part du compte français, donc en euros et sans frais.
export async function createSettlement({ fromUid, toUid, amount, currency, date, rate }, currentUid) {
  return createTransaction({
    kind: 'transfer',
    title: 'Règlement',
    amount,
    currency,
    fromAccount: getPersonalAccountId(fromUid),
    toAccount: getPersonalAccountId(toUid),
    recurrence: 'one-off',
    date: date || todayISO(),
    category: 'transfer',
    rate,
  }, currentUid)
}

// « Alimenter le pot » — un apport du perso vers le compte joint.
// `currency` dit avec quel argent : des euros de France (virement
// international, d'où `amountReceived` pour capter le vrai taux et les frais)
// ou des dollars déjà en Australie (virement domestique, rien à convertir).
export async function createContribution({ fromUid, amount, currency, amountReceived, date, rate }, currentUid) {
  return createTransaction({
    kind: 'transfer',
    title: 'Apport compte joint',
    amount,
    currency,
    amountReceived,
    fromAccount: getPersonalAccountId(fromUid),
    toAccount: JOINT_ACCOUNT_ID,
    recurrence: 'one-off',
    date: date || todayISO(),
    category: 'transfer',
    rate,
  }, currentUid)
}

export { getAccount }
