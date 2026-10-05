// Libellés de Trip Planner. Module pur, testé sous `node --test`.

import { fromLocalDateKey, MONTHS, MONTHS_SHORT } from '../../../shared/lib/dates.js'

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
