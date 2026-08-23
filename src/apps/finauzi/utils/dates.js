// FinAuzi — la date du jour en heure LOCALE.
// Indispensable depuis l'Australie (UTC+10) : `toISOString()` daterait de la
// veille toute saisie faite avant 10 h du matin.
import { toLocalDateKey } from '@/shared/lib/dates.js'

export function todayISO() {
  return toLocalDateKey(new Date())
}
