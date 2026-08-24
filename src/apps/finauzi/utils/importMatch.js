// FinAuzi — rapprochement d'un relevé avec ce que l'app connaît déjà.
//
// C'est le vrai travail de l'import, et il ne dépend pas du format du
// fichier : le loyer est saisi UNE fois comme récurrence mensuelle, et le
// moteur en projette les échéances. Si l'import recréait une ligne pour le
// prélèvement de ce mois-ci, le loyer serait compté deux fois — soldes,
// budgets et équilibre du pot faux dans la foulée.
//
// Chaque ligne du relevé est donc confrontée aux échéances attendues sur ce
// compte, quelle que soit leur nature. Le rapprochement se fait sur l'IMPACT
// SIGNÉ de l'échéance sur le compte regardé (`getAccountDelta`), ce qui traite
// dépenses, revenus et virements de la même façon : un apport perso → joint
// est une sortie sur l'un et une entrée sur l'autre, et il se retrouve dans
// les deux relevés sans jamais être importé deux fois.
//
// Trois issues possibles :
//   imported  — déjà importée (même identifiant bancaire), on ne touche à rien
//   expected  — correspond à une transaction connue, à ignorer
//   new       — inconnue au bataillon, à créer

import { expandOccurrences, getAccountDelta } from './ledger.js'
import { guessCategory, prettifyLabel } from './importRules.js'
import { getDefaultSplit } from '../config/accounts.js'

export const IMPORT_STATUS = {
  IMPORTED: 'imported',
  EXPECTED: 'expected',
  NEW: 'new',
}

// Un relevé date à la comptabilisation, l'app à l'opération : deux ou trois
// jours d'écart sont la norme, surtout sur un paiement de week-end.
const DAY_TOLERANCE = 4
const DAY_MS = 86400000

// Sur un virement inter-devises, le montant crédité dépend du taux du jour et
// des frais : exiger le centime près ne rapprocherait jamais rien. Partout
// ailleurs, un relevé est exact.
function amountTolerance(tx, amount) {
  if (tx.kind === 'transfer') return Math.max(0.5, Math.abs(amount) * 0.03)
  return 0.02
}

function toDate(key) {
  const [year, month, day] = String(key).split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function daysBetween(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS
}

export function reconcileStatement(lines, { transactions, accountId, rate }) {
  if (lines.length === 0) return []

  // Ce qui a déjà été importé, par identifiant bancaire.
  const alreadyImported = new Set()
  for (const tx of transactions) {
    if (tx.externalId) alreadyImported.add(tx.externalId)
  }

  const dates = lines.map((line) => toDate(line.date))
  const from = new Date(Math.min(...dates) - DAY_TOLERANCE * DAY_MS)
  const to = new Date(Math.max(...dates) + DAY_TOLERANCE * DAY_MS)

  // Les échéances attendues sur ce compte, avec leur impact signé. Chacune
  // ne peut absorber qu'UNE ligne : deux cafés identiques le même jour ne
  // doivent pas se rapprocher tous les deux de la seule dépense connue.
  const expected = expandOccurrences(transactions, { accountId, from, to })
    .map((event) => ({
      tx: event.tx,
      date: event.date,
      delta: getAccountDelta(event.tx, accountId, rate),
      consumed: false,
    }))
    .filter((candidate) => candidate.delta !== 0)

  const defaultSplit = getDefaultSplit(accountId)

  // Du plus ancien au plus récent : à égalité, la première ligne du relevé
  // prend la première échéance, ce qui rend le résultat stable d'un import
  // à l'autre.
  const ordered = [...lines].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const rows = ordered.map((line) => {
    const kind = line.amount < 0 ? 'expense' : 'income'
    const base = {
      line,
      kind,
      // L'identifiant est préfixé par le compte : rien ne garantit que deux
      // banques ne numérotent pas leurs opérations pareil, et une collision
      // ferait passer une vraie dépense pour un doublon déjà importé.
      externalId: `${accountId}:${line.externalId}`,
      title: prettifyLabel(line.label),
      split: defaultSplit,
      amount: Math.abs(line.amount),
    }

    if (alreadyImported.has(`${accountId}:${line.externalId}`)) {
      return { ...base, status: IMPORT_STATUS.IMPORTED, match: null, selected: false }
    }

    const lineDate = toDate(line.date)
    let best = null
    for (const candidate of expected) {
      if (candidate.consumed) continue
      if (Math.sign(candidate.delta) !== Math.sign(line.amount)) continue
      const dayGap = daysBetween(candidate.date, lineDate)
      if (dayGap > DAY_TOLERANCE) continue
      const amountGap = Math.abs(Math.abs(candidate.delta) - Math.abs(line.amount))
      if (amountGap > amountTolerance(candidate.tx, line.amount)) continue
      // Le meilleur candidat est le plus proche en montant, puis en date.
      if (!best || amountGap < best.amountGap || (amountGap === best.amountGap && dayGap < best.dayGap)) {
        best = { candidate, amountGap, dayGap }
      }
    }

    if (best) {
      best.candidate.consumed = true
      return {
        ...base,
        status: IMPORT_STATUS.EXPECTED,
        match: { tx: best.candidate.tx, date: best.candidate.date, amountGap: best.amountGap },
        selected: false,
      }
    }

    return { ...base, status: IMPORT_STATUS.NEW, match: null, selected: true }
  })

  // Rendu à l'endroit d'un relevé : le plus récent en haut.
  return rows.reverse()
}

// Catégorie proposée pour chaque ligne, règles apprises comprises.
// Séparé du rapprochement : les règles changent au fil de la relecture, le
// rapprochement non.
export function suggestCategories(rows, userRules) {
  return rows.map((row) => ({
    ...row,
    category: row.category || guessCategory(row.line.label, row.kind, userRules) || null,
  }))
}

export function summarize(rows) {
  return {
    total: rows.length,
    fresh: rows.filter((r) => r.status === IMPORT_STATUS.NEW).length,
    expected: rows.filter((r) => r.status === IMPORT_STATUS.EXPECTED).length,
    imported: rows.filter((r) => r.status === IMPORT_STATUS.IMPORTED).length,
    selected: rows.filter((r) => r.selected).length,
  }
}
