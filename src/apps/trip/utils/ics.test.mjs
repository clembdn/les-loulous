// node --test src/apps/trip/utils/*.test.mjs
//
// Export agenda : heures murales converties avec le fuseau du lieu, format
// iCalendar (échappement, lignes pliées à 75 octets), contenu du voyage.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcs, escapeText, foldLine, icsFileName, tripEvents, tripPlaces, zonedToUtc } from './ics.js'

const iso = (ms) => new Date(ms).toISOString().slice(0, 16)

test('une heure murale dans le fuseau du lieu, heure d’été comprise', () => {
  assert.equal(iso(zonedToUtc('2027-05-12', '10:00', 'Europe/Lisbon')), '2027-05-12T09:00') // WEST, UTC+1
  assert.equal(iso(zonedToUtc('2027-01-12', '10:00', 'Europe/Lisbon')), '2027-01-12T10:00') // WET, UTC+0
  assert.equal(iso(zonedToUtc('2026-10-08', '08:12', 'Australia/Sydney')), '2026-10-07T21:12') // AEDT, UTC+11
  assert.equal(iso(zonedToUtc('2026-07-08', '08:12', 'Australia/Sydney')), '2026-07-07T22:12') // AEST, UTC+10
  assert.equal(iso(zonedToUtc('2027-05-12', '23:05', 'Atlantic/Azores')), '2027-05-12T23:05') // UTC+0 l'été
  assert.equal(zonedToUtc('2027-05-12', '10:00', 'Pas/UnFuseau'), null)
})

test('le texte : virgules, points-virgules, barres et retours à la ligne échappés', () => {
  assert.equal(escapeText('Hôtel, chambre 4; code\\B\nétage 2'), 'Hôtel\\, chambre 4\\; code\\\\B\\nétage 2')
})

test('les lignes pliées à 75 octets, sans couper un caractère', () => {
  const encoder = new TextEncoder()
  for (const line of [`DESCRIPTION:${'a'.repeat(200)}`, `SUMMARY:${'é'.repeat(90)}`, `SUMMARY:${'🛏'.repeat(40)}`]) {
    const folded = foldLine(line)
    const parts = folded.split('\r\n')
    assert.ok(parts.length > 1)
    parts.forEach((p, i) => {
      assert.ok(encoder.encode(p).length <= 75, `${encoder.encode(p).length} octets`)
      if (i > 0) assert.equal(p[0], ' ')
    })
    assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(''), line)
  }
  assert.equal(foldLine('SUMMARY:court'), 'SUMMARY:court')
})

// Un voyage : Lisbonne, puis les Açores en avion.
const LISBON = { lat: 38.7105, lng: -9.144 }
const AZORES = { lat: 37.7412, lng: -25.6756 }
const tzOf = (p) => (p.lng < -20 ? 'Atlantic/Azores' : 'Europe/Lisbon')
const labels = { transportMode: (m) => ({ flight: 'Vol' }[m] || 'Trajet'), category: (c) => ({ visit: 'Visite' }[c] || '') }
const TRIP = { id: 't1', title: 'Portugal, îles', startDate: '2027-05-11', endDate: '2027-05-14' }
const STAY = {
  id: 's1', name: 'Hôtel Lisboa', address: 'Rua X', ...LISBON, mapsUrl: null, confirmation: 'ABC', accessCode: '1234#', phone: null, notes: null,
  checkIn: { date: '2027-05-11', time: '15:00' }, checkOut: { date: '2027-05-13', time: null },
}
const FLIGHT = {
  id: 'f1', mode: 'flight', ref: 'TP1861', seat: '12A', confirmation: null, notes: null,
  from: { name: 'Lisbonne LIS', ...LISBON, date: '2027-05-13', time: '22:00' },
  to: { name: 'Ponta Delgada', ...AZORES, date: '2027-05-13', time: '23:05' },
}
const DAYS = {
  '2027-05-12': {
    title: 'Belém', notes: null,
    stops: [
      { id: 'a', name: 'Tour de Belém', lat: 38.6916, lng: -9.216, time: '10:00', durationMin: 90, category: 'visit', notes: null },
      { id: 'b', name: 'Pastéis', lat: 38.6975, lng: -9.2032, time: null, durationMin: null, category: 'food', notes: null },
      { id: 'c', name: 'Resto à trouver', lat: null, lng: null, time: '20:30', durationMin: null, category: 'food', notes: null },
    ],
  },
}
const DAY_KEYS = ['2027-05-11', '2027-05-12', '2027-05-13', '2027-05-14']
const events = (options, tz = tzOf) => tripEvents({ trip: TRIP, dayKeys: DAY_KEYS, days: DAYS, stays: [STAY], transports: [FLIGHT], tzOf: tz, labels, options })
const byUid = (list) => Object.fromEntries(list.map((e) => [e.uid, e]))

