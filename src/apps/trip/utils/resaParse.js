// Lire une réservation dans le texte d'une capture (OCR) : les dates, les
// heures, le numéro du vol ou du train, la référence, la place, le code
// d'accès, le prix. Les mails arrivent en français, anglais, portugais ou
// espagnol, et l'OCR abîme les accents (« août » → « aout ») : on compare
// sans accents, et on ne garde que ce qu'on reconnaît avec assez de sûreté.
// Rien n'est enregistré sans relecture : le formulaire surligne ce qui a été
// rempli.
//
// Module pur, testé sous `node --test`.

const MONTHS = {
  jan: 1, janv: 1, janvier: 1, january: 1, janeiro: 1, enero: 1,
  feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, fevereiro: 2, febrero: 2,
  mar: 3, mars: 3, march: 3, marco: 3, marzo: 3,
  apr: 4, avr: 4, avril: 4, april: 4, abril: 4,
  may: 5, mai: 5, maio: 5, mayo: 5,
  jun: 6, juin: 6, june: 6, junho: 6, junio: 6,
  jul: 7, juil: 7, juillet: 7, july: 7, julho: 7, julio: 7,
  aug: 8, aout: 8, august: 8, agosto: 8,
  sep: 9, sept: 9, septembre: 9, september: 9, setembro: 9, septiembre: 9,
  oct: 10, octobre: 10, october: 10, outubro: 10, octubre: 10,
  nov: 11, novembre: 11, november: 11, novembro: 11, noviembre: 11,
  dec: 12, decembre: 12, december: 12, dezembro: 12, diciembre: 12,
}
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

function plain(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'")
}

const pad = (n) => String(n).padStart(2, '0')

function isoDate(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// Une date sans année : celle qui la met le plus près du voyage.
function withYear(m, d, near) {
  const base = Number((near || '').slice(0, 4)) || new Date().getFullYear()
  const candidates = [base - 1, base, base + 1].map((y) => isoDate(y, m, d)).filter(Boolean)
  if (!near) return candidates[1] || candidates[0] || null
  const t = Date.parse(near)
  return candidates.sort((a, b) => Math.abs(Date.parse(a) - t) - Math.abs(Date.parse(b) - t))[0] || null
}

function fullYear(y) {
  const n = Number(y)
  return n < 100 ? 2000 + n : n
}

/** Toutes les dates du texte, dans leur ordre d'apparition : `[{ date, at }]`. */
export function findDates(text, { near = null } = {}) {
  const t = plain(text).toLowerCase()
  const found = []
  const push = (date, at) => { if (date && !found.some((f) => f.at === at)) found.push({ date, at }) }

  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) push(isoDate(+m[1], +m[2], +m[3]), m.index)
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g)) {
    let d = +m[1]
    let mo = +m[2]
    // Jour et mois à l'européenne ; à l'américaine seulement si c'est la seule lecture possible.
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    push(isoDate(fullYear(m[3]), mo, d), m.index)
  }
  const dayMonth = new RegExp(String.raw`\b(\d{1,2})(?:er|st|nd|rd|th)?\s+(${MONTH_RE})\.?(?:\s+(\d{4}))?\b`, 'g')
  for (const m of t.matchAll(dayMonth)) {
    const month = MONTHS[m[2]]
    push(m[3] ? isoDate(+m[3], month, +m[1]) : withYear(month, +m[1], near), m.index)
  }
  const monthDay = new RegExp(String.raw`\b(${MONTH_RE})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`, 'g')
  for (const m of t.matchAll(monthDay)) {
    const month = MONTHS[m[1]]
    push(m[3] ? isoDate(+m[3], month, +m[2]) : withYear(month, +m[2], near), m.index)
  }
  return found.sort((a, b) => a.at - b.at)
}

