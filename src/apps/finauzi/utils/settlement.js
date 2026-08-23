// FinAuzi — un seul chiffre : qui doit combien à qui.
//
// Tout se ramène à une seule question : sur la durée, chacun doit avoir sorti
// de sa poche exactement la moitié de ce que le couple a dépensé en commun.
// Trois choses font bouger ce solde, toutes converties en euros :
//
//   1. LES APPORTS AU POT — ce que chacun vire sur le compte joint, moins ce
//      qu'il en retire. Le pot étant réputé financé 50/50, mettre 400 € de
//      plus que l'autre donne droit à 200 € : l'écart se partage en deux.
//
//   2. LES AVANCES — une dépense commune payée d'un compte perso, une dépense
//      perso passée sur la carte du joint, un revenu commun encaissé en perso.
//      Chaque cas est déjà exprimé en « ce que l'autre doit », donc SANS
//      division supplémentaire. La différence de traitement avec les apports
//      est volontaire : un écart d'apports est la différence de deux totaux,
//      une avance est déjà un déséquilibre.
//
//   3. LES RÈGLEMENTS — les virements d'un perso à l'autre. Ils remboursent
//      tout ça d'un coup, de compte français à compte français, sans frais.
//
//   solde(A) = écart d'apports / 2 + avances(A) − règlements reçus par A
//
// Un solde positif pour A signifie que B lui doit de l'argent.
//
// Deux conséquences importantes de ce modèle unifié :
//
//   • Un virement perso → joint est TOUJOURS un apport, jamais un
//     « remboursement au pot ». Les traiter à part revenait à compter deux
//     fois : une dépense perso de 200 passée sur le joint coûte 100 à l'autre
//     (le pot est 50/50), et rembourser 200 au pot rend exactement ces 100 via
//     l'écart d'apports. L'ancien flag « c'est un remboursement » fabriquait
//     un écart fantôme de 100 € à chaque aller-retour.
//
//   • Un virement perso → perso solde toujours le compte, quel qu'en soit le
//     motif. De l'argent qui passe de l'un à l'autre change forcément qui est
//     en avance — il n'y a rien à cocher.

import { CLEMENT_UID, LISE_UID, AUTHORIZED_UIDS, getOtherUid } from '@/shared/config/people.js'
import { getAccount, getAccountCurrency, JOINT_ACCOUNT_ID, SPLIT_COMMON } from '../config/accounts.js'
import { toEUR, round2, txRate } from './money.js'
import { getOccurrences } from './recurrence.js'
import { normalizeKind } from './ledger.js'

function emptyByPerson(value = 0) {
  return { [CLEMENT_UID]: value, [LISE_UID]: value }
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// ─── 1. Les apports au pot ────────────────────────────────────────────────
// Ce que chacun a mis DE SA POCHE dans le pot, mesuré en € au départ du
// compte perso : c'est ce à quoi il a réellement renoncé. Si le taux de change
// est mauvais le jour du virement, c'est le pot qui encaisse la perte, pas
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

    const lineRate = txRate(tx, rate)

    if (kind === 'transfer') {
      const from = getAccount(tx.fromAccount)
      const to = getAccount(tx.toAccount)

      // Vers le pot : un apport, sans exception.
      if (from.kind === 'personal' && to.id === JOINT_ACCOUNT_ID) {
        const amountEUR = toEUR(tx.amount, tx.currency, lineRate)
        for (const date of occurrences) record(from.ownerUid, amountEUR, date, tx)
        continue
      }

      // Depuis le pot : un apport négatif, mesuré sur ce qui a vraiment
      // atterri sur le compte perso.
      if (from.id === JOINT_ACCOUNT_ID && to.kind === 'personal') {
        const received = tx.amountReceived != null ? tx.amountReceived : tx.amount
        const receivedCurrency = tx.amountReceived != null ? getAccountCurrency(to.id) : tx.currency
        const amountEUR = toEUR(received, receivedCurrency, lineRate)
        for (const date of occurrences) record(to.ownerUid, -amountEUR, date, tx)
        continue
      }

      // Perso → perso : c'est un règlement, compté ailleurs.
      continue
    }

    // Un revenu qui tombe directement sur le pot en étant rattaché à
    // quelqu'un — le salaire australien versé sur le joint est un apport.
    if (kind === 'income' && tx.toAccount === JOINT_ACCOUNT_ID && tx.split !== SPLIT_COMMON) {
      const amountEUR = toEUR(tx.amount, tx.currency, lineRate)
      for (const date of occurrences) record(tx.split, amountEUR, date, tx)
    }
  }

  const gap = round2(total[CLEMENT_UID] - total[LISE_UID])

  return {
    total: { [CLEMENT_UID]: round2(total[CLEMENT_UID]), [LISE_UID]: round2(total[LISE_UID]) },
    byMonth,
    entries,
    gap,
    aheadUid: gap === 0 ? null : (gap > 0 ? CLEMENT_UID : LISE_UID),
    behindUid: gap === 0 ? null : (gap > 0 ? LISE_UID : CLEMENT_UID),
    // Ce qu'il faudrait verser AU POT pour égaliser les apports — utile quand
    // le pot a besoin d'argent, mais ce n'est PAS le montant à se virer entre
    // eux : ça, c'est `getBalanceSummary`.
    amountToEqualize: round2(Math.abs(gap)),
    isBalanced: Math.abs(gap) < 1,
    // Ce que l'écart d'apports pèse dans le solde global : la moitié.
    credit: { [CLEMENT_UID]: round2(gap / 2), [LISE_UID]: round2(-gap / 2) },
  }
}

