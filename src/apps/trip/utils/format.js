// Libellés de Trip Planner. Module pur, testé sous `node --test`.

import { DAY_SHORT, fromLocalDateKey, MONTHS, MONTHS_SHORT } from '../../../shared/lib/dates.js'

export function plural(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${n > 1 ? pluralForm : singular}`
}

/**
 * « 12 → 17 mai 2027 », « 28 avr → 3 mai 2027 », « 28 déc 2026 → 3 jan 2027 » :
 * on ne répète que ce qui change.
 */
export function formatTripRange(startDate, endDate) {
  const a = fromLocalDateKey(startDate)
  const b = fromLocalDateKey(endDate)
  const year = b.getFullYear()
  if (startDate === endDate) return `${a.getDate()} ${MONTHS[a.getMonth()]} ${year}`
  if (a.getFullYear() !== year) {
    return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} ${a.getFullYear()} → ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${year}`
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} → ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${year}`
  }
  return `${a.getDate()} → ${b.getDate()} ${MONTHS[b.getMonth()]} ${year}`
}

/** Où en est le voyage, en une ligne (cf. `tripProgress`). */
export function formatProgress(progress, endDate) {
  if (progress.status === 'ongoing') return `Jour ${progress.dayNumber} sur ${progress.length}`
  if (progress.status === 'upcoming') {
    const n = progress.daysUntil
    if (n === 1) return 'Demain'
    if (n < 100) return `Dans ${n} jours`
    return `Dans ${Math.round(n / 30.4)} mois`
  }
  const n = progress.daysSince
  if (n === 1) return 'Rentrés hier'
  if (n < 60) return `Rentrés il y a ${n} jours`
  const end = fromLocalDateKey(endDate)
  const month = MONTHS[end.getMonth()]
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${end.getFullYear()}`
}

/** Une pastille de jour : `{ dow: 'Mer', day: 14, month: 'mai' }`. */
export function dayChip(date) {
  const d = fromLocalDateKey(date)
  return { dow: DAY_SHORT[d.getDay()], day: d.getDate(), month: MONTHS_SHORT[d.getMonth()] }
}

/** « 45 min », « 1 h », « 1 h 30 ». */
export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** « maintenant », « dans 12 min », « dans 1 h 20 » — avant le prochain élément de la journée. */
export function formatUntil(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'maintenant'
  return `dans ${formatDuration(minutes)}`
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * L'heure de la dernière synchro, au plus court : « 14:32 » aujourd'hui,
 * « hier 14:32 », puis « 12 mai ». Jours comparés en heure LOCALE.
 */
export function formatSyncTime(at, now = new Date()) {
  const d = new Date(at)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((today - day) / 86400000)
  if (days <= 0) return hhmm(d)
  if (days === 1) return `hier ${hhmm(d)}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/**
 * Un prix dans SA devise — jamais converti, comme dans FinAuzi. Les centimes
 * n'apparaissent que s'il y en a : « 284 € », « 162,50 € ».
 */
export function formatPrice(amount, currency) {
  if (!Number.isFinite(amount)) return ''
  const digits = Number.isInteger(amount) ? 0 : 2
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount)
  } catch {
    return `${amount} ${currency || ''}`.trim()
  }
}

/**
 * Totaux par devise, du plus gros au plus petit. On n'additionne jamais deux
 * devises : un taux de change choisi ici serait faux le jour du paiement.
 */
export function totalsByCurrency(reservations) {
  const totals = new Map()
  for (const r of reservations) {
    if (!Number.isFinite(r.price)) continue
    const currency = r.currency || 'EUR'
    totals.set(currency, Math.round(((totals.get(currency) || 0) + r.price) * 100) / 100)
  }
  return [...totals].map(([currency, total]) => ({ currency, total })).sort((a, b) => b.total - a.total)
}

/** « 12 → 14 mai », « 28 avr → 3 mai » : une plage courte, sans l'année. */
export function formatShortRange(startDate, endDate) {
  const a = fromLocalDateKey(startDate)
  const b = fromLocalDateKey(endDate)
  if (startDate === endDate) return `${a.getDate()} ${MONTHS[a.getMonth()]}`
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} → ${b.getDate()} ${MONTHS[b.getMonth()]}`
  }
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} → ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`
}
