// Export agenda (.ics, RFC 5545) d'un voyage : hébergements, trajets, étapes
// à heure fixe, et le programme de chaque journée.
//
// Les heures de l'app sont MURALES (« 08:12 », celle du billet), sans fuseau.
// Pour un agenda, on les convertit en UTC avec le fuseau du LIEU (`tzOf`,
// cf. services/timezones.js) : un vol 22:00 Lisbonne → 23:05 Açores tombe
// juste, où que soit le téléphone. Sans fuseau connu, l'heure reste
// « flottante » (sans fuseau) : l'agenda la montre à 08:12 partout.
//
// Module pur, testé sous `node --test` (Intl compris).

import { hasCoords } from './geo.js'

const DEFAULT_STOP_MIN = 60
const DEFAULT_TRANSPORT_MIN = 60
const STAY_POINT_MIN = 30
const PRODID = '-//Loulous//Trip Planner//FR'

// ---------------------------------------------------------------- fuseaux

const partsCache = new Map()
function formatter(tz) {
  let f = partsCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    partsCache.set(tz, f)
  }
  return f
}

// Décalage du fuseau `tz` à l'instant `ms` (UTC), en millisecondes.
function offsetAt(ms, tz) {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * L'instant UTC (ms) d'une heure murale `date` + `time` dans le fuseau IANA
 * `tz`, heure d'été comprise. `null` si le fuseau est inconnu de `Intl`.
 */
export function zonedToUtc(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  try {
    // Deux passes : le décalage peut changer entre l'heure devinée et la vraie.
    let ms = wall - offsetAt(wall, tz)
    ms = wall - offsetAt(ms, tz)
    return ms
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- format

const pad = (n, w = 2) => String(n).padStart(w, '0')

function utcStamp(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}

const dateValue = (date) => date.replaceAll('-', '')

function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// Une heure murale + des minutes, sans fuseau (heure flottante) : jour suivant compris.
function addMinutesWall(date, time, minutes) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi + minutes))
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  }
}

const floating = (date, time) => `${dateValue(date)}T${time.replace(':', '')}00`

/** Texte iCalendar : `\`, `;`, `,` et les retours à la ligne échappés. */
export function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

const encoder = new TextEncoder()

/**
 * Coupe une ligne à 75 OCTETS (RFC 5545 §3.1), sans casser un caractère
 * UTF-8 : les suites commencent par une espace.
 */
