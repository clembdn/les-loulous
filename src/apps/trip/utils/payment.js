// Qui paie une réservation, et où en est le paiement.
//
// Le payeur est l'un des deux (son uid, comme `createdBy`), le compte commun,
// ou un compagnon du voyage, désigné par son nom (`trip.companions`) : il n'a
// pas de compte, son nom suffit. Le prix reste dans sa devise, jamais
// converti (cf. totalsByCurrency).
//
// Imports RELATIFS (pas d'alias `@/`) : ce module est testé sous `node --test`.

import { CLEMENT_UID, LISE_UID } from '../../../shared/config/people.js'
import { formatDateFr } from '../../../shared/lib/dates.js'
import { dateKey, money, optText, text } from './fields.js'
import { formatPrice, totalsByCurrency } from './format.js'

export const JOINT = 'joint'
export const MAX_COMPANIONS = 8

const BASE_PAYERS = [
  { id: CLEMENT_UID, label: 'Clément' },
  { id: LISE_UID, label: 'Lise' },
]
const JOINT_PAYER = { id: JOINT, label: 'Compte commun' }

//   paid    — tout est réglé
//   deposit — un acompte est versé, le reste se paie sur place
//   onsite  — rien n'est versé, tout se paie sur place
//   due     — à payer avant une date (`dueDate`)
export const PAYMENT_STATUSES = [
  { id: 'paid', label: 'Payé' },
  { id: 'deposit', label: 'Acompte versé' },
  { id: 'onsite', label: 'Sur place' },
  { id: 'due', label: 'À payer avant…' },
]
const STATUS_IDS = PAYMENT_STATUSES.map((s) => s.id)

/**
 * Les compagnons d'un voyage : des prénoms, sans doublon ni vide. Clément et
 * Lise en sont toujours, inutile de les y écrire.
 */
export function normalizeCompanions(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const seen = new Set([...BASE_PAYERS, JOINT_PAYER].flatMap((p) => [p.id.toLowerCase(), p.label.toLowerCase()]))
  const out = []
  for (const value of list) {
    const name = text(value, 40)
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out.slice(0, MAX_COMPANIONS)
}

/**
 * Les champs de paiement d'une réservation, à la lecture comme à l'écriture.
 * L'acompte n'a de sens qu'avec « acompte versé », l'échéance qu'avec « à
 * payer avant » : changer d'état efface l'autre.
 */
export function paymentFields(raw) {
  const status = STATUS_IDS.includes(raw?.paymentStatus) ? raw.paymentStatus : null
  return {
    paidBy: optText(raw?.paidBy, 40),
    paymentStatus: status,
    deposit: status === 'deposit' ? money(raw?.deposit) : null,
    dueDate: status === 'due' ? dateKey(raw?.dueDate) || null : null,
  }
}

/** Le nom à afficher d'un payeur (uid, `joint` ou nom d'un compagnon). */
export function payerLabel(id) {
  if (!id) return null
  return [...BASE_PAYERS, JOINT_PAYER].find((p) => p.id === id)?.label || id
}

/**
 * Qui peut payer : les deux, les compagnons du voyage et les invités d'un
 * lien de partage (par leur nom), le compte commun. Un payeur déjà choisi
 * reste proposé même s'il a quitté ces listes.
 */
export function payerOptions(companions = [], current = null, guests = []) {
  const others = normalizeCompanions([...companions, ...guests])
  const options = [...BASE_PAYERS, ...others.map((name) => ({ id: name, label: name })), JOINT_PAYER]
  if (current && !options.some((o) => o.id === current)) options.splice(-1, 0, { id: current, label: current })
  return options
}

/** Ce qui reste à payer (`null` sans prix) : tout, sauf l'acompte versé. */
export function amountLeft(item) {
  if (!Number.isFinite(item.price)) return null
  if (item.paymentStatus === 'paid') return 0
  if (item.paymentStatus === 'deposit') return Math.max(0, Math.round((item.price - (item.deposit || 0)) * 100) / 100)
  return item.price
}

/**
 * L'état en une ligne, pour la liste et la fiche : « Payé par Lise »,
 * « Acompte de 11 600 F versé par Laure · reste 11 600 F sur place »,
 * « À payer sur place par Laure », « À payer avant le 3 décembre ».
 * `null` quand on ne sait rien.
 */
export function paymentLine(item) {
  const by = payerLabel(item.paidBy)
  const left = amountLeft(item)
  switch (item.paymentStatus) {
    case 'paid':
      return by ? `Payé par ${by}` : 'Payé'
    case 'deposit': {
      const deposit = item.deposit != null ? `Acompte de ${formatPrice(item.deposit, item.currency)} versé` : 'Acompte versé'
      const rest = left != null ? ` · reste ${formatPrice(left, item.currency)} sur place` : ' · le reste sur place'
      return `${deposit}${by ? ` par ${by}` : ''}${rest}`
    }
    case 'onsite':
      return `À payer sur place${by ? ` par ${by}` : ''}`
    case 'due':
      return `À payer${item.dueDate ? ` avant le ${formatDateFr(item.dueDate)}` : ''}${by ? ` par ${by}` : ''}`
    default:
      return by ? `Payeur : ${by}` : null
  }
}

/** L'état en un mot, pour l'étiquette de la liste. */
export function paymentTag(item) {
  switch (item.paymentStatus) {
    case 'paid': return { tone: 'ok', label: 'Payé' }
    case 'deposit': return { tone: 'todo', label: 'Acompte' }
    case 'onsite': return { tone: 'todo', label: 'Sur place' }
    case 'due': return { tone: 'todo', label: item.dueDate ? `Avant le ${formatDateFr(item.dueDate)}` : 'À payer' }
    default: return null
  }
}

/**
 * Le bilan des paiements d'un voyage. `entries` : `[{ kind, item }]`.
 *   paid    — par payeur, ce qu'il a déjà versé (prix réglé ou acompte), par devise
 *   onsite  — ce qui reste à payer sur place, par devise
 *   due     — les échéances, de la plus proche à la plus lointaine
 *   unknown — les réservations avec un prix mais sans état de paiement
 */
export function paymentSummary(entries) {
  const paidBy = new Map()
  const onsite = []
  const due = []
  let unknown = 0
  for (const entry of entries) {
    const { item } = entry
    const status = item.paymentStatus
    if (!status) {
      if (Number.isFinite(item.price)) unknown++
      continue
    }
    const versed = status === 'paid' ? item.price : status === 'deposit' ? item.deposit : null
    if (Number.isFinite(versed) && versed > 0) {
      const key = item.paidBy || ''
      if (!paidBy.has(key)) paidBy.set(key, [])
      paidBy.get(key).push({ price: versed, currency: item.currency })
    }
    const left = amountLeft(item)
    if (status === 'due') due.push({ ...entry, amount: left, currency: item.currency, dueDate: item.dueDate })
    else if (left) onsite.push({ price: left, currency: item.currency })
  }
  return {
    paid: [...paidBy].map(([payer, items]) => ({ payer: payer || null, label: payerLabel(payer), totals: totalsByCurrency(items) })),
    onsite: totalsByCurrency(onsite),
    due: due.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    unknown,
  }
}
