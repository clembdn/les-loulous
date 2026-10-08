// La vitrine d'un lien invité : ce qu'on publie du voyage, et de quoi savoir
// s'il faut la republier.
//
// Imports RELATIFS (pas d'alias `@/`) : ce module est testé sous `node --test`.

// Un document Firestore plafonne à 1 Mio, noms de champs compris : la
// vitrine (sans les captures) doit tenir dessous avec de la marge.
export const PUBLIC_MAX_CHARS = 900_000

// Une requête Firestore plafonne à 10 Mio : les captures (jusqu'à ~0,9 Mo
// chacune) partent par paquets d'au plus 8 Mo.
export const ATTACHMENT_BATCH_CHARS = 8_000_000

// Qui a créé ou modifié quoi ne regarde pas l'invité — et un enregistrement
// sans changement ne doit pas changer l'empreinte. Les comptes du couple
// (`expense`, la dépense FinAuzi d'une réservation) non plus.
const PRIVATE = new Set(['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'expense'])

function withoutMeta(item) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => !PRIVATE.has(key)))
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Le contenu publié : le voyage, ses réservations, ses journées dans les
 * dates du voyage (un jour masqué par un raccourcissement ne part pas), et la
 * liste des captures — leurs identifiants seulement, les images sont copiées
 * à part. Passé par JSON : Firestore refuse `undefined`.
 */
export function publicTripContent({ trip, stays, transports, days, dayKeys, attachments }) {
  const shownDays = {}
  for (const date of dayKeys) {
    const day = days[date]
    if (!day) continue
    const { title, notes, stops, legs = [] } = day
    if (title || notes || stops.length || legs.length) shownDays[date] = { date, title, notes, stops, legs }
  }
  return JSON.parse(JSON.stringify({
    trip: { title: trip.title, startDate: trip.startDate, endDate: trip.endDate, notes: trip.notes },
    stays: [...stays].sort(byId).map(withoutMeta),
    transports: [...transports].sort(byId).map(withoutMeta),
    days: shownDays,
    attachmentIds: attachments.map((a) => a.id).sort(),
  }))
}

/**
 * Empreinte du contenu (cyrb53, 53 bits) : la vitrine n'est réécrite que si
 * elle change. Pas une signature, seulement un « est-ce le même ? ».
 */
export function contentHash(content) {
  const str = JSON.stringify(content)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** Les captures à copier dans la vitrine, et celles à en retirer. */
export function attachmentChanges(publishedIds = [], currentIds = []) {
  const published = new Set(publishedIds)
  const current = new Set(currentIds)
  return {
    add: currentIds.filter((id) => !published.has(id)),
    remove: publishedIds.filter((id) => !current.has(id)),
  }
}

/** Découpe `items` en paquets dont la taille cumulée (`sizeOf`) reste sous `max`. */
export function chunkBySize(items, sizeOf, max) {
  const chunks = []
  let current = []
  let size = 0
  for (const item of items) {
    const s = sizeOf(item)
    if (current.length && size + s > max) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(item)
    size += s
  }
  if (current.length) chunks.push(current)
  return chunks
}

// base64url : 64 symboles, donc un octet & 63 tire chaque symbole sans biais.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
export const TOKEN_LENGTH = 32
export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

/**
 * Le jeton d'un lien invité : 32 symboles, 192 bits tirés par le générateur
 * cryptographique. Impossible à deviner, donc impossible à trouver sans le lien.
 */
export function newShareToken(getRandomValues = (a) => crypto.getRandomValues(a)) {
  const bytes = getRandomValues(new Uint8Array(TOKEN_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b & 63]).join('')
}

export function guestPath(token) {
  return `/v/${token}`
}