export function foldLine(line) {
  if (encoder.encode(line).length <= 75) return line
  const out = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    const limit = out.length ? 74 : 75
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

// ---------------------------------------------------------------- moments

/**
 * Un moment de l'agenda : `{ allDay: 'AAAA-MM-JJ' }`, `{ utc: ms }` ou
 * `{ floating: { date, time } }`.
 */
function moment(date, time, tz) {
  if (!time) return { allDay: date }
  const utc = tz ? zonedToUtc(date, time, tz) : null
  return utc == null ? { floating: { date, time } } : { utc }
}

function plusMinutes(m, minutes) {
  if (m.utc != null) return { utc: m.utc + minutes * 60_000 }
  if (m.floating) return { floating: addMinutesWall(m.floating.date, m.floating.time, minutes) }
  return m
}

function momentLine(name, m) {
  if (m.allDay) return `${name};VALUE=DATE:${dateValue(m.allDay)}`
  if (m.utc != null) return `${name}:${utcStamp(m.utc)}`
  return `${name}:${floating(m.floating.date, m.floating.time)}`
}

// La fin doit suivre le début ; à défaut (saisie incohérente), une durée par défaut.
function after(start, end, fallbackMin) {
  if (end && start.utc != null && end.utc != null && end.utc > start.utc) return end
  if (end?.floating && start.floating) {
    const a = `${start.floating.date}T${start.floating.time}`
    const b = `${end.floating.date}T${end.floating.time}`
    if (b > a) return end
  }
  return plusMinutes(start, fallbackMin)
}

// ---------------------------------------------------------------- événements

const lines = (...parts) => parts.filter(Boolean).join('\n')

function placeOf(p) {
  if (!p) return null
  return [p.name, p.address].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || null
}

const mapsLink = (p) => p?.mapsUrl || (hasCoords(p) ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null)

/**
 * Les événements d'un voyage. `tzOf(lieu)` rend le fuseau IANA d'un lieu
 * localisé, ou `null`. `labels` : `{ transportMode(mode), category(id) }`
 * (libellés de l'app, gardés hors de ce module pur). Options :
 * `{ stops: true, dayPlans: true }`.
 *
 * Rend `[{ uid, summary, start, end, location, geo, description }]`.
 */
export function tripEvents({ trip, dayKeys, days, stays, transports, tzOf, labels, options = {} }) {
  const { stops: withStops = true, dayPlans = true } = options
  const tz = (p) => (hasCoords(p) ? tzOf(p) : null)
  const events = []

  // Le fuseau d'une journée : celui de son premier lieu connu (une étape sans
  // position ce jour-là est quelque part par là).
  const dayTz = {}
  for (const date of dayKeys) {
    const located = (days[date]?.stops || []).find(hasCoords)
      || stays.find((s) => s.checkIn.date <= date && s.checkOut.date >= date && hasCoords(s))
    dayTz[date] = located ? tz(located) : null
  }

  for (const s of stays) {
    const details = lines(
      s.checkIn.time && `Arrivée : ${s.checkIn.time}`,
      s.checkOut.time && `Départ : ${s.checkOut.time}`,
      s.confirmation && `Réservation : ${s.confirmation}`,
      s.accessCode && `Code d’accès : ${s.accessCode}`,
      s.phone && `Téléphone : ${s.phone}`,
      s.notes,
      mapsLink(s),
    )
    const base = { location: placeOf(s), geo: hasCoords(s) ? s : null, description: details }
    // Les nuits : du jour d'arrivée au jour du départ (exclu, comme le veut le format).
    events.push({
      ...base,
      uid: `stay-${s.id}`,
      summary: `🛏 ${s.name}`,
      start: { allDay: s.checkIn.date },
      end: { allDay: s.checkOut.date > s.checkIn.date ? s.checkOut.date : addDays(s.checkIn.date, 1) },
    })
    const zone = tz(s) || dayTz[s.checkIn.date]
    if (s.checkIn.time) {
      const start = moment(s.checkIn.date, s.checkIn.time, zone)
      events.push({ ...base, uid: `stay-${s.id}-in`, summary: `Arrivée · ${s.name}`, start, end: plusMinutes(start, STAY_POINT_MIN) })
    }
    if (s.checkOut.time) {
      const start = moment(s.checkOut.date, s.checkOut.time, tz(s) || dayTz[s.checkOut.date])
      events.push({ ...base, uid: `stay-${s.id}-out`, summary: `Départ · ${s.name}`, start, end: plusMinutes(start, STAY_POINT_MIN) })
    }
  }

  for (const t of transports) {
    const route = [t.from.name, t.to.name].filter(Boolean).join(' → ')
    const title = [labels.transportMode(t.mode), t.ref, route && `· ${route}`].filter(Boolean).join(' ')
    const start = moment(t.from.date, t.from.time, tz(t.from) || dayTz[t.from.date])
    let end
    if (start.allDay) {
      end = { allDay: addDays(t.to.date > t.from.date ? t.to.date : t.from.date, 1) }
    } else {
      const arrival = t.to.time ? moment(t.to.date, t.to.time, tz(t.to) || tz(t.from) || dayTz[t.to.date]) : null
      end = after(start, arrival?.allDay ? null : arrival, DEFAULT_TRANSPORT_MIN)
    }
    events.push({
      uid: `transport-${t.id}`,
      summary: title,
      start,
      end,
      location: placeOf(t.from),
      geo: hasCoords(t.from) ? t.from : null,
      description: lines(
        t.from.time && `Départ ${t.from.time}${t.from.name ? ` · ${t.from.name}` : ''}`,
        t.to.time && `Arrivée ${t.to.time}${t.to.name ? ` · ${t.to.name}` : ''}`,
        t.seat && `Place : ${t.seat}`,
        t.confirmation && `Réservation : ${t.confirmation}`,
        t.notes,
      ),
    })
  }

  dayKeys.forEach((date, i) => {
    const day = days[date]
    const list = day?.stops || []
    if (withStops) {
      for (const s of list) {
        if (!s.time) continue
        const start = moment(date, s.time, tz(s) || dayTz[date])
        events.push({
          uid: `stop-${s.id}`,
          summary: s.name,
          start,
          end: plusMinutes(start, s.durationMin || DEFAULT_STOP_MIN),
          location: placeOf(s),
          geo: hasCoords(s) ? s : null,
          description: lines(labels.category(s.category), s.notes, mapsLink(s)),
        })
      }
    }
    if (dayPlans && list.length) {
      events.push({
        uid: `day-${trip.id}-${date}`,
        summary: day.title || `${trip.title} · jour ${i + 1}`,
        start: { allDay: date },
        end: { allDay: addDays(date, 1) },
        location: null,
        geo: null,
        description: lines(
          ...list.map((s, k) => `${k + 1}. ${s.time ? `${s.time} ` : ''}${s.name}`),
          day.notes && `\n${day.notes}`,
        ),
      })
    }
  })

  return events
}

/** Le fichier .ics (lignes CRLF, pliées). `now` : l'horodatage DTSTAMP (ms). */
export function buildIcs(trip, events, now = Date.now()) {
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(trip.title)}`,
  ]
  const stamp = utcStamp(now)
  for (const e of events) {
    out.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@trip.loulous`,
      `DTSTAMP:${stamp}`,
      momentLine('DTSTART', e.start),
      momentLine('DTEND', e.end),
      `SUMMARY:${escapeText(e.summary)}`,
    )
    if (e.location) out.push(`LOCATION:${escapeText(e.location)}`)
    if (e.geo) out.push(`GEO:${e.geo.lat.toFixed(6)};${e.geo.lng.toFixed(6)}`)
    if (e.description) out.push(`DESCRIPTION:${escapeText(e.description)}`)
    out.push('TRANSP:' + (e.start.allDay ? 'TRANSPARENT' : 'OPAQUE'), 'END:VEVENT')
  }
  out.push('END:VCALENDAR')
  return `${out.map(foldLine).join('\r\n')}\r\n`
}

/** Un nom de fichier sûr : « portugal-2027.ics ». */
export function icsFileName(trip) {
  const base = trip.title
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'voyage'
  return `${base}-${trip.startDate.slice(0, 4)}.ics`
}

/** Les lieux dont il faut le fuseau. */
export function tripPlaces({ days, stays, transports }) {
  const out = []
  for (const s of stays) if (hasCoords(s)) out.push(s)
  for (const t of transports) for (const p of [t.from, t.to]) if (hasCoords(p)) out.push(p)
  for (const day of Object.values(days)) for (const s of day.stops || []) if (hasCoords(s)) out.push(s)
  return out
}
