// La frise d'une journée, et le déplacement des étapes.
//
// Trois sources, une seule liste :
//  · les ÉTAPES du jour, dans l'ordre choisi à la main ;
//  · les TRAJETS réservés qui partent ou arrivent ce jour-là ;
//  · les ARRIVÉES et DÉPARTS d'hébergement.
// Une réservation n'est jamais recopiée en étape : la frise la lit là où elle
// est. Changer l'heure d'un train la change donc partout, et rien n'est à
// saisir deux fois.
//
// Les heures sont des heures murales « HH:MM » (cf. utils/fields.js) : elles
// se comparent comme des chaînes, et se convertissent en minutes pour les
// durées. Module pur, testé sous `node --test`.

/** « 09:30 » → 570. */
export function toMinutes(time) {
  if (typeof time !== 'string') return null
  const [h, m] = time.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

// Rang d'un événement dans une journée de voyage type : on rend la chambre,
// on prend le train, on arrive, on pose ses valises. Il départage deux
// événements à la même heure, et place ceux qui n'ont pas d'heure : les
// départs en tête de journée, les arrivées en fin.
const RANK = { checkout: 0, departure: 1, arrival: 2, checkin: 3 }

function reservationEvents(date, stays, transports) {
  const events = []
  for (const t of transports) {
    const departs = t.from.date === date
    const arrives = t.to.date === date
    if (departs && arrives) {
      events.push({
        type: 'transport', key: `transport-${t.id}`, phase: 'both',
        time: t.from.time, endTime: t.to.time, transport: t, rank: RANK.departure,
      })
    } else if (departs) {
      events.push({
        type: 'transport', key: `transport-${t.id}-dep`, phase: 'departure',
        time: t.from.time, endTime: null, transport: t, rank: RANK.departure,
      })
    } else if (arrives) {
      events.push({
        type: 'transport', key: `transport-${t.id}-arr`, phase: 'arrival',
        time: t.to.time, endTime: null, transport: t, rank: RANK.arrival,
      })
    }
  }
  for (const s of stays) {
    if (s.checkOut.date === date) {
      events.push({ type: 'checkout', key: `checkout-${s.id}`, time: s.checkOut.time, stay: s, rank: RANK.checkout })
    }
    if (s.checkIn.date === date) {
      events.push({ type: 'checkin', key: `checkin-${s.id}`, time: s.checkIn.time, stay: s, rank: RANK.checkin })
    }
  }
  return events
}

const byRank = (a, b) => a.rank - b.rank
const byTimeThenRank = (a, b) => a.time.localeCompare(b.time) || byRank(a, b)

/**
 * La frise du jour `date`.
 *
 * Les étapes gardent l'ordre manuel et reçoivent leur numéro (le même que sur
 * la mini-carte). Un événement daté se glisse juste avant la première étape
 * datée qui ne le précède pas : les étapes sans heure posées en tête de
 * journée y restent, l'utilisateur les a voulues là.
 *
 * Éléments : `{ type: 'stop', key, time, stop, number }`,
 * `{ type: 'transport', key, time, endTime, phase, transport }`,
 * `{ type: 'checkin' | 'checkout', key, time, stay }`.
 */
export function buildDayTimeline(date, stops = [], stays = [], transports = []) {
  const events = reservationEvents(date, stays, transports)
  const timed = events.filter((e) => e.time).sort(byTimeThenRank)
  const leading = events.filter((e) => !e.time && e.rank <= RANK.departure).sort(byRank)
  const trailing = events.filter((e) => !e.time && e.rank >= RANK.arrival).sort(byRank)

  const items = [...leading]
  let next = 0
  let number = 0
  for (const stop of stops) {
    if (stop.time) {
      while (next < timed.length && timed[next].time <= stop.time) items.push(timed[next++])
    }
    number += 1
    items.push({ type: 'stop', key: `stop-${stop.id}`, time: stop.time, stop, number })
  }
  while (next < timed.length) items.push(timed[next++])
  items.push(...trailing)

  return items.map(({ rank, ...item }) => item)
}

/** Fin d'un élément en minutes, quand on la connaît (durée d'étape, arrivée d'un trajet). */
export function endMinutes(item) {
  const start = toMinutes(item.time)
  if (start === null) return null
  if (item.type === 'stop' && item.stop.durationMin) return start + item.stop.durationMin
  if (item.type === 'transport' && item.phase === 'both') {
    const end = toMinutes(item.endTime)
    return end !== null && end >= start ? end : null
  }
  return null
}

/** Terminé à l'heure `now` ? Un élément sans heure n'est jamais « passé » : on n'en sait rien. */
export function isPast(item, now) {
  const start = toMinutes(item.time)
  if (start === null) return false
  const end = endMinutes(item) ?? start
  return end < toMinutes(now)
}

/** Index du dernier élément daté déjà commencé à l'heure `now` (−1 si aucun). */
export function lastStartedIndex(items, now) {
  const nowMin = toMinutes(now)
  let last = -1
  items.forEach((item, i) => {
    const start = toMinutes(item.time)
    if (start !== null && start <= nowMin) last = i
  })
  return last
}

/**
 * Les clés des éléments à griser à l'heure `now` : les éléments datés
 * terminés, et les éléments sans heure rangés AVANT le dernier élément
 * commencé — on est passé à la suite, ils sont derrière nous.
 */
export function pastKeys(items, now) {
  const last = lastStartedIndex(items, now)
  const keys = new Set()
  items.forEach((item, i) => {
    if (item.time ? isPast(item, now) : i < last) keys.add(item.key)
  })
  return keys
}

/**
 * Où en est la journée à l'heure `now` :
 *  · `current` — commencé et pas fini (heure + durée connues) ;
 *  · `next` — le prochain élément daté.
 * L'ordre de la frise peut ne pas être chronologique (ordre manuel) : on
 * cherche la plus petite heure à venir, pas le premier élément après l'index
 * courant.
 */
export function dayStatus(items, now) {
  const nowMin = toMinutes(now)
  let current = null
  let next = null
  for (const item of items) {
    const start = toMinutes(item.time)
    if (start === null) continue
    if (start > nowMin) {
      if (!next || start < toMinutes(next.time)) next = item
      continue
    }
    const end = endMinutes(item)
    if (end !== null && end > nowMin && (!current || start >= toMinutes(current.time))) current = item
  }
  return { current, next }
}

/**
 * Déplace une étape dans sa journée ou vers une autre, AVANT l'étape
 * `beforeId` (en fin de liste si elle est nulle ou introuvable). Désigner la
 * voisine plutôt qu'un index évite le classique décalage d'un cran quand on
 * descend une étape dans sa propre liste.
 *
 * Rend les nouvelles listes des jours touchés, `{ [date]: stops }`, ou `null`
 * si l'étape n'existe pas.
 */
export function moveStop(stopsByDate, { fromDate, stopId, toDate, beforeId = null }) {
  const source = stopsByDate[fromDate] || []
  const stop = source.find((s) => s.id === stopId)
  if (!stop) return null
  const without = source.filter((s) => s.id !== stopId)
  const target = fromDate === toDate ? without : (stopsByDate[toDate] || [])
  const at = beforeId ? target.findIndex((s) => s.id === beforeId) : -1
  const inserted = at === -1
    ? [...target, stop]
    : [...target.slice(0, at), stop, ...target.slice(at)]
  return fromDate === toDate
    ? { [fromDate]: inserted }
    : { [fromDate]: without, [toDate]: inserted }
}

/**
 * Où ranger une étape lâchée sur un autre jour : avant la première étape
 * datée plus tard qu'elle. Une étape sans heure va en fin de journée.
 * Rend l'id de cette voisine, ou `null` (fin de liste).
 */
export function insertionPointByTime(stops, time) {
  if (!time) return null
  const after = stops.find((s) => s.time && s.time > time)
  return after ? after.id : null
}

/**
 * Une nouvelle étape dans la liste du jour : à son heure si elle en a une
 * (avant la première étape datée plus tard), sinon en fin de journée.
 */
export function insertStopByTime(stops, stop) {
  const beforeId = insertionPointByTime(stops, stop.time)
  const at = beforeId ? stops.findIndex((s) => s.id === beforeId) : -1
  return at === -1 ? [...stops, stop] : [...stops.slice(0, at), stop, ...stops.slice(at)]
}
