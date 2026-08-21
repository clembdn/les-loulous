// FinAuzi — dates au format ISO court, en heure LOCALE.
//
// `new Date().toISOString().slice(0, 10)` renvoie la date UTC. Depuis
// l'Australie (UTC+10/+11), toute saisie faite avant 10 h du matin serait
// datée de la veille. La logique vit dans @/shared/lib/dates.js ; ce module
// n'est plus qu'un alias pour les noms historiques utilisés dans FinAuzi.
import { toDateId } from '@/shared/lib/dates.js'

export const toISODate = toDateId

export function todayISO() {
  return toDateId(new Date())
}