test('un vol garde l’heure de chaque bout, dans son fuseau', () => {
  const e = byUid(events())['transport-f1']
  assert.equal(e.summary, 'Vol TP1861 · Lisbonne LIS → Ponta Delgada')
  assert.equal(iso(e.start.utc), '2027-05-13T21:00')
  assert.equal(iso(e.end.utc), '2027-05-13T23:05')
})

test('un hébergement : ses nuits en bandeau, son arrivée à l’heure', () => {
  const all = byUid(events())
  assert.deepEqual([all['stay-s1'].start, all['stay-s1'].end], [{ allDay: '2027-05-11' }, { allDay: '2027-05-13' }])
  assert.equal(iso(all['stay-s1-in'].start.utc), '2027-05-11T14:00')
  assert.equal(all['stay-s1-out'], undefined, 'pas d’heure de départ : pas d’événement')
  assert.match(all['stay-s1'].description, /Code d’accès : 1234#/)
})

test('les étapes à heure fixe, et le programme de la journée', () => {
  const all = byUid(events())
  assert.equal(iso(all['stop-a'].start.utc), '2027-05-12T09:00')
  assert.equal(all['stop-a'].end.utc - all['stop-a'].start.utc, 90 * 60_000)
  // Pas localisée : le fuseau de sa journée.
  assert.equal(iso(all['stop-c'].start.utc), '2027-05-12T19:30')
  assert.equal(all['stop-b'], undefined, 'sans heure : seulement dans le programme')
  const plan = all['day-t1-2027-05-12']
  assert.equal(plan.summary, 'Belém')
  assert.equal(plan.description, '1. 10:00 Tour de Belém\n2. Pastéis\n3. 20:30 Resto à trouver')
  assert.equal(Object.keys(all).filter((k) => k.startsWith('day-')).length, 1, 'jours sans étape : rien')
  const without = byUid(events({ stops: false, dayPlans: false }))
  assert.ok(!Object.keys(without).some((k) => k.startsWith('stop-') || k.startsWith('day-')))
})

test('sans fuseau connu : heures flottantes, toujours à l’heure du billet', () => {
  const all = byUid(events({}, () => null))
  assert.deepEqual(all['transport-f1'].start, { floating: { date: '2027-05-13', time: '22:00' } })
  assert.deepEqual(all['transport-f1'].end, { floating: { date: '2027-05-13', time: '23:05' } })
  const ics = buildIcs(TRIP, [all['transport-f1']], Date.UTC(2026, 9, 8))
  assert.match(ics, /\r\nDTSTART:20270513T220000\r\n/)
})

test('le fichier : CRLF, en-tête, un VEVENT par événement, UTC suffixé Z', () => {
  const list = events()
  const ics = buildIcs(TRIP, list, Date.UTC(2026, 9, 8, 9, 30))
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(ics), 'que des CRLF')
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, list.length)
  assert.match(ics, /X-WR-CALNAME:Portugal\\, îles/)
  assert.match(ics, /DTSTAMP:20261008T093000Z/)
  assert.match(ics, /UID:transport-f1@trip\.loulous\r\nDTSTAMP:\d{8}T\d{6}Z\r\nDTSTART:20270513T210000Z\r\nDTEND:20270513T230500Z/)
  assert.match(ics, /DTSTART;VALUE=DATE:20270511\r\nDTEND;VALUE=DATE:20270513/)
})

test('le nom du fichier, les lieux à situer', () => {
  assert.equal(icsFileName(TRIP), 'portugal-iles-2027.ics')
  assert.equal(tripPlaces({ days: DAYS, stays: [STAY], transports: [FLIGHT] }).length, 5)
})
