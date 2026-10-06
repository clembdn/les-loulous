// La saisie rapide d'une étape : un nom de lieu, et son heure si on l'a tapée
// avec — « 10h30 Tour de Belém », « Tour de Belém à 17h », « 9:15 café ».
// On n'ouvre pas de formulaire pour une heure : on la lit dans la phrase.
//
// Module pur, testé sous `node --test`.

// Une heure : « 10h30 », « 10 h 30 », « 9h », « 10:30 ». Le « h » ou les deux
// points sont obligatoires — « Route 66 » n'est pas une heure.
const TIME = String.raw`(\d{1,2})\s*(?:h|H|:)\s*(\d{2})?`
const LEADING = new RegExp(String.raw`^\s*(?:à\s+)?${TIME}(?=\s|$)\s*(?:[-–—·,]\s*)?`)
const TRAILING = new RegExp(String.raw`\s*(?:[-–—·,]\s*)?(?:à\s+)?${TIME}\s*$`)

function toTime(h, m) {
  const hours = Number(h)
  const minutes = m ? Number(m) : 0
  if (!Number.isInteger(hours) || hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * `{ time, query }` : l'heure « HH:MM » si la saisie en commence ou en finit
 * par une (sinon `null`), et le reste — ce qu'on cherche.
 */
export function parseQuickAdd(text) {
  const raw = typeof text === 'string' ? text : ''
  for (const re of [LEADING, TRAILING]) {
    const m = raw.match(re)
    if (!m) continue
    const time = toTime(m[1], m[2])
    const query = raw.replace(re, ' ').trim()
    if (time && query) return { time, query }
  }
  return { time: null, query: raw.trim() }
}