/** Toutes les heures du texte (pas les durées) : `[{ time, at }]`, « 7:05 pm » compris. */
export function findTimes(text) {
  const t = plain(text).toLowerCase()
  const found = []
  for (const m of t.matchAll(/\b(\d{1,2})\s?[:h]\s?(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?(?!\s*(?:min|mn))/g)) {
    // « Durée 2h35 », « duration 1:20 » : un temps de trajet, pas une heure.
    if (/(duree|duration|duracao|duracion|temps de trajet)\s*:?\s*$/.test(t.slice(Math.max(0, m.index - 22), m.index))) continue
    let h = +m[1]
    const min = +m[2]
    const suffix = m[3]?.replace(/\./g, '')
    if (suffix === 'pm' && h < 12) h += 12
    if (suffix === 'am' && h === 12) h = 0
    if (h > 23 || min > 59) continue
    found.push({ time: `${pad(h)}:${pad(min)}`, at: m.index, before: t.slice(Math.max(0, m.index - 30), m.index) })
  }
  return found
}

const TRAIN_RE = /\b(TGV(?:\s*INOUI)?|OUIGO|TER|INTERCIT[EÉ]S|IC|ICE|AVE|ALVIA|ALFA(?:\s*PENDULAR)?|AP|EUROSTAR|THALYS|FRECCIAROSSA|EC|RJX?|IR)\s*(?:N[°O]\s*)?(\d{2,5})\b/i
const FLIGHT_LABEL_RE = /\b(?:vol|flight|voo|vuelo)\s*(?:n[°o]|no\.?|number|numero)?\s*:?\s*([A-Z0-9]{2})\s?(\d{2,4})\b/i
const FLIGHT_RE = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{3,4})\b(?![A-Z])/

/** Le numéro du vol (« AF 1024 ») ou du train (« TGV INOUI 6173 »), et le mode qu'il trahit. */
export function findTransportRef(text) {
  const train = text.match(TRAIN_RE)
  if (train) return { ref: `${train[1].toUpperCase().replace(/\s+/g, ' ')} ${train[2]}`, mode: 'train' }
  const labeled = plain(text).match(FLIGHT_LABEL_RE)
  if (labeled && /[A-Z]/i.test(labeled[1])) return { ref: `${labeled[1].toUpperCase()} ${labeled[2]}`, mode: 'flight' }
  for (const line of text.split(/\n/)) {
    const m = line.match(FLIGHT_RE)
    // Une ligne de vol cite aussi des aéroports ou des heures : sans eux, un
    // « A1 2345 » isolé n'est sans doute pas un vol.
    if (m && (/\b[A-Z]{3}\b/.test(line) || /\d{1,2}[:h]\d{2}/.test(line) || /\b(vol|flight|voo|vuelo)\b/i.test(plain(line)))) {
      return { ref: `${m[1]} ${m[2]}`, mode: 'flight' }
    }
  }
  return null
}

const REF_LABEL_RE = new RegExp(String.raw`(?:r[eé]f[eé]rence(?: de (?:r[eé]servation|r[eé]servation|dossier))?|num[eé]ro de (?:r[eé]servation|confirmation|dossier|commande)|n[°o] de (?:r[eé]servation|confirmation|dossier|commande)|code (?:de )?r[eé]servation|confirmation(?: code| number| n[°o])?|booking (?:reference|code|number|ref\.?)|reservation (?:code|number)|record locator|pnr|dossier|localizador|c[oó]digo de reserva|c[oó]digo da reserva|referencia)\s*(?:n[°o]\.?)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9-]{4,15})`, 'i')
const PNR_RE = /\b(?=[A-Z0-9]{6}\b)(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6}\b/

/** La référence de réservation : après son libellé, sinon un « PNR » de six signes. */
export function findReference(text, { exclude = [] } = {}) {
  const labeled = text.match(REF_LABEL_RE)
  if (labeled && /\d/.test(labeled[1]) && !exclude.includes(labeled[1])) return labeled[1].toUpperCase()
  if (labeled && /^[A-Z]{6}$/.test(labeled[1])) return labeled[1]
  for (const line of text.split(/\n/)) {
    const m = line.match(PNR_RE)
    if (m && !exclude.some((x) => x.replace(/\s/g, '') === m[0])) return m[0]
  }
  return null
}

function findSeat(text) {
  const t = plain(text)
  const coach = t.match(/\b(?:voiture|coach|car|carruagem|coche)\s*(?:n[°o])?\s*:?\s*(\d{1,3})\b/i)
  const seat = t.match(/\b(?:siege|seat|place|lugar|assento|asiento)s?\s*(?:n[°o])?\s*:?\s*(\d{1,3}[A-K]?)\b/i)
  if (coach && seat) return `Voiture ${coach[1]}, place ${seat[1]}`
  if (seat) return seat[1].toUpperCase()
  return null
}