// ─── 2. Les avances ───────────────────────────────────────────────────────
// `net[uid] > 0` ⇒ on lui doit de l'argent.
//
// Une fois posé que le pot est 50/50, il ne reste que quatre situations :
//
//   payé par        supporté par   effet
//   ────────────────────────────────────────────────────────────────
//   joint           commun         neutre                    (le cas normal)
//   perso de A      commun         A a avancé la moitié de B
//   joint           A              A a consommé le pot → il doit la moitié
//   perso de A      A              neutre

export function getAdvances(transactions, rate, now = new Date()) {
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
    // Un virement ne crée jamais d'avance : il est soit un apport, soit un
    // règlement, et les deux sont comptés ailleurs.
    if (kind === 'transfer') continue

    const occurrences = getOccurrences(tx, tx.date, now)
    if (occurrences.length === 0) continue

    const amountEUR = toEUR(tx.amount, tx.currency, txRate(tx, rate))
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

    // income
    const to = getAccount(tx.toAccount)
    if (to.kind !== 'personal') continue
    const receiver = to.ownerUid
    if (split === SPLIT_COMMON) {
      // Un revenu commun encaissé sur un compte perso.
      for (const d of occurrences) move(receiver, -amountEUR / 2, tx, d, 'a encaissé un revenu commun')
    } else if (split !== receiver && AUTHORIZED_UIDS.includes(split)) {
      for (const d of occurrences) move(receiver, -amountEUR, tx, d, 'a encaissé un revenu de l\'autre')
    }
  }

  reasons.sort((a, b) => b.date - a.date)

  return {
    net: { [CLEMENT_UID]: round2(net[CLEMENT_UID]), [LISE_UID]: round2(net[LISE_UID]) },
    reasons,
  }
}

// ─── 3. Les règlements ────────────────────────────────────────────────────
// Un virement d'un perso à l'autre, quel qu'en soit le motif. Celui qui envoie
// reprend l'avantage à hauteur du montant viré.

export function getSettlements(transactions, rate, now = new Date()) {
  const net = emptyByPerson()
  const entries = []

  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (normalizeKind(tx.kind) !== 'transfer') continue

    const from = getAccount(tx.fromAccount)
    const to = getAccount(tx.toAccount)
    if (from.kind !== 'personal' || to.kind !== 'personal') continue
    if (!from.ownerUid || !to.ownerUid || from.ownerUid === to.ownerUid) continue

    const occurrences = getOccurrences(tx, tx.date, now)
    if (occurrences.length === 0) continue

    // Quand les devises diffèrent, ce que le destinataire a reçu fait foi :
    // c'est ce qui a réellement effacé de la dette.
    const received = tx.amountReceived != null ? tx.amountReceived : tx.amount
    const receivedCurrency = tx.amountReceived != null ? getAccountCurrency(to.id) : tx.currency
    const amountEUR = toEUR(received, receivedCurrency, txRate(tx, rate))

    for (const date of occurrences) {
      net[from.ownerUid] += amountEUR
      net[to.ownerUid] -= amountEUR
      entries.push({ fromUid: from.ownerUid, toUid: to.ownerUid, amountEUR, date, tx })
    }
  }

  entries.sort((a, b) => b.date - a.date)

  return {
    net: { [CLEMENT_UID]: round2(net[CLEMENT_UID]), [LISE_UID]: round2(net[LISE_UID]) },
    entries,
  }
}

// ─── Le solde global ──────────────────────────────────────────────────────
// Le seul chiffre à regarder pour savoir quoi virer à qui, et le seul qui
// propose une action. Les trois composantes restent exposées pour expliquer
// d'où il sort, pas pour être réglées séparément : les solder une par une
// ferait faire deux virements là où un seul suffit.

export function getBalanceSummary(transactions, rate, now = new Date()) {
  const contributions = getContributions(transactions, rate, now)
  const advances = getAdvances(transactions, rate, now)
  const settlements = getSettlements(transactions, rate, now)

  const net = {}
  for (const uid of AUTHORIZED_UIDS) {
    net[uid] = round2(
      contributions.credit[uid] + advances.net[uid] + settlements.net[uid],
    )
  }

  const clementNet = net[CLEMENT_UID]
  const amount = Math.abs(clementNet)
  // Sous un centime, c'est du bruit d'arrondi, pas une dette.
  const isSettled = amount < 0.01

  return {
    contributions,
    advances,
    settlements,
    net,
    debtorUid: isSettled ? null : (clementNet > 0 ? LISE_UID : CLEMENT_UID),
    creditorUid: isSettled ? null : (clementNet > 0 ? CLEMENT_UID : LISE_UID),
    amount: round2(amount),
    isSettled,
    // Les trois lignes du détail, vues du côté de chacun.
    parts: {
      contributions: contributions.credit,
      advances: advances.net,
      settlements: settlements.net,
    },
  }
}
