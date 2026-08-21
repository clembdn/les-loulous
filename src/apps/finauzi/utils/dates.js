// FinAuzi — dates au format ISO court, en heure LOCALE.
//
// `new Date().toISOString().slice(0, 10)` renvoie la date UTC. Depuis
// l'Australie (UTC+10/+11), toute saisie faite avant 10 h du matin serait
// datée de la veille. Ce module ne sort que des dates locales.

export function toISODate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO() {
  return toISODate(new Date())
}
