// FinAuzi — qui doit quoi.
//
// Deux compteurs volontairement SÉPARÉS, parce qu'ils ne se règlent pas
// de la même façon :
//
//   1. L'ÉQUILIBRE DES APPORTS — « Lise doit encore verser 500 € au pot ».
//      Se règle en virant sur le compte joint.
//
//   2. LA BALANCE DES DETTES — « Lise doit 340 € à Clément ».
//      Se règle en virant à l'autre personne.
//
// Les fusionner en un seul chiffre donnerait un nombre juste mais
// incompréhensible, et surtout non actionnable.
//
// Hypothèse de fond : le pot est réputé financé 50/50. C'est ce qui permet
// de dire « dépense du joint + répartition commune = neutre » sans traîner
// des parts de propriété flottantes. Le déséquilibre réel de financement,
// lui, est capturé par le compteur n°1.

import { CLEMENT_UID, LISE_UID, AUTHORIZED_UIDS, getOtherUid } from '@/shared/config/people.js'
import { getAccount, getAccountCurrency, JOINT_ACCOUNT_ID, SPLIT_COMMON } from '../config/accounts.js'
import { toEUR, round2 } from './money.js'
import { getOccurrences } from './recurrence.js'
import { normalizeKind } from './ledger.js'

function emptyByPerson(value = 0) {
  return { [CLEMENT_UID]: value, [LISE_UID]: value }
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// ─── 1. Équilibre des apports ─────────────────────────────────────────────
// Ce que chacun a mis DE SA POCHE dans le pot, mesuré en € au départ du
// compte perso : c'est ce à quoi chacun a réellement renoncé. Si le taux de
// change est mauvais le jour du virement, c'est le pot qui encaisse, pas
// celui qui a viré.

export function getContributions(transactions, rate, now = new Date()) {
  const total = emptyByPerson()
  const byMonth = {}
  const entries = []

  function record(uid, amountEUR, date, tx) {
    if (!AUTHORIZED_UIDS.includes(uid)) return
    total[uid] += amountEUR
    const key = monthKey(date)
    if (!byMonth[key]) byMonth[key] = emptyByPerson()
    byMonth[key][uid] += amountEUR
    entries.push({ uid, amountEUR, date, tx })
  }

  for (const tx of transactions) {
    if (tx.isActive === false) continue
    const kind = normalizeKind(tx.kind)
    const occurrences = getOccurrences(tx, tx.date, now)
    if (occurrences.length === 0) continue

    // Virement d'un perso vers le pot — l'apport classique.
    if (kind === 'transfer' && !tx.isSettlement) {
      const from = getAccount(tx.fromAccount)
      const to = getAccount(tx.toAccount)

      if (from.kind === 'personal' && to.id === JOINT_ACCOUNT_ID) {
        const amountEUR = toEUR(tx.amount, tx.currency, rate)
        for (const date of occurrences) record(from.ownerUid, amountEUR, date, tx)
        continue
      }

      // Retrait du pot vers un perso — un apport négatif.
      if (from.id === JOINT_ACCOUNT_ID && to.kind === 'personal') {
        const received = tx.amountReceived != null ? tx.amountReceived : tx.amount
        const receivedCurrency = tx.amountReceived != null ? getAccountCurrency(to.id) : tx.currency
        const amountEUR = toEUR(received, receivedCurrency, rate)
        for (const date of occurrences) record(to.ownerUid, -amountEUR, date, tx)
        continue
      }
    }

    // Revenu tombant directement sur le pot et rattaché à quelqu'un —
    // le salaire australien versé sur le compte joint est un apport.
    if (kind === 'income' && tx.toAccount === JOINT_ACCOUNT_ID && tx.split !== SPLIT_COMMON) {
      const amountEUR = toEUR(tx.amount, tx.currency, rate)
      for (const date of occurrences) record(tx.split, amountEUR, date, tx)
    }
  }

  const gap = round2(total[CLEMENT_UID] - total[LISE_UID])

  return {
    total: { [CLEMENT_UID]: round2(total[CLEMENT_UID]), [LISE_UID]: round2(total[LISE_UID]) },
    byMonth,
    entries,
    gap,
    // Qui est en retard, et de combien il doit verser AU POT pour égaliser.
    behindUid: gap === 0 ? null : (gap > 0 ? LISE_UID : CLEMENT_UID),
    amountToEqualize: Math.abs(gap),
    isBalanced: Math.abs(gap) < 1,
  }
}

// ─── 2. Balance des dettes ────────────────────────────────────────────────
// `net[uid] > 0` ⇒ on lui doit de l'argent.
//
// Quatre situations seulement, une fois posé que le pot est 50/50 :
//
//   payé par        supporté par   effet
//   ────────────────────────────────────────────────────────────────
//   joint           commun         neutre                     (le cas normal)
//   perso de A      commun         A a avancé la moitié de B
//   joint           A              A a consommé le pot → il doit la moitié
//   perso de A      A              neutre

export function getDebtLedger(transactions, rate, now = new Date()) {
  const net = emptyByPerson()
  const reasons = []

  function move(uid, amountEUR, tx, date, label) {
    const other = getOtherUid(uid)
    if (!other) return
    net[uid] += amountEUR
    net[other] -= amountEUR
    if (Math.abs(amountEUR) >= 0.01) {
      reasons.push({ uid, amountEUR, tx, date, label })
    }
  }

  for (const tx of transactions) {
    if (tx.isActive === false) continue
    const kind = normalizeKind(tx.kind)
    const occurrences = getOccurrences(tx, tx.date, now)
    if (occurrences.length === 0) continue

    const amountEUR = toEUR(tx.amount, tx.currency, rate)
    const split = tx.split

    if (kind === 'expense') {
      const from = getAccount(tx.fromAccount)

      if (from.kind === 'personal') {
        const payer = from.ownerUid
        if (split === SPLIT_COMMON) {
          // Il a avancé pour deux : l'autre lui doit la moitié.
          for (const d of occurrences) move(payer, amountEUR / 2, tx, d, 'a avancé une dépense commune')
        } else if (split !== payer && AUTHORIZED_UIDS.includes(split)) {
          // Il a payé une dépense qui n'est pas la sienne.
          for (const d of occurrences) move(payer, amountEUR, tx, d, 'a payé pour l\'autre')
        }
        continue
      }

      if (from.id === JOINT_ACCOUNT_ID && split !== SPLIT_COMMON && AUTHORIZED_UIDS.includes(split)) {
        // Dépense perso passée sur la carte du joint : le pot a financé
        // 50/50 quelque chose qui ne profitait qu'à une personne.
        for (const d of occurrences) move(split, -amountEUR / 2, tx, d, 'a utilisé le compte joint pour du perso')
      }
      continue
    }

    if (kind === 'income') {
      const to = getAccount(tx.toAccount)
      if (to.kind !== 'personal') continue
      const receiver = to.ownerUid
      if (split === SPLIT_COMMON) {
        // Un revenu commun encaissé sur un compte perso.
        for (const d of occurrences) move(receiver, -amountEUR / 2, tx, d, 'a encaissé un revenu commun')
      } else if (split !== receiver && AUTHORIZED_UIDS.includes(split)) {
        for (const d of occurrences) move(receiver, -amountEUR, tx, d, 'a encaissé un revenu de l\'autre')
      }
      continue
    }

    // transfer
    const from = getAccount(tx.fromAccount)
    const to = getAccount(tx.toAccount)

    // Un virement d'un perso à l'autre solde toujours quelque chose.
    if (from.kind === 'personal' && to.kind === 'personal') {
      for (const d of occurrences) move(from.ownerUid, amountEUR, tx, d, 'a remboursé')
      continue
    }

    if (!tx.isSettlement) continue

    // Remboursement au pot (« je rends ce que j'ai pris sur le joint »).
    if (from.kind === 'personal' && to.id === JOINT_ACCOUNT_ID) {
      for (const d of occurrences) move(from.ownerUid, amountEUR, tx, d, 'a remboursé le compte joint')
    } else if (from.id === JOINT_ACCOUNT_ID && to.kind === 'personal') {
      for (const d of occurrences) move(to.ownerUid, -amountEUR, tx, d, 'a été remboursé par le compte joint')
    }
  }

  const clementNet = round2(net[CLEMENT_UID])
  reasons.sort((a, b) => new Date(b.date) - new Date(a.date))

  return {
    net: { [CLEMENT_UID]: clementNet, [LISE_UID]: round2(-clementNet) },
    reasons,
    // Qui doit, à qui, combien. null si tout est à zéro.
    debtorUid: Math.abs(clementNet) < 0.01 ? null : (clementNet > 0 ? LISE_UID : CLEMENT_UID),
    creditorUid: Math.abs(clementNet) < 0.01 ? null : (clementNet > 0 ? CLEMENT_UID : LISE_UID),
    amount: Math.abs(clementNet),
    isSettled: Math.abs(clementNet) < 0.01,
  }
}

// Vue d'ensemble — ce que les écrans de règlement consomment.
export function getSettlementSummary(transactions, rate, now = new Date()) {
  return {
    contributions: getContributions(transactions, rate, now),
    debts: getDebtLedger(transactions, rate, now),
  }
}
