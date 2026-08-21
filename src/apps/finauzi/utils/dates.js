// FinAuzi — dates au format ISO court, en heure LOCALE.
// La logique vit dans @/shared/lib/dates.js ; ce module n'est qu'un alias pour
// les noms historiques utilisés dans FinAuzi.
import { toLocalDateKey } from '@/shared/lib/dates.js'

export const toISODate = toLocalDateKey

export function todayISO() {
  return toLocalDateKey(new Date())
}
