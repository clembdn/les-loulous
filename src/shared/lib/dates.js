// Helpers de date partagés par les apps (clés de document, semaine ISO, FR).
//
// RÈGLE ABSOLUE — toutes les clés `YYYY-MM-DD` sont construites ET relues en
// heure LOCALE. On vit en Australie (UTC+10) : une séance à 6 h du matin est à
// 20 h UTC la veille. Se tromper de sens décale le jour, donc le jour de la
// semaine, donc le numéro de semaine ISO, donc la parité — sans lever la
// moindre erreur. L'historique se corromprait en silence.
//
// Interdits dans tout le code : `toISOString().slice(0, 10)` (donne la date
// UTC) et `new Date("2026-08-21")` (la spec JS l'interprète comme UTC).

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MONTHS_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value) {
  return typeof value === 'string' && KEY_RE.test(value)
}

/**
 * Écriture : Date → "2026-08-21", dans le fuseau LOCAL.
 *
 * Construction manuelle plutôt qu'un Intl.DateTimeFormat : le rendu d'Intl
 * dépend de la locale et n'est pas garanti pour un format machine.
 */
export function toLocalDateKey(value = new Date()) {
  const d = toLocalDate(value)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Lecture : "2026-08-21" → Date à minuit LOCAL. */
export function fromLocalDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// Accepte indifféremment une Date, une clé locale ou un timestamp, et rend
// toujours une Date en heure locale. Toutes les fonctions ci-dessous passent
// par là : aucune ne doit refaire son propre `new Date(...)`.
function toLocalDate(value) {
  if (value instanceof Date) return value
  if (isDateKey(value)) return fromLocalDateKey(value)
  return new Date(value)
}

// Lundi = 1 … Dimanche = 7 (convention ISO, pas celle de getDay()).
export function isoDayOfWeek(value = new Date()) {
  const d = toLocalDate(value)
  return d.getDay() === 0 ? 7 : d.getDay()
}

// Numéro de semaine ISO 8601 : la semaine 1 est celle qui contient le jeudi.
export function isoWeekNumber(value = new Date()) {
  // Copie : on décale la date pour trouver le jeudi, sans toucher l'original.
  const d = new Date(toLocalDate(value))
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - isoDayOfWeek(d))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// Parité de la semaine ISO — pilote les programmes qui alternent.
export function weekParity(value = new Date()) {
  return isoWeekNumber(value) % 2 === 0 ? 'even' : 'odd'
}

// Clé locale décalée de `days` jours — pour borner une requête sur un intervalle.
export function shiftDateKey(key, days) {
  const d = fromLocalDateKey(key)
  d.setDate(d.getDate() + days)
  return toLocalDateKey(d)
}

export function dayLabel(dow) {
  return DAY_LABELS[dow % 7]
}


// « lundi 21 août » — en-têtes de séance / de journée.
export function formatDayFr(value = new Date(), { withYear = false } = {}) {
  const d = toLocalDate(value)
  const base = `${DAY_LABELS[d.getDay()].toLowerCase()} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  return withYear ? `${base} ${d.getFullYear()}` : base
}

// « 21 août » / « 21 août 2026 » — listes d'historique.
export function formatDateFr(value, { withYear = false } = {}) {
  const d = toLocalDate(value)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return withYear ? `${base} ${d.getFullYear()}` : base
}

// « 21 août » compacté — axes de graphe.
export function formatDateShortFr(value) {
  const d = toLocalDate(value)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export { DAY_LABELS, DAY_SHORT, MONTHS, MONTHS_SHORT }
