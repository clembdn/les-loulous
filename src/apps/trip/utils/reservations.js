// La liste des réservations d'un voyage : hébergements et trajets mêlés, dans
// l'ordre où on les vivra. Module pur, testé sous `node --test`.

/** Clé d'URL d'une réservation (`stay-<id>`, `transport-<id>`). */
export function resaKey(kind, id) {
  return `${kind}-${id}`
}

/** `stay-abc` → `{ kind: 'stay', id: 'abc' }`, ou `null`. */
export function parseResaKey(key) {
  const m = typeof key === 'string' && key.match(/^(stay|transport)-(.+)$/)
  return m ? { kind: m[1], id: m[2] } : null
}

// Un instant comparable : la date, puis l'heure (sans heure = en début de journée).
const startOf = (point) => `${point.date}T${point.time || '00:00'}`

/**
 * `[{ key, kind, item, start }]` triés par début : arrivée pour un
 * hébergement, départ pour un trajet. À égalité, le trajet d'abord — on
 * arrive avant de poser ses valises.
 */
export function reservationEntries(stays, transports) {
  const entries = [
    ...transports.map((t) => ({ key: resaKey('transport', t.id), kind: 'transport', item: t, start: startOf(t.from) })),
    ...stays.map((s) => ({ key: resaKey('stay', s.id), kind: 'stay', item: s, start: startOf(s.checkIn) })),
  ]
  return entries.sort((a, b) => a.start.localeCompare(b.start) || (a.kind === 'transport' ? -1 : 1))
}