function findAccessCode(text) {
  const m = plain(text).match(/(?:code d'acces|code de la porte|code porte|digicode|boite a cles|bo[iî]te a cle|door code|lockbox(?: code)?|key ?box(?: code)?|key code|access code|codigo de acesso|codigo de acceso|codigo)\s*[:#]?\s*(\d{3,8}[A-Z#*]?)/i)
  return m ? m[1] : null
}

function findAirports(text) {
  const m = text.match(/\b([A-Z]{3})\s*(?:→|->|—|–|-|>|to|à|a)\s*([A-Z]{3})\b/)
  return m ? { from: m[1], to: m[2] } : null
}

const CURRENCY_SIGNS = { '€': 'EUR', eur: 'EUR', aud: 'AUD', 'a$': 'AUD', usd: 'USD', $: 'USD', '£': 'GBP', gbp: 'GBP', nzd: 'NZD', chf: 'CHF', cad: 'CAD' }

function parseAmount(raw) {
  let s = raw.replace(/\s/g, '')
  // « 1.234,56 » / « 1,234.56 » / « 284,00 » / « 284.00 ».
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function findPrice(text) {
  const t = plain(text)
  const m = t.match(/(?:total|montant|prix|price|amount|pay[ée]|paid|pago|importe)[^\d\n€$£]{0,30}?(a\$|€|eur|aud|usd|\$|£|gbp|nzd|chf|cad)?\s*(\d[\d\s.,]*\d|\d)\s*(€|eur|aud|usd|£|gbp|nzd|chf|cad)?/i)
  if (!m) return null
  const amount = parseAmount(m[2])
  if (amount == null) return null
  const sign = (m[1] || m[3] || '€').toLowerCase()
  return { amount, currency: CURRENCY_SIGNS[sign] || 'EUR' }
}

// La date et l'heure qui suivent un libellé (« Arrivée », « Check-out »…).
function afterLabel(text, labelRe, dates, times) {
  const m = plain(text).toLowerCase().match(labelRe)
  if (!m) return null
  const from = m.index
  const date = dates.find((d) => d.at >= from && d.at - from < 120)
  const time = times.find((t) => t.at >= from && t.at - from < 120)
  return date || time ? { date: date?.date || null, time: time?.time || null } : null
}

/**
 * Tout ce qu'on lit d'une capture. `near` (« AAAA-MM-JJ », le début du
 * voyage) donne l'année aux dates qui n'en ont pas.
 */
export function parseReservationText(text, { near = null } = {}) {
  const raw = text || ''
  const dates = findDates(raw, { near })
  const times = findTimes(raw)
  const transport = findTransportRef(raw)
  const confirmation = findReference(raw, { exclude: transport ? [transport.ref] : [] })
  // Pour un trajet, l'heure d'embarquement ou de fermeture des portes n'est
  // pas celle du départ.
  const legTimes = times.filter((t) => !/(embarquement|boarding|embarque|porte|gate|enregistrement|check-in)[^\d]*$/.test(t.before))
  return {
    dates: dates.map((d) => d.date),
    times: times.map((t) => t.time),
    legTimes: legTimes.map((t) => t.time),
    transportRef: transport?.ref || null,
    mode: transport?.mode || null,
    confirmation,
    seat: findSeat(raw),
    accessCode: findAccessCode(raw),
    airports: findAirports(raw),
    price: findPrice(raw),
    checkIn: afterLabel(raw, /(arrivee|check-in|check in|enregistrement|entrada|llegada)/, dates, times),
    checkOut: afterLabel(raw, /(depart(?! d)|check-out|check out|saida|salida)/, dates, times),
  }
}

/** Ce qu'une capture apprend d'un TRAJET : `{ ref, from, to, fromName, toName, seat, confirmation, price }`. */
export function transportFields(parsed) {
  const [d1, d2] = parsed.dates
  const [t1, t2] = parsed.legTimes || parsed.times
  let toDate = d2 || d1 || null
  // Une seule date et une arrivée « avant » le départ : on arrive le lendemain.
  if (!d2 && d1 && t1 && t2 && t2 < t1) {
    const next = new Date(`${d1}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    toDate = next.toISOString().slice(0, 10)
  }
  return {
    ref: parsed.transportRef,
    mode: parsed.mode,
    from: { date: d1 || null, time: t1 || null },
    to: { date: toDate, time: t2 || null },
    fromName: parsed.airports?.from || null,
    toName: parsed.airports?.to || null,
    seat: parsed.seat,
    confirmation: parsed.confirmation,
    price: parsed.price,
  }
}

/** Ce qu'une capture apprend d'un HÉBERGEMENT : arrivée, départ, code, référence, prix. */
export function stayFields(parsed) {
  const [d1, d2] = parsed.dates
  return {
    checkIn: { date: parsed.checkIn?.date || d1 || null, time: parsed.checkIn?.time || null },
    checkOut: { date: parsed.checkOut?.date || d2 || null, time: parsed.checkOut?.time || null },
    accessCode: parsed.accessCode,
    confirmation: parsed.confirmation,
    price: parsed.price,
  }
}
