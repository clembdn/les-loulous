// Helpers de date partagés par les apps (semaine ISO, parité, formatage FR).
// Volontairement sans dépendance : date-fns reste dispo pour les cas complexes,
// mais ces primitives-là sont utilisées partout et doivent rester triviales.

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MONTHS_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']

// Identifiant de jour local (yyyy-mm-dd). Surtout pas toISOString() : on est en
// UTC+10, un new Date().toISOString() renvoie la veille toute la matinée.
export function toDateId(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromDateId(id) {
  const [y, m, d] = String(id).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// Lundi = 1 … Dimanche = 7 (convention ISO, pas celle de getDay()).
export function isoDayOfWeek(date = new Date()) {
  const d = date instanceof Date ? date : fromDateId(date)
  return d.getDay() === 0 ? 7 : d.getDay()
}

// Numéro de semaine ISO 8601 : la semaine 1 est celle qui contient le jeudi.
export function isoWeekNumber(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : fromDateId(date)
  d.setHours(0, 0, 0, 0)
  // On se place sur le jeudi de la semaine courante.
  d.setDate(d.getDate() + 4 - isoDayOfWeek(d))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// Parité de la semaine ISO — pilote les programmes qui alternent une semaine sur deux.
export function weekParity(date = new Date()) {
  return isoWeekNumber(date) % 2 === 0 ? 'even' : 'odd'
}

export function dayLabel(dow) {
  return DAY_LABELS[dow % 7]
}

export function dayShort(dow) {
  return DAY_SHORT[dow % 7]
}

// « lundi 21 août » — pour les en-têtes de séance / de journée.
export function formatDayFr(date = new Date(), { withYear = false } = {}) {
  const d = date instanceof Date ? date : fromDateId(date)
  const base = `${DAY_LABELS[d.getDay()].toLowerCase()} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  return withYear ? `${base} ${d.getFullYear()}` : base
}

// « 21 août » / « 21 août 2026 » — pour les listes d'historique.
export function formatDateFr(date, { withYear = false } = {}) {
  const d = date instanceof Date ? date : fromDateId(date)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return withYear ? `${base} ${d.getFullYear()}` : base
}

// « 21 août » compacté pour les axes de graphe.
export function formatDateShortFr(date) {
  const d = date instanceof Date ? date : fromDateId(date)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export { DAY_LABELS, DAY_SHORT, MONTHS, MONTHS_SHORT }
