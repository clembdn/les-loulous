// « Envoyer à FinAuzi » : le prix d'une réservation devient une dépense du
// foyer. Ce module décide quoi proposer ; l'écriture est dans
// services/expenseService.js.
//
// Imports RELATIFS (pas d'alias `@/`) : ce module est testé sous `node --test`.

// FinAuzi ne tient ses comptes qu'en euros et en dollars australiens.
export const FINAUZI_CURRENCIES = ['EUR', 'AUD']
// La catégorie FinAuzi « Voyage ».
export const EXPENSE_CATEGORY = 'travel'
// Autour de la date du paiement, où chercher la ligne d'un relevé importé
// (un relevé date à la comptabilisation : quelques jours d'écart).
export const LINK_WINDOW_DAYS = 10

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

/**
 * Le lien d'une réservation vers sa dépense, tel qu'on le relit ; `null` sans lien.
 *   txId     — la transaction FinAuzi
 *   created  — créée depuis Trip (sinon rattachée : une ligne d'un relevé)
 *   amount, currency, date — ce qui a été envoyé, pour l'afficher hors-ligne
 *   basisPrice, basisCurrency — le prix de la réservation à l'envoi : s'il
 *     change, on propose de mettre la dépense à jour
 */
export function normalizeExpenseLink(raw) {
  if (!raw || typeof raw.txId !== 'string' || !raw.txId || raw.txId.length > 64) return null
  return {
    txId: raw.txId,
    created: raw.created === true,
    amount: Number.isFinite(raw.amount) ? raw.amount : null,
    currency: FINAUZI_CURRENCIES.includes(raw.currency) ? raw.currency : null,
    date: DATE_RE.test(raw.date) ? raw.date : null,
    basisPrice: Number.isFinite(raw.basisPrice) ? raw.basisPrice : null,
    basisCurrency: typeof raw.basisCurrency === 'string' ? raw.basisCurrency : null,
  }
}

/** Le titre de la dépense : ce qu'on a réservé, et pour quel voyage. */
export function expenseTitle(kind, item, tripTitle, transportLabel = '') {
  const what = kind === 'stay'
    ? item.name
    : [transportLabel, item.ref, [item.from?.name, item.to?.name].filter(Boolean).join(' → ')].filter(Boolean).join(' ')
  return [what || 'Réservation', tripTitle].filter(Boolean).join(' · ').slice(0, 120)
}

/**
 * Le montant à proposer : le prix de la réservation s'il est en euros ou en
 * dollars australiens. Dans une autre devise, FinAuzi ne saurait pas quoi en
 * faire : on demandera le montant réellement débité (`charged`).
 */
export function expenseDefaults(item) {
  const supported = FINAUZI_CURRENCIES.includes(item.currency)
  return {
    amount: supported && item.price != null ? item.price : null,
    currency: supported ? item.currency : null,
    charged: item.price != null && !supported,
  }
}

/**
 * Où en est le lien : `none` (pas envoyée), `loading` (la dépense n'est pas
 * encore lue), `missing` (supprimée dans FinAuzi), `outdated` (le prix de la
 * réservation a changé depuis l'envoi), `ok`.
 * `tx` : la transaction lue (`undefined` tant qu'on ne sait pas, `null` si absente).
 */
export function linkStatus(link, item, tx) {
  if (!link) return 'none'
  if (tx === undefined) return 'loading'
  if (tx === null) return 'missing'
  const samePrice = link.basisPrice === (item.price ?? null) && (link.basisCurrency || null) === (item.currency || null)
  return samePrice ? 'ok' : 'outdated'
}

function dayDiff(a, b) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS
}

/** Les bornes de la recherche autour d'une date. */
export function linkWindow(date) {
  const at = Date.parse(`${date}T00:00:00Z`)
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
  return { from: iso(at - LINK_WINDOW_DAYS * DAY_MS), to: iso(at + LINK_WINDOW_DAYS * DAY_MS) }
}

/**
 * Les dépenses FinAuzi auxquelles rattacher le paiement : ponctuelles,
 * actives, pas déjà liées à une autre réservation (`taken`), à moins de
 * LINK_WINDOW_DAYS jours. Les plus probables d'abord : même montant (à 3 %
 * près, la banque arrondit et le change bouge), puis la plus proche en date.
 */
export function rankCandidates(txs, { amount, currency, date }, taken = new Set(), max = 8) {
  const close = (tx) => amount != null && tx.currency === currency && Math.abs(tx.amount - amount) <= Math.max(0.5, amount * 0.03)
  return txs
    .filter((tx) => tx.kind === 'expense' && tx.recurrence === 'one-off' && tx.isActive !== false && !taken.has(tx.id))
    .filter((tx) => tx.date && dayDiff(tx.date, date) <= LINK_WINDOW_DAYS)
    .map((tx) => ({ tx, match: close(tx), days: dayDiff(tx.date, date) }))
    .sort((a, b) => (Number(b.match) - Number(a.match)) || (a.days - b.days))
    .slice(0, max)
}
